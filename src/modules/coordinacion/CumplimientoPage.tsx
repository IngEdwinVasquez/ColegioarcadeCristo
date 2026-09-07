import { useMemo, useState } from 'react'
import { Badge, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { StatCard } from '../../components/shared/StatCard'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { CheckmarkCircleRegular, NotebookRegular, CalendarCheckmarkRegular } from '@fluentui/react-icons'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import type { ClassPlan, SchoolClassRecord } from '../../types'
import { pct } from '../../utils/helpers'

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  small: { color: tokens.colorNeutralForeground2 },
  barWrap: { width: '120px', height: '8px', borderRadius: '999px', background: 'var(--borde)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: '999px' },
})

export function CumplimientoPage() {
  const styles = useStyles()
  const { teachers, grades, gradeById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)

  const [teacherFilter, setTeacherFilter] = useState('')

  const levelGradeIds = useMemo(() => grades.filter((g) => g.level === level).map((g) => g.id), [grades, level])
  const levelTeachers = useMemo(() => teachers.filter((t) => t.grades.some((g) => levelGradeIds.includes(g))), [teachers, levelGradeIds])

  const rows = useMemo(() => {
    return levelTeachers
      .map((t) => {
        const plans = plansCol.items.filter((p) => p.teacherId === t.id && levelGradeIds.includes(p.gradeId))
        const impartidas = plans.filter((p) => p.status === 'impartida').length
        const clases = classesCol.items.filter((c) => c.teacherId === t.id && levelGradeIds.includes(c.gradeId))
        const cumplimiento = pct(impartidas, plans.length)
        return { teacher: t, planes: plans.length, impartidas, clases: clases.length, cumplimiento }
      })
      .filter((r) => !teacherFilter || r.teacher.id === teacherFilter)
      .sort((a, b) => (a.cumplimiento === b.cumplimiento ? b.planes - a.planes : b.cumplimiento - a.cumplimiento))
  }, [levelTeachers, plansCol.items, classesCol.items, levelGradeIds, teacherFilter])

  const totalPlanes = rows.reduce((s, r) => s + r.planes, 0)
  const totalImpartidas = rows.reduce((s, r) => s + r.impartidas, 0)
  const totalClases = rows.reduce((s, r) => s + r.clases, 0)

  return (
    <div>
      <PageHeader
        title="Verificación de cumplimiento"
        subtitle="Compare lo planificado vs. lo impartido por cada docente del nivel, para verificar la fiel ejecución del currículo (MINERD)."
      />
      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>

      <div className={styles.kpis}>
        <StatCard title="Planificaciones" value={totalPlanes} icon={<NotebookRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub="En el nivel seleccionado" />
        <StatCard title="Clases impartidas" value={totalImpartidas} icon={<CheckmarkCircleRegular />} color="#15803D" gradient={gradientes.verde} sub="Con registro antes/durante/después" />
        <StatCard title="Clases registradas" value={totalClases} icon={<CalendarCheckmarkRegular />} color="#0082AD" gradient={gradientes.azul} sub="Repositorio de clases" />
      </div>

      <div className={styles.filterRow}>
        <Select value={teacherFilter} onChange={(_, d) => setTeacherFilter(d.value)} style={{ minWidth: '200px' }}>
          <option value="">Todos los docentes</option>
          {levelTeachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
        </Select>
      </div>

      {rows.length === 0 && !plansCol.loading && (
        <EmptyStateView title="Sin datos" message="No hay docentes o planificaciones para este nivel." />
      )}

      {rows.length > 0 && (
        <Table aria-label="Cumplimiento docente">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Docente</TableHeaderCell>
              <TableHeaderCell>Cursos</TableHeaderCell>
              <TableHeaderCell>Planificadas</TableHeaderCell>
              <TableHeaderCell>Impartidas</TableHeaderCell>
              <TableHeaderCell>% Cumplimiento</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.teacher.id}>
                <TableCell className={styles.cell}><Text weight="semibold">{r.teacher.fullName}</Text></TableCell>
                <TableCell className={styles.cell}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {r.teacher.grades.filter((g) => levelGradeIds.includes(g)).slice(0, 3).map((g) => (
                      <Badge key={g} appearance="tint" color="informative">{gradeById(g)?.name ?? g}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className={styles.cell}>{r.planes}</TableCell>
                <TableCell className={styles.cell}>{r.impartidas}</TableCell>
                <TableCell className={styles.cell}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className={styles.barWrap}>
                      <div className={styles.bar} style={{ width: `${r.cumplimiento}%`, background: r.cumplimiento >= 80 ? '#15803D' : r.cumplimiento >= 60 ? '#EA580C' : '#E62327' }} />
                    </div>
                    <Text size={300} weight="semibold">{r.cumplimiento}%</Text>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
