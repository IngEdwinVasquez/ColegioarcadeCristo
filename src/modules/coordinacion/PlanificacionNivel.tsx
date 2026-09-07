import { useMemo, useState } from 'react'
import { Badge, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { OpenRegular, PrintRegular, DocumentRegular, CalendarLtrRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import { exportPlanWord, printPlan } from '../planificacion/exportPlan'
import type { ClassPlan, DailyPlan } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  small: { color: tokens.colorNeutralForeground2 },
  kv: { display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 14px', fontSize: '13.5px', lineHeight: 1.5 },
  kvLabel: { color: 'var(--texto-suave)', fontWeight: 600 },
})

interface Row {
  key: string
  kind: 'annual' | 'daily'
  plan?: ClassPlan
  daily?: DailyPlan
  teacherId: string
  gradeId: string
  subjectId: string
  tema: string
  fecha: string
  tipoLabel: string
  status?: string
}

export function PlanificacionNivel() {
  const styles = useStyles()
  const { teachers, grades, subjectById, gradeById, teacherById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const dailyCol = useCollection<DailyPlan>(dataService.getDailyPlans)

  const [teacherFilter, setTeacherFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [viewing, setViewing] = useState<Row | null>(null)

  const levelGradeIds = useMemo(() => grades.filter((g) => g.level === level).map((g) => g.id), [grades, level])
  const levelGrades = useMemo(() => grades.filter((g) => levelGradeIds.includes(g.id)), [grades, levelGradeIds])
  const levelTeachers = useMemo(() => teachers.filter((t) => t.grades.some((g) => levelGradeIds.includes(g))), [teachers, levelGradeIds])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    plansCol.items
      .filter((p) => levelGradeIds.includes(p.gradeId))
      .forEach((p) => out.push({ key: `a-${p.id}`, kind: 'annual', plan: p, teacherId: p.teacherId, gradeId: p.gradeId, subjectId: p.subjectId, tema: p.topic, fecha: p.date, tipoLabel: 'Anual', status: p.status }))
    dailyCol.items
      .filter((p) => levelGradeIds.includes(p.gradeId))
      .forEach((p) => out.push({ key: `d-${p.id}`, kind: 'daily', daily: p, teacherId: p.teacherId, gradeId: p.gradeId, subjectId: p.subjectId, tema: p.tema, fecha: p.fecha, tipoLabel: p.tipo === 'unidad' ? 'Unidad' : 'Diaria' }))
    return out
      .filter((r) => !teacherFilter || r.teacherId === teacherFilter)
      .filter((r) => !gradeFilter || r.gradeId === gradeFilter)
      .filter((r) => !kindFilter || (kindFilter === 'annual' ? r.kind === 'annual' : r.kind === 'daily'))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [plansCol.items, dailyCol.items, levelGradeIds, teacherFilter, gradeFilter, kindFilter])

  return (
    <div>
      <PageHeader
        title="Planificación del nivel"
        subtitle="Visión de las planificaciones (anual, diaria y de unidad) de los docentes del nivel, para acompañar y verificar su alineación con el currículo MINERD."
      />
      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>

      <div className={styles.filterRow}>
        <Select value={teacherFilter} onChange={(_, d) => setTeacherFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los docentes</option>
          {levelTeachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
        </Select>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '150px' }}>
          <option value="">Todos los cursos</option>
          {levelGrades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
        </Select>
        <Select value={kindFilter} onChange={(_, d) => setKindFilter(d.value)} style={{ minWidth: '150px' }}>
          <option value="">Anual, diaria y unidad</option>
          <option value="annual">Solo anual</option>
          <option value="daily">Solo diaria/unidad</option>
        </Select>
      </div>

      {rows.length === 0 && !plansCol.loading && !dailyCol.loading && (
        <EmptyStateView title="Sin planificaciones" message="No hay planificaciones de este nivel. Los docentes crean sus planificaciones desde su portal." icon={<CalendarLtrRegular />} />
      )}

      {rows.length > 0 && (
        <Table aria-label="Planificación del nivel">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Docente</TableHeaderCell>
              <TableHeaderCell>Curso</TableHeaderCell>
              <TableHeaderCell>Asignatura</TableHeaderCell>
              <TableHeaderCell>Tema</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className={styles.cell}><Badge appearance="tint" color={r.kind === 'annual' ? 'brand' : 'informative'}>{r.tipoLabel}</Badge></TableCell>
                <TableCell className={styles.cell}>{formatDate(r.fecha)}</TableCell>
                <TableCell className={styles.cell}><Text weight="semibold">{teacherById(r.teacherId)?.fullName ?? '—'}</Text></TableCell>
                <TableCell className={styles.cell}>{gradeById(r.gradeId)?.name ?? '—'}</TableCell>
                <TableCell className={styles.cell}>{subjectById(r.subjectId)?.name ?? '—'}</TableCell>
                <TableCell className={styles.cell}>{r.tema}</TableCell>
                <TableCell className={styles.cell}>{r.status ? <StatusBadge status={r.status} /> : '—'}</TableCell>
                <TableCell className={styles.cell}>
                  <Toolbar size="small" style={{ gap: '4px' }}>
                    <ToolbarButton icon={<OpenRegular />} onClick={() => setViewing(r)}>Ver</ToolbarButton>
                    {r.daily && (
                      <>
                        <ToolbarButton icon={<DocumentRegular />} onClick={() => exportPlanWord(r.daily!, subjectById(r.subjectId)?.name ?? '', gradeById(r.gradeId)?.name ?? '')}>Word</ToolbarButton>
                        <ToolbarButton icon={<PrintRegular />} onClick={() => printPlan(r.daily!, subjectById(r.subjectId)?.name ?? '', gradeById(r.gradeId)?.name ?? '')}>PDF</ToolbarButton>
                      </>
                    )}
                  </Toolbar>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ModalForm open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} title={`Planificación · ${viewing?.tipoLabel ?? ''}`} subtitle={viewing ? `${teacherById(viewing.teacherId)?.fullName ?? ''} · ${gradeById(viewing.gradeId)?.name ?? ''}` : ''} width={720}>
        {viewing && <PlanDetail row={viewing} styles={styles} />}
      </ModalForm>
    </div>
  )
}

function PlanDetail({ row, styles }: { row: Row; styles: ReturnType<typeof useStyles> }) {
  const { subjectById, gradeById, teacherById } = useApp()
  const subjectName = (id: string) => subjectById(id)?.name ?? id
  if (row.daily) {
    const d = row.daily
    return (
      <div className={styles.kv}>
        <span className={styles.kvLabel}>Docente</span><span>{teacherById(d.teacherId)?.fullName ?? '—'}</span>
        <span className={styles.kvLabel}>Curso</span><span>{gradeById(d.gradeId)?.name ?? '—'}</span>
        <span className={styles.kvLabel}>Asignatura</span><span>{subjectName(d.subjectId)}</span>
        <span className={styles.kvLabel}>Nivel</span><span>{d.nivel}</span>
        <span className={styles.kvLabel}>Unidad</span><span>{d.unidad || '—'}</span>
        <span className={styles.kvLabel}>Duración</span><span>{d.duracion}</span>
        <span className={styles.kvLabel}>Competencias fundamentales</span><span>{d.competenciasFundamentales.join(', ') || '—'}</span>
        <span className={styles.kvLabel}>Competencias específicas</span><span>{d.competenciasEspecificas.join(', ') || '—'}</span>
        <span className={styles.kvLabel}>Ejes transversales</span><span>{d.ejesTransversales.join(', ') || '—'}</span>
        <span className={styles.kvLabel}>Contenidos</span><span>{d.contenidos.conceptuales}<br />{d.contenidos.procedimentales}<br />{d.contenidos.actitudinales}</span>
        <span className={styles.kvLabel}>Actividades</span><span><b>Inicio:</b> {d.actividades.inicio}<br /><b>Desarrollo:</b> {d.actividades.desarrollo}<br /><b>Cierre:</b> {d.actividades.cierre}</span>
        <span className={styles.kvLabel}>Indicadores</span><span>{d.indicadoresLogro.join(' • ') || '—'}</span>
        <span className={styles.kvLabel}>Evaluación</span><span>{d.evaluacion.tipo} · {d.evaluacion.instrumento}<br />{d.evaluacion.criterios}</span>
      </div>
    )
  }
  const p = row.plan!
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>Docente</span><span>{teacherById(p.teacherId)?.fullName ?? '—'}</span>
      <span className={styles.kvLabel}>Curso</span><span>{gradeById(p.gradeId)?.name ?? '—'}</span>
      <span className={styles.kvLabel}>Asignatura</span><span>{subjectName(p.subjectId)}</span>
      <span className={styles.kvLabel}>Periodo</span><span>{p.period}</span>
      <span className={styles.kvLabel}>Objetivo</span><span>{p.objective || '—'}</span>
      <span className={styles.kvLabel}>Contenido</span><span>{p.content || '—'}</span>
      <span className={styles.kvLabel}>Estrategia</span><span>{p.strategy || '—'}</span>
      <span className={styles.kvLabel}>Recursos</span><span>{p.resources || '—'}</span>
      <span className={styles.kvLabel}>Evaluación</span><span>{p.evaluation || '—'}</span>
    </div>
  )
}
