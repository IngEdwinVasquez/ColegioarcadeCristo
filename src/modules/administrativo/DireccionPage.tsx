import { useMemo, useState } from 'react'
import { Button, Card, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { CalendarCheckmarkRegular, StarRegular, NotebookRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { GruposPersonas } from './GruposPersonas'
import { PortalesActividad } from './PortalesActividad'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { ClassPlan, SchoolClassRecord, AttendanceRecord, Activity, Grade, VirtualMeeting, TeacherAssignment } from '../../types'
import { formatDate, pct } from '../../utils/helpers'
import { cursoNombre, nivelShort } from '../../utils/academic'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  card: { padding: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
})

export function DireccionPage() {
  const styles = useStyles()
  const { subjects, grades, teacherById, subjectById, gradeById, studentById } = useApp()
  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)

  const [gradeFilter, setGradeFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [detalle, setDetalle] = useState<'cumplimiento' | 'asistencia' | 'rendimiento' | 'acuerdos' | null>(null)

  // Ámbito de cursos según los filtros (grado tiene prioridad sobre nivel; vacío = todo).
  const scopeIds = useMemo<Set<string> | null>(() => {
    if (gradeFilter) return new Set([gradeFilter])
    if (levelFilter) return new Set(grades.filter((g) => nivelShort(g.level) === levelFilter).map((g) => g.id))
    return null
  }, [gradeFilter, levelFilter, grades])
  const inScope = (gradeId?: string) => !scopeIds || (!!gradeId && scopeIds.has(gradeId))

  const planned = useMemo(() => plansCol.items.filter((p) => inScope(p.gradeId)), [plansCol.items, scopeIds])
  const completed = useMemo(() => classesCol.items.filter((c) => c.status === 'completada' && inScope(c.gradeId)), [classesCol.items, scopeIds])
  const attendance = useMemo(() => attendanceCol.items.filter((a) => inScope(a.gradeId)), [attendanceCol.items, scopeIds])
  const activities = useMemo(() => activitiesCol.items.filter((a) => inScope(a.gradeId)), [activitiesCol.items, scopeIds])
  const scores = useMemo(() => {
    const actGrade = new Map(activitiesCol.items.map((a) => [a.id, a.gradeId]))
    return scoresCol.items.filter((s) => inScope(actGrade.get(s.activityId)))
  }, [scoresCol.items, activitiesCol.items, scopeIds])

  const cumplimiento = planned.length ? pct(completed.length, planned.length) : 0

  const avgAttendance = useMemo(() => {
    let total = 0
    let presentes = 0
    for (const rec of attendance) {
      total += rec.entries.length
      presentes += rec.entries.filter((e) => e.status === 'presente').length
    }
    return pct(presentes, total)
  }, [attendance])

  const avgAcademic = useMemo(() => {
    if (!scores.length) return 0
    const activitiesMap = new Map(activitiesCol.items.map((a) => [a.id, a.points]))
    const normalized = scores.map((s) => {
      const points = activitiesMap.get(s.activityId) ?? 100
      return (s.score / points) * 100
    })
    return Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length)
  }, [scores, activitiesCol.items])

  const bySubject = useMemo(() => {
    return subjects.map((s) => {
      const p = planned.filter((x) => x.subjectId === s.id).length
      const c = completed.filter((x) => x.subjectId === s.id).length
      return { name: s.shortName, Planificadas: p, Impartidas: c }
    })
  }, [subjects, planned, completed])

  const byTeacher = useMemo(() => {
    return planned
      .reduce<Record<string, { plan: number; hecho: number }>>((acc, p) => {
        acc[p.teacherId] = acc[p.teacherId] ?? { plan: 0, hecho: 0 }
        acc[p.teacherId].plan++
        if (completed.some((c) => c.planId === p.id)) acc[p.teacherId].hecho++
        return acc
      }, {})
  }, [planned, completed])

  const avgBySubject = useMemo(() => {
    return subjects.map((s) => {
      const acts = activities.filter((a) => a.subjectId === s.id)
      if (!acts.length) return { name: s.shortName, promedio: 0 }
      const ids = new Set(acts.map((a) => a.id))
      const sc = scores.filter((g) => ids.has(g.activityId))
      if (!sc.length) return { name: s.shortName, promedio: 0 }
      const pointsMap = new Map(acts.map((a) => [a.id, a.points]))
      const norm = sc.map((g) => (g.score / (pointsMap.get(g.activityId) ?? 100)) * 100)
      return { name: s.shortName, promedio: Math.round(norm.reduce((a, b) => a + b, 0) / norm.length) }
    })
  }, [subjects, activities, scores])

  const dayTrend = useMemo(() => {
    const map = new Map<string, { date: string; p: number; t: number }>()
    for (const rec of attendance) {
      const e = map.get(rec.date) ?? { date: rec.date, p: 0, t: 0 }
      e.t += rec.entries.length
      e.p += rec.entries.filter((x) => x.status === 'presente').length
      map.set(rec.date, e)
    }
    return [...map.values()]
      .map((d) => ({ ...d, asistencia: pct(d.p, d.t) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [attendance])

  const pendingAgreements = useMemo(() => {
    const agreements = meetingsCol.items.flatMap((m) => (m.record?.agreements ?? []).filter((a) => a.status !== 'completado'))
    return agreements.length
  }, [meetingsCol.items])

  // Reporte por asignatura asignada: todo lo realizado por el docente en esa asignatura.
  const detalleAsignaturas = useMemo(() => {
    type Row = { key: string; subjectId: string; gradeId: string; teacherId: string; plan: number; imp: number; act: number; asi: number; cal: number }
    const map = new Map<string, Row>()
    const keyOf = (subjectId: string, gradeId: string, teacherId: string) => `${subjectId}|${gradeId}|${teacherId}`
    const ensure = (subjectId: string, gradeId: string, teacherId: string) => {
      const key = keyOf(subjectId, gradeId, teacherId)
      if (!map.has(key)) map.set(key, { key, subjectId, gradeId, teacherId, plan: 0, imp: 0, act: 0, asi: 0, cal: 0 })
      return map.get(key) as Row
    }
    const completedIds = new Set(classesCol.items.filter((c) => c.status === 'completada').map((c) => c.planId))
    for (const a of assignmentsCol.items.filter((x) => inScope(x.gradeId))) ensure(a.subjectId, a.gradeId, a.teacherId)
    for (const p of plansCol.items.filter((x) => inScope(x.gradeId))) { const e = ensure(p.subjectId, p.gradeId, p.teacherId); e.plan += 1; if (completedIds.has(p.id)) e.imp += 1 }
    for (const a of activitiesCol.items.filter((x) => inScope(x.gradeId))) ensure(a.subjectId, a.gradeId, a.teacherId).act += 1
    const actSubject = new Map(activitiesCol.items.map((a) => [a.id, a]))
    for (const s of scoresCol.items) { const act = actSubject.get(s.activityId); if (act && inScope(act.gradeId)) ensure(act.subjectId, act.gradeId, act.teacherId).cal += 1 }
    for (const r of attendanceCol.items.filter((x) => inScope(x.gradeId))) for (const e of map.values()) if (e.subjectId === r.subjectId && e.gradeId === r.gradeId) e.asi += 1
    return [...map.values()].sort((a, b) => (subjectById(a.subjectId)?.name ?? a.subjectId).localeCompare(subjectById(b.subjectId)?.name ?? b.subjectId))
  }, [assignmentsCol.items, plansCol.items, classesCol.items, activitiesCol.items, scoresCol.items, attendanceCol.items, subjectById, scopeIds])

  const pieCumplimiento = [
    { name: 'Impartidas', value: completed.length, color: '#004D6B' },
    { name: 'Pendientes', value: Math.max(planned.length - completed.length, 0), color: '#E30613' },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <PageHeader
        title="Dirección y Coordinación Pedagógica"
        subtitle="Monitoreo institucional, indicadores de rendimiento académico, supervisión docente y toma de decisiones estratégicas."
      />

      <div className={styles.filterRow}>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los grados</option>
          {grades.map((g) => (
                <option key={g.id} value={g.id}>{cursoNombre(g)}</option>
          ))}
        </Select>
        <Select value={levelFilter} onChange={(_, d) => setLevelFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los niveles</option>
          <option value="Inicial">Inicial</option>
          <option value="Primaria">Primaria</option>
          <option value="Secundaria">Secundaria</option>
        </Select>
      </div>

      <div className={styles.kpis}>
        <StatCard title="Cumplimiento de planificación" value={`${cumplimiento}%`} icon={<CalendarCheckmarkRegular />} color="#EF6C00" sub={`${completed.length} clases impartidas de ${planned.length} planificadas`} action={<Button appearance="subtle" size="small" onClick={() => setDetalle('cumplimiento')}>Verificar detalle</Button>} />
        <StatCard title="Asistencia promedio" value={`${avgAttendance}%`} icon={<NotebookRegular />} color="#0084B3" sub="Basado en el registro por asignatura" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('asistencia')}>Verificar detalle</Button>} />
        <StatCard title="Rendimiento académico" value={`${avgAcademic}/100`} icon={<StarRegular />} color="#AD1457" sub="Promedio normalizado de actividades" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('rendimiento')}>Verificar detalle</Button>} />
        <StatCard title="Acuerdos pendientes" value={pendingAgreements} icon={<CalendarCheckmarkRegular />} color="#7D1D24" sub="Derivados de encuentros virtuales" action={<Button appearance="subtle" size="small" onClick={() => setDetalle('acuerdos')}>Verificar detalle</Button>} />
      </div>

      <Text weight="semibold" size={500} block style={{ margin: '4px 0 12px' }}>Grupos de personas</Text>
      <div style={{ marginBottom: '20px' }}>
        <GruposPersonas scopeIds={scopeIds} />
      </div>

      <Text weight="semibold" size={500} block style={{ margin: '4px 0 12px' }}>Actividad y cumplimiento por portal</Text>
      <div style={{ marginBottom: '20px' }}>
        <PortalesActividad scopeIds={scopeIds} />
      </div>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Planificación vs. clases impartidas</Text>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <RTooltip />
              <Legend />
              <Bar dataKey="Planificadas" fill="#004D6B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Impartidas" fill="#E30613" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Promedio académico por asignatura</Text>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={avgBySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <RTooltip formatter={(v) => [`${v}`, 'Promedio']} />
              <Bar dataKey="promedio" fill="#0084B3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Distribución de cumplimiento</Text>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieCumplimiento} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                {pieCumplimiento.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <RTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400} block>Tendencia de asistencia</Text>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dayTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} minTickGap={16} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <RTooltip formatter={(v) => [`${v}%`, 'Asistencia']} labelFormatter={(v) => formatDate(String(v))} />
              <Line type="monotone" dataKey="asistencia" stroke="#004D6B" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400} block>Supervisión de cumplimiento por docente</Text>
          <Table aria-label="Cumplimiento por docente" style={{ marginTop: '12px' }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Docente</TableHeaderCell>
                <TableHeaderCell>Clases planificadas</TableHeaderCell>
                <TableHeaderCell>Impartidas</TableHeaderCell>
                <TableHeaderCell>Cumplimiento</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(byTeacher).map(([teacherId, v]) => (
                <TableRow key={teacherId}>
                  <TableCell>{teacherById(teacherId)?.fullName ?? teacherId}</TableCell>
                  <TableCell>{v.plan}</TableCell>
                  <TableCell>{v.hecho}</TableCell>
                  <TableCell>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: pct(v.hecho, v.plan) >= 90 ? '#2E7D32' : pct(v.hecho, v.plan) >= 60 ? '#EF6C00' : '#C8102E',
                        color: '#fff',
                      }}
                    >
                      {pct(v.hecho, v.plan)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ModalForm
        open={!!detalle}
        onOpenChange={(o) => { if (!o) setDetalle(null) }}
        title={
          detalle === 'cumplimiento' ? 'Detalle por asignatura · trabajo del docente'
            : detalle === 'asistencia' ? 'Detalle · Asistencia promedio'
              : detalle === 'rendimiento' ? 'Detalle · Rendimiento académico'
                : 'Detalle · Acuerdos pendientes'
        }
        subtitle="Informes de lo realizado por el docente en las asignaturas que le fueron asignadas (aulas por curso)."
        width={1000}
        actions={<Button appearance="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle === 'cumplimiento' && (
          <Table aria-label="Detalle por asignatura">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Asignatura</TableHeaderCell>
                <TableHeaderCell>Curso</TableHeaderCell>
                <TableHeaderCell>Docente</TableHeaderCell>
                <TableHeaderCell>Planificadas</TableHeaderCell>
                <TableHeaderCell>Impartidas</TableHeaderCell>
                <TableHeaderCell>Actividades</TableHeaderCell>
                <TableHeaderCell>Asistencia</TableHeaderCell>
                <TableHeaderCell>Calificaciones</TableHeaderCell>
                <TableHeaderCell>Cumplimiento</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalleAsignaturas.map((r) => {
                const g = gradeById(r.gradeId)
                return (
                  <TableRow key={r.key}>
                    <TableCell>{subjectById(r.subjectId)?.name ?? r.subjectId}</TableCell>
                    <TableCell>{g ? cursoNombre(g) : r.gradeId}</TableCell>
                    <TableCell>{teacherById(r.teacherId)?.fullName ?? r.teacherId}</TableCell>
                    <TableCell>{r.plan}</TableCell>
                    <TableCell>{r.imp}</TableCell>
                    <TableCell>{r.act}</TableCell>
                    <TableCell>{r.asi}</TableCell>
                    <TableCell>{r.cal}</TableCell>
                    <TableCell>{r.plan ? `${pct(r.imp, r.plan)}%` : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'asistencia' && (
          <Table aria-label="Detalle asistencia">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Curso</TableHeaderCell>
                <TableHeaderCell>Asignatura</TableHeaderCell>
                <TableHeaderCell>Presentes</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>%</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((rec) => {
                const total = rec.entries.length
                const presentes = rec.entries.filter((e) => e.status === 'presente').length
                const g = gradeById(rec.gradeId)
                return (
                  <TableRow key={rec.id}>
                    <TableCell>{formatDate(rec.date)}</TableCell>
                    <TableCell>{g ? cursoNombre(g) : rec.gradeId}</TableCell>
                    <TableCell>{subjectById(rec.subjectId)?.name ?? rec.subjectId}</TableCell>
                    <TableCell>{presentes}</TableCell>
                    <TableCell>{total}</TableCell>
                    <TableCell>{pct(presentes, total)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'rendimiento' && (
          <Table aria-label="Detalle rendimiento">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Estudiante</TableHeaderCell>
                <TableHeaderCell>Actividad</TableHeaderCell>
                <TableHeaderCell>Nota</TableHeaderCell>
                <TableHeaderCell>Puntos</TableHeaderCell>
                <TableHeaderCell>%</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((s) => {
                const act = activitiesCol.items.find((a) => a.id === s.activityId)
                const pts = act?.points ?? 100
                return (
                  <TableRow key={s.id}>
                    <TableCell>{studentById(s.studentId)?.fullName ?? s.studentId}</TableCell>
                    <TableCell>{act?.title ?? s.activityId}</TableCell>
                    <TableCell>{s.score}</TableCell>
                    <TableCell>{pts}</TableCell>
                    <TableCell>{pct(s.score, pts)}%</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {detalle === 'acuerdos' && (
          <Table aria-label="Detalle acuerdos">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Encuentro</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Acuerdo</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetingsCol.items.flatMap((m) => (m.record?.agreements ?? []).filter((a) => a.status !== 'completado').map((a) => (
                <TableRow key={`${m.id}-${a.id}`}>
                  <TableCell>{m.title}</TableCell>
                  <TableCell>{formatDate(m.date)}</TableCell>
                  <TableCell>{a.description}</TableCell>
                  <TableCell>{a.status}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        )}
      </ModalForm>
    </div>
  )
}
