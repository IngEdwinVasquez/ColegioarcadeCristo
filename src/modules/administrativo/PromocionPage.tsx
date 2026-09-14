import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { ArrowUpRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Enrollment, GradeSection, Student } from '../../types'
import { genId } from '../../utils/helpers'
import { cursoNombre } from '../../utils/academic'

const useStyles = makeStyles({
  cell: { verticalAlign: 'middle' },
  filters: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' },
})

const LEVEL_ORDER = ['Nivel Inicial', 'Nivel Primario', 'Nivel Secundario']

function suggestedNext(currentId: string, grades: GradeSection[]): string | undefined {
  const sorted = [...grades].sort((a, b) => {
    const la = LEVEL_ORDER.indexOf(a.level)
    const lb = LEVEL_ORDER.indexOf(b.level)
    if (la !== lb) return la - lb
    const na = parseInt(a.name, 10) || 0
    const nb = parseInt(b.name, 10) || 0
    if (na !== nb) return na - nb
    return a.name.localeCompare(b.name)
  })
  const idx = sorted.findIndex((g) => g.id === currentId)
  if (idx >= 0 && idx < sorted.length - 1) return sorted[idx + 1].id
  return undefined
}

export function PromocionPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, gradeById, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment, dataService.deleteEnrollment)

  const [cursoActual, setCursoActual] = useState('')
  const [targetCurso, setTargetCurso] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const activePeriodId = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''

  // Todos los cursos existentes (Grado + Sección + Nivel), sin repetir.
  const cursos = useMemo(() => {
    const map = new Map<string, GradeSection>()
    for (const g of grades) {
      const n = cursoNombre(g)
      if (!map.has(n)) map.set(n, g)
    }
    return [...map.keys()].sort((a, b) => a.localeCompare(b))
  }, [grades])

  // Estudiantes del curso seleccionado (por matrícula del período o por su curso).
  const studentsOfCourse = useMemo(() => {
    if (!cursoActual) return []
    const byEnroll = new Set(
      enrollmentsCol.items
        .filter((e) => !activePeriodId || e.periodId === activePeriodId)
        .filter((e) => {
          const g = gradeById(e.gradeId)
          return !!g && cursoNombre(g) === cursoActual
        })
        .map((e) => e.studentId),
    )
    const q = search.trim().toLowerCase()
    return studentsCol.items
      .filter((s) => {
        const belongs = byEnroll.has(s.id) || (() => {
          const g = gradeById(s.gradeId)
          return !!g && cursoNombre(g) === cursoActual
        })()
        return belongs && (!q || s.fullName.toLowerCase().includes(q))
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [cursoActual, enrollmentsCol.items, studentsCol.items, gradeById, activePeriodId, search])

  // Al cambiar de curso: limpiar selección y sugerir el siguiente curso.
  useEffect(() => {
    setSelected([])
    if (!cursoActual) { setTargetCurso(''); return }
    const rep = grades.find((g) => cursoNombre(g) === cursoActual)
    const next = rep ? suggestedNext(rep.id, grades) : undefined
    const nextG = next ? gradeById(next) : undefined
    setTargetCurso(nextG ? cursoNombre(nextG) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoActual])

  const allSelected = studentsOfCourse.length > 0 && studentsOfCourse.every((s) => selected.includes(s.id))
  const someSelected = studentsOfCourse.some((s) => selected.includes(s.id))

  const toggleAll = (checked: boolean) => setSelected(checked ? studentsOfCourse.map((s) => s.id) : [])
  const toggle = (id: string, checked: boolean) => setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))

  const promover = async () => {
    if (!cursoActual || !targetCurso) {
      toaster.dispatchToast('Selecciona el curso actual y el curso sugerido.', { intent: 'error' })
      return
    }
    if (targetCurso === cursoActual) {
      toaster.dispatchToast('El curso sugerido debe ser diferente al curso actual.', { intent: 'error' })
      return
    }
    if (selected.length === 0) {
      toaster.dispatchToast('Marca al menos un estudiante para promover.', { intent: 'error' })
      return
    }
    const repTarget = grades.find((g) => cursoNombre(g) === targetCurso)
    if (!repTarget) {
      toaster.dispatchToast('El curso sugerido no existe.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let count = 0
      for (const studentId of selected) {
        const student = studentsCol.items.find((s) => s.id === studentId)
        if (!student) continue
        await studentsCol.save({ ...student, gradeId: repTarget.id })
        const enrollment = enrollmentsCol.items.find((e) => e.studentId === studentId && (!activePeriodId || e.periodId === activePeriodId))
        if (enrollment) await enrollmentsCol.save({ ...enrollment, gradeId: repTarget.id, periodId: enrollment.periodId || activePeriodId })
        else await enrollmentsCol.save({ id: genId('enr'), studentId, gradeId: repTarget.id, periodId: activePeriodId })
        count += 1
      }
      toaster.dispatchToast(`${count} estudiante(s) promovido(s) a «${targetCurso}».`, { intent: 'success' })
      setSelected([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron promover los estudiantes.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Promoción de estudiantes"
        subtitle="Selecciona un curso, marca los estudiantes y promuévelos al curso sugerido. Al promover se actualiza su matrícula."
      />

      <div className={styles.filters}>
        <FormField label="Curso actual" required>
          <Select value={cursoActual} onChange={(_, d) => setCursoActual(d.value)} style={{ minWidth: '240px' }}>
            <option value="">— Selecciona un curso —</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Curso sugerido" required>
          <Select value={targetCurso} onChange={(_, d) => setTargetCurso(d.value)} style={{ minWidth: '240px' }}>
            <option value="">— Selecciona el curso destino —</option>
            {cursos.map((c) => <option key={c} value={c} disabled={c === cursoActual}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Buscar">
          <Input value={search} onChange={(_, d) => setSearch(d.value)} placeholder="Buscar estudiante…" style={{ minWidth: '200px' }} />
        </FormField>
        <span style={{ flex: 1 }} />
        <Button appearance="primary" icon={<ArrowUpRegular />} disabled={busy || !cursoActual || !targetCurso || selected.length === 0} onClick={() => void promover()}>
          {busy ? 'Promoviendo…' : `Promover (${selected.length})`}
        </Button>
      </div>

      {!cursoActual ? (
        <EmptyStateView title="Selecciona un curso" message="Elige un curso actual para ver a sus estudiantes y promoverlos." />
      ) : studentsOfCourse.length === 0 ? (
        <EmptyStateView title="Sin estudiantes" message="Este curso no tiene estudiantes matriculados." />
      ) : (
        <Table aria-label="Promoción">
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: '48px' }}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'mixed' : false}
                  onChange={(_, d) => toggleAll(!!d.checked)}
                  aria-label="Seleccionar todos"
                />
              </TableHeaderCell>
              <TableHeaderCell>Estudiante</TableHeaderCell>
              <TableHeaderCell>Curso actual</TableHeaderCell>
              <TableHeaderCell>Curso sugerido</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentsOfCourse.map((s) => (
              <TableRow key={s.id}>
                <TableCell className={styles.cell}>
                  <Checkbox checked={selected.includes(s.id)} onChange={(_, d) => toggle(s.id, !!d.checked)} aria-label={`Seleccionar ${s.fullName}`} />
                </TableCell>
                <TableCell className={styles.cell}><Text weight="semibold">{s.fullName}</Text></TableCell>
                <TableCell className={styles.cell}>{cursoActual}</TableCell>
                <TableCell className={styles.cell}>{targetCurso || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <FieldRow>
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>
          {studentsOfCourse.length} estudiante(s) en el curso · {selected.length} marcado(s)
        </Text>
      </FieldRow>
    </div>
  )
}
