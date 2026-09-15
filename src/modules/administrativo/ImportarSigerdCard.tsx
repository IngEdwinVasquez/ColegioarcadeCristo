import { useMemo, useRef, useState } from 'react'
import { Button, Card, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { DocumentPdfRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf, type SigerdStudent } from '../../services/sigerdAi'
import { listEntraUsers } from '../../services/entraUsers'
import { genId } from '../../utils/helpers'
import { GRADOS, asignaturaDe, cursoNombre, gradoDe, isRealSubject, ordenarCursos, seccionDe } from '../../utils/academic'
import type { Enrollment, Student } from '../../types'

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
})

interface DirUser { id: string; displayName?: string; email?: string }
interface PreviewRow { s: SigerdStudent; fullName: string; match?: DirUser }

const GRADO_WORD: Record<string, number> = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6,
  '1ro': 1, '2do': 2, '3ro': 3, '4to': 4, '5to': 5, '6to': 6,
}
const numGrado = (g?: string) => GRADO_WORD[(g ?? '').trim().toLowerCase()] ?? null
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const isoNac = (d?: string) => {
  const m = (d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
}

/**
 * Importa la relación de estudiantes de un PDF del SIGERD (uno por curso):
 * detecta el curso desde Grado/Sección, previsualiza los estudiantes, vincula la
 * cuenta de Microsoft 365 por nombre y los matricula en el curso.
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
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
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

  /** Detecta el curso a partir del Grado/Sección más frecuente en el PDF. */
  const detectarCurso = (students: SigerdStudent[]): string | undefined => {
    const counts = new Map<string, number>()
    for (const s of students) {
      const n = numGrado(s.grado)
      const sec = (s.seccion || '').trim().toUpperCase()
      if (!n || !sec) continue
      const key = `${GRADOS[n - 1]}|${sec}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    let best: string | undefined
    let bestCount = 0
    for (const [k, c] of counts) if (c > bestCount) { bestCount = c; best = k }
    if (!best) return undefined
    const [grado, sec] = best.split('|')
    const found = grades.find((g) => isRealSubject(asignaturaDe(g)) && gradoDe(g) === grado && seccionDe(g) === sec)
    return found ? cursoNombre(found) : undefined
  }

  const analizar = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const text = await extractPdfText(file)
      const parsed = await parseSigerdStudentsPdf(text)
      if (parsed.length === 0) throw new Error('No se encontraron estudiantes en el PDF del SIGERD.')

      let dir: DirUser[] = []
      try { dir = await listEntraUsers() } catch { dir = [] }
      const dirByName = new Map(dir.map((u) => [norm(u.displayName ?? ''), u]))

      const rows: PreviewRow[] = parsed.map((s) => {
        const fullName = `${s.nombres} ${s.primerApellido} ${s.segundoApellido}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const alt = `${s.primerApellido} ${s.segundoApellido} ${s.nombres}`.replace(/\s+/g, ' ').trim().toUpperCase()
        return { s, fullName, match: dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt)) }
      })

      const detectado = detectarCurso(parsed)
      if (detectado) setCurso(detectado)
      setPreview(rows)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo procesar el PDF del SIGERD.', { intent: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmar = async () => {
    if (!preview || preview.length === 0) return
    if (!curso || !periodActive || cursoMaterias.length === 0) {
      toaster.dispatchToast('Selecciona un curso y un período activo.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let created = 0
      let enrolled = 0
      let linked = 0
      for (const row of preview) {
        const { s, fullName, match } = row
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
      toaster.dispatchToast(`SIGERD: ${created} nuevo(s), ${enrolled} matriculado(s), ${linked} vinculado(s) a Microsoft 365.`, { intent: 'success' })
      setPreview(null)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron crear los registros.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card className={styles.card}>
        <Text weight="semibold" size={400}>Importar estudiantes desde PDF del SIGERD</Text>
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>
          Sube el reporte del SIGERD (uno por curso). Se detecta el curso por Grado/Sección, se previsualizan los estudiantes, se vincula su cuenta de Microsoft 365 por nombre y se matriculan.
        </Text>
        <FieldRow>
          <FormField label="Curso" required hint="Se detecta automáticamente desde el PDF (puedes cambiarlo).">
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
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void analizar(e.target.files?.[0])} />
        <div>
          <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <DocumentPdfRegular />} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Procesando…' : 'Cargar PDF SIGERD y previsualizar'}
          </Button>
        </div>
      </Card>

      <ModalForm
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null) }}
        title="Previsualización · Estudiantes del SIGERD"
        subtitle={`${preview?.length ?? 0} estudiante(s) · Curso destino: ${curso || 'no seleccionado'}`}
        width={980}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || !curso || !periodActive} onClick={() => void confirmar()}>
              {busy ? 'Procesando…' : 'Crear y matricular'}
            </Button>
          </>
        }
      >
        {preview && (
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <Table aria-label="Estudiantes detectados" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Id SIGERD</TableHeaderCell>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Nacimiento</TableHeaderCell>
                  <TableHeaderCell>Grado</TableHeaderCell>
                  <TableHeaderCell>Sec.</TableHeaderCell>
                  <TableHeaderCell>Cuenta M365</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={`${row.s.idEstudiante}-${i}`}>
                    <TableCell>{row.s.idEstudiante || '—'}</TableCell>
                    <TableCell><Text weight="semibold">{row.fullName}</Text></TableCell>
                    <TableCell>{row.s.nacimiento || '—'}</TableCell>
                    <TableCell>{row.s.grado || '—'}</TableCell>
                    <TableCell>{row.s.seccion || '—'}</TableCell>
                    <TableCell>{row.match?.email ? row.match.email : <Text size={200} style={{ color: '#B42318' }}>Sin coincidencia</Text>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ModalForm>
    </>
  )
}
