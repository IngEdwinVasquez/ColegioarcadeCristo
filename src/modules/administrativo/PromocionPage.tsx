import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { ArrowUpRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Enrollment, GradeSection, PromotionRecord, Student } from '../../types'
import { formatDate, genId } from '../../utils/helpers'
import { cursoNombre, cursoNombresOrdenados, gradoDe, nivelShort, seccionDe } from '../../utils/academic'

const useStyles = makeStyles({
  cell: { verticalAlign: 'middle' },
  filters: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' },
  sectionTitle: { margin: '24px 0 8px' },
})

const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to']
const EGRESADO = 'Egresado'

/**
 * Calcula el curso siguiente aplicando las transiciones del sistema educativo:
 * - Inicial (pre-primario) → 1ro de Primaria
 * - 6to de Primaria → 1ro de Secundaria
 * - 6to de Secundaria → Egresado
 * Conserva la sección cuando es posible.
 */
function siguienteCurso(curso: string, grades: GradeSection[]): string | undefined {
  const g = grades.find((x) => cursoNombre(x) === curso)
  if (!g) return undefined
  const nivel = nivelShort(g.level)
  const grado = gradoDe(g)
  const seccion = seccionDe(g)
  const all = [...new Set(grades.map(cursoNombre))]

  const findCurso = (gr: string, nv: string): string | undefined => {
    const exact = `${gr}.${seccion} · ${nv}`
    if (all.includes(exact)) return exact
    return all.find((n) => n.includes(`${gr}.`) && n.endsWith(`· ${nv}`))
  }

  if (nivel === 'Inicial') {
    return findCurso('1ro', 'Primaria')
  }
  if (nivel === 'Primaria') {
    const idx = GRADOS.indexOf(grado)
    if (idx >= 0 && idx < 5) return findCurso(GRADOS[idx + 1], 'Primaria')
    return findCurso('1ro', 'Secundaria')
  }
  if (nivel === 'Secundaria') {
    const idx = GRADOS.indexOf(grado)
    if (idx >= 0 && idx < 5) return findCurso(GRADOS[idx + 1], 'Secundaria')
    return EGRESADO
  }
  return undefined
}

export function PromocionPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, gradeById, periods, user } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment, dataService.deleteEnrollment)
  const promotionsCol = useCollection<PromotionRecord>(dataService.getPromotions, dataService.savePromotion, dataService.deletePromotion)

  const [cursoActual, setCursoActual] = useState('')
  const [targetCurso, setTargetCurso] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const activePeriodId = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''

  // Todos los cursos existentes (Grado + Sección + Nivel) + Egresado.
  const cursos = useMemo(() => cursoNombresOrdenados(grades, true), [grades])
  const cursosDestino = useMemo(() => [...cursos, EGRESADO], [cursos])

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

  useEffect(() => {
    setSelected([])
    if (!cursoActual) { setTargetCurso(''); return }
    setTargetCurso(siguienteCurso(cursoActual, grades) ?? '')
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
    const esEgreso = targetCurso === EGRESADO
    const repTarget = esEgreso ? undefined : grades.find((g) => cursoNombre(g) === targetCurso)
    if (!esEgreso && !repTarget) {
      toaster.dispatchToast('El curso sugerido no existe.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let count = 0
      for (const studentId of selected) {
        const student = studentsCol.items.find((s) => s.id === studentId)
        if (!student) continue
        const date = new Date().toISOString()
        if (esEgreso) {
          await studentsCol.save({ ...student, gradeId: '' })
          const ens = enrollmentsCol.items.filter((e) => e.studentId === studentId && (!activePeriodId || e.periodId === activePeriodId))
          for (const e of ens) await enrollmentsCol.remove(e.id)
        } else {
          await studentsCol.save({ ...student, gradeId: repTarget!.id })
          const enrollment = enrollmentsCol.items.find((e) => e.studentId === studentId && (!activePeriodId || e.periodId === activePeriodId))
          if (enrollment) await enrollmentsCol.save({ ...enrollment, gradeId: repTarget!.id, periodId: enrollment.periodId || activePeriodId })
          else await enrollmentsCol.save({ id: genId('enr'), studentId, gradeId: repTarget!.id, periodId: activePeriodId })
        }
        await promotionsCol.save({ id: genId('promo'), studentId, studentName: student.fullName, fromCurso: cursoActual, toCurso: targetCurso, periodId: activePeriodId, date, promotedBy: user?.displayName })
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

  const historial = useMemo(() => [...promotionsCol.items].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 100), [promotionsCol.items])

  return (
    <div>
      <PageHeader
        title="Promoción de estudiantes"
        subtitle="Selecciona un curso, marca los estudiantes y promuévelos al curso sugerido. Se guarda el historial de cada promoción."
      />

      <div className={styles.filters}>
        <FormField label="Curso actual" required>
          <Select value={cursoActual} onChange={(_, d) => setCursoActual(d.value)} style={{ minWidth: '240px' }}>
            <option value="">— Selecciona un curso —</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Curso sugerido" required hint="Puedes cambiarlo por cualquier curso o «Egresado».">
          <Select value={targetCurso} onChange={(_, d) => setTargetCurso(d.value)} style={{ minWidth: '240px' }}>
            <option value="">— Selecciona el curso destino —</option>
            {cursosDestino.map((c) => <option key={c} value={c} disabled={c === cursoActual}>{c}</option>)}
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
                <Checkbox checked={allSelected ? true : someSelected ? 'mixed' : false} onChange={(_, d) => toggleAll(!!d.checked)} aria-label="Seleccionar todos" />
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

      <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '8px' }}>
        {studentsOfCourse.length} estudiante(s) en el curso · {selected.length} marcado(s)
      </Text>

      <Text weight="semibold" size={400} block className={styles.sectionTitle}>Historial de promoción ({promotionsCol.items.length})</Text>
      {promotionsCol.loading ? (
        <Text size={200}>Cargando historial…</Text>
      ) : historial.length === 0 ? (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Aún no hay promociones registradas.</Text>
      ) : (
        <Table aria-label="Historial de promoción">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Estudiante</TableHeaderCell>
              <TableHeaderCell>De</TableHeaderCell>
              <TableHeaderCell>A</TableHeaderCell>
              <TableHeaderCell>Promovido por</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historial.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.date.slice(0, 10))}</TableCell>
                <TableCell><Text weight="semibold">{p.studentName}</Text></TableCell>
                <TableCell>{p.fromCurso}</TableCell>
                <TableCell>{p.toCurso}</TableCell>
                <TableCell>{p.promotedBy ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
