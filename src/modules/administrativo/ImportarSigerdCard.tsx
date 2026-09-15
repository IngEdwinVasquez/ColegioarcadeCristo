import { useMemo, useRef, useState } from 'react'
import { Button, Card, Select, Spinner, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { DocumentPdfRegular } from '@fluentui/react-icons'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf } from '../../services/sigerdAi'
import { listEntraUsers } from '../../services/entraUsers'
import { genId } from '../../utils/helpers'
import { asignaturaDe, cursoNombre, isRealSubject, ordenarCursos } from '../../utils/academic'
import type { Enrollment, Student } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
})

/**
 * Importa la relación de estudiantes de un PDF del SIGERD (uno por curso):
 * crea/actualiza la ficha del estudiante, vincula su cuenta de Microsoft 365
 * por nombre y lo matricula en el curso seleccionado.
 */
export function ImportarSigerdCard() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment)

  const [curso, setCurso] = useState('')
  const [period, setPeriod] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cursos = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => cursoNombre(g)),
    [grades],
  )
  const cursoMaterias = useMemo(
    () => grades.filter((g) => isRealSubject(asignaturaDe(g)) && cursoNombre(g) === curso),
    [grades, curso],
  )
  const periodActive = periods.find((p) => p.id === period)?.isActive ?? false

  const procesar = async (file: File | undefined) => {
    if (!file) return
    if (!curso || !periodActive || cursoMaterias.length === 0) {
      toaster.dispatchToast('Selecciona un curso y un período activo.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      const text = await extractPdfText(file)
      const parsed = await parseSigerdStudentsPdf(text)
      if (parsed.length === 0) throw new Error('No se encontraron estudiantes en el PDF del SIGERD.')

      let dir: Array<{ id: string; displayName?: string; email?: string }> = []
      try { dir = await listEntraUsers() } catch { dir = [] }
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
      const dirByName = new Map(dir.map((u) => [norm(u.displayName ?? ''), u]))
      const isoNac = (d?: string) => {
        const m = (d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
        return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
      }

      let created = 0
      let enrolled = 0
      let linked = 0
      for (const s of parsed) {
        const fullName = `${s.nombres} ${s.primerApellido} ${s.segundoApellido}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const alt = `${s.primerApellido} ${s.segundoApellido} ${s.nombres}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const match = dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt))
        if (match) linked += 1
        const existing = studentsCol.items.find((st) => (s.idEstudiante && st.sigerdId === s.idEstudiante) || norm(st.fullName) === norm(fullName))
        const student: Student = existing
          ? { ...existing, fullName, email: match?.email ?? existing.email, userId: match?.id ?? existing.userId, sigerdId: s.idEstudiante || existing.sigerdId, birthDate: isoNac(s.nacimiento) ?? existing.birthDate }
          : { id: genId('stu'), fullName, email: match?.email, userId: match?.id, sigerdId: s.idEstudiante, gradeId: cursoMaterias[0].id, birthDate: isoNac(s.nacimiento) }
        if (!existing) created += 1
        await studentsCol.save(student)
        const already = enrollmentsCol.items.some((e) => e.studentId === student.id && (!period || e.periodId === period))
        if (!already) {
          await enrollmentsCol.save({ id: genId('enr'), studentId: student.id, gradeId: cursoMaterias[0].id, periodId: period })
          enrolled += 1
        }
      }
      toaster.dispatchToast(`SIGERD: ${parsed.length} leído(s), ${created} nuevo(s), ${enrolled} matriculado(s), ${linked} vinculado(s) a Microsoft 365.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo procesar el PDF del SIGERD.', { intent: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card className={styles.card}>
      <Text weight="semibold" size={400}>Importar estudiantes desde PDF del SIGERD</Text>
      <Text size={200} style={{ color: 'var(--texto-suave)' }}>
        Sube el reporte del SIGERD (uno por curso). Se crea/actualiza la ficha de cada estudiante, se vincula su cuenta de Microsoft 365 por nombre y se le matricula en el curso.
      </Text>
      <FieldRow>
        <FormField label="Curso" required>
          <Select value={curso} onChange={(_, d) => setCurso(d.value)}>
            <option value="">— Selecciona un curso —</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Período" required hint={periodActive ? 'Período activo' : 'Debe ser un período ACTIVO'}>
          <Select value={period} onChange={(_, d) => setPeriod(d.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
          </Select>
        </FormField>
      </FieldRow>
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void procesar(e.target.files?.[0])} />
      <div>
        <Button
          appearance="primary"
          icon={busy ? <Spinner size="tiny" /> : <DocumentPdfRegular />}
          disabled={busy || !curso || !periodActive}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Procesando…' : 'Cargar PDF SIGERD y crear registros'}
        </Button>
      </div>
    </Card>
  )
}
