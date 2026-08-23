import { useMemo, useState } from 'react'
import { Card, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
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
import { PeopleRegular, PersonSupportRegular, CalendarCheckmarkRegular, StarRegular, NotebookRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { ClassPlan, SchoolClassRecord, AttendanceRecord, Activity, Grade, VirtualMeeting } from '../../types'
import { formatDate, pct } from '../../utils/helpers'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  card: { padding: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
})

export function DireccionPage() {
  const styles = useStyles()
  const { subjects, grades, teacherById, students, teachers } = useApp()
  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings)

  const [gradeFilter, setGradeFilter] = useState('')

  const planned = useMemo(
    () => plansCol.items.filter((p) => !gradeFilter || p.gradeId === gradeFilter),
    [plansCol.items, gradeFilter],
  )
  const completed = classesCol.items.filter((c) => c.status === 'completada' && (!gradeFilter || c.gradeId === gradeFilter))
  const attendance = attendanceCol.items.filter((a) => !gradeFilter || a.gradeId === gradeFilter)
  const activities = activitiesCol.items.filter((a) => !gradeFilter || a.gradeId === gradeFilter)
  const scores = scoresCol.items

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
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
      </div>

      <div className={styles.kpis}>
        <StatCard title="Estudiantes" value={students.length} icon={<PeopleRegular />} color="#004D6B" sub="Matrícula registrada" />
        <StatCard title="Docentes" value={teachers.length} icon={<PersonSupportRegular />} color="#2E7D32" sub="Cuerpo docente" />
        <StatCard title="Cumplimiento de planificación" value={`${cumplimiento}%`} icon={<CalendarCheckmarkRegular />} color="#EF6C00" sub={`${completed.length} clases impartidas de ${planned.length} planificadas`} />
        <StatCard title="Asistencia promedio" value={`${avgAttendance}%`} icon={<NotebookRegular />} color="#0084B3" sub="Basado en el registro por asignatura" />
        <StatCard title="Rendimiento académico" value={`${avgAcademic}/100`} icon={<StarRegular />} color="#AD1457" sub="Promedio normalizado de actividades" />
        <StatCard title="Acuerdos pendientes" value={pendingAgreements} icon={<CalendarCheckmarkRegular />} color="#7D1D24" sub="Derivados de encuentros virtuales" />
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
    </div>
  )
}
