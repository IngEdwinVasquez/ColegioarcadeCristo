import { useMemo } from 'react'
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from '@fluentui/react-components'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StarRegular, ClipboardTaskRegular, NotebookRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Activity, AttendanceRecord, Grade, SchoolClassRecord } from '../../types'
import { formatDate, pct, relativeDay } from '../../utils/helpers'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' },
  card: { padding: '20px' },
  subtitle: { color: tokens.colorNeutralForeground2 },
})

const PIE_COLORS: Record<string, string> = { presente: '#2E7D32', ausente: '#C8102E', tarde: '#EF6C00', justificado: '#0084B3' }

export function StudentResumen({ studentId }: { studentId: string }) {
  const styles = useStyles()
  const { studentById, gradeById, subjectById, subjects } = useApp()
  const student = studentById(studentId)

  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)

  const gradeId = student?.gradeId

  const myActivities = useMemo(() => activitiesCol.items.filter((a) => a.gradeId === gradeId), [activitiesCol.items, gradeId])
  const myScores = useMemo(() => scoresCol.items.filter((s) => s.studentId === studentId), [scoresCol.items, studentId])
  const myAttendance = useMemo(() => attendanceCol.items.filter((a) => a.gradeId === gradeId), [attendanceCol.items, gradeId])

  const scoreByActivity = useMemo(() => {
    const map = new Map<string, Grade>()
    for (const s of myScores) map.set(s.activityId, s)
    return map
  }, [myScores])

  const myAttendanceEntries = useMemo(
    () => myAttendance.flatMap((a) => a.entries.filter((e) => e.studentId === studentId)),
    [myAttendance, studentId],
  )
  const attendanceCounts = useMemo(() => {
    const counts: Record<string, number> = { presente: 0, ausente: 0, tarde: 0, justificado: 0 }
    for (const e of myAttendanceEntries) counts[e.status] = (counts[e.status] ?? 0) + 1
    return counts
  }, [myAttendanceEntries])

  const presentPct = pct(attendanceCounts.presente, myAttendanceEntries.length)

  const promedio = useMemo(() => {
    const activitiesMap = new Map(activitiesCol.items.map((a) => [a.id, a.points]))
    const vals = myScores.map((s) => {
      const points = activitiesMap.get(s.activityId) ?? 100
      return { score: (s.score / points) * 100, subjectId: activitiesCol.items.find((a) => a.id === s.activityId)?.subjectId }
    })
    if (!vals.length) return 0
    return Math.round(vals.reduce((a, b) => a + b.score, 0) / vals.length)
  }, [myScores, activitiesCol.items])

  const pendingActivities = useMemo(() => myActivities.filter((a) => !scoreByActivity.has(a.id)), [myActivities, scoreByActivity])

  const avgBySubject = useMemo(() => {
    return subjects.map((subj) => {
      const acts = myActivities.filter((a) => a.subjectId === subj.id)
      if (!acts.length) return { name: subj.shortName, promedio: 0 }
      const ids = new Set(acts.map((a) => a.id))
      const sc = myScores.filter((s) => ids.has(s.activityId))
      if (!sc.length) return { name: subj.shortName, promedio: 0 }
      const pointsMap = new Map(acts.map((a) => [a.id, a.points]))
      const norm = sc.map((s) => (s.score / (pointsMap.get(s.activityId) ?? 100)) * 100)
      return { name: subj.shortName, promedio: Math.round(norm.reduce((a, b) => a + b, 0) / norm.length) }
    })
  }, [subjects, myActivities, myScores])

  const pieData = Object.entries(attendanceCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k === 'presente' ? 'Presentes' : k === 'ausente' ? 'Ausentes' : k === 'tarde' ? 'Tardanzas' : 'Justificados',
      value: v,
      color: PIE_COLORS[k],
    }))

  if (!student) return <Text>Seleccione un estudiante.</Text>

  return (
    <div>
      <div className="panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#0095C8,#1AA3D2)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 800,
          }}
        >
          {student.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('')}
        </span>
        <div>
          <Text weight="semibold" size={500} block>{student.fullName}</Text>
          <Text size={300} className={styles.subtitle}>{gradeById(student.gradeId)?.name ?? ''} · {gradeById(student.gradeId)?.level ?? ''}</Text>
        </div>
      </div>

      <div className={styles.kpis}>
        <StatCard title="Promedio general" value={`${promedio}/100`} icon={<StarRegular />} color="#AD1457" gradient="linear-gradient(135deg,#7C2D12,#AD1457)" sub={`${myScores.length} actividades calificadas`} />
        <StatCard title="Actividades pendientes" value={pendingActivities.length} icon={<ClipboardTaskRegular />} color="#EA580C" gradient="linear-gradient(135deg,#9A3412,#EA580C)" sub="Por entregar" />
        <StatCard title="Mi asistencia" value={`${presentPct}%`} icon={<CheckmarkCircleRegular />} color="#15803D" gradient="linear-gradient(135deg,#14532D,#22C55E)" sub={`${attendanceCounts.presente} de ${myAttendanceEntries.length} registros presentes`} />
        <StatCard title="Clases impartidas" value={classesCol.items.filter((c) => c.gradeId === gradeId && c.status === 'completada').length} icon={<NotebookRegular />} color="#0EA5E9" gradient="linear-gradient(135deg,#0C4A6E,#0EA5E9)" sub="En mi grado" />
      </div>

      <div className={styles.grid}>
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400} block>Próximas actividades y entregas</Text>
          <Table aria-label="Actividades del estudiante" style={{ marginTop: '12px' }}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Actividad</TableHeaderCell>
                <TableHeaderCell>Asignatura</TableHeaderCell>
                <TableHeaderCell>Entrega</TableHeaderCell>
                <TableHeaderCell>Puntos</TableHeaderCell>
                <TableHeaderCell>Mi calificación</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myActivities
                .slice()
                .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
                .map((a) => {
                  const score = scoreByActivity.get(a.id)
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Text size={300} weight="semibold" block>{a.title}</Text>
                        <Text size={200} className={styles.subtitle}>{formatDate(a.dueDate)} · {relativeDay(a.dueDate)}</Text>
                      </TableCell>
                      <TableCell>{subjectById(a.subjectId)?.shortName ?? a.subjectId}</TableCell>
                      <TableCell>{formatDate(a.dueDate)}</TableCell>
                      <TableCell>{a.points}</TableCell>
                      <TableCell>
                        {score ? (
                          <Text weight="semibold" style={{ color: score.score / a.points >= 0.7 ? '#2E7D32' : '#C8102E' }}>
                            {score.score} / {a.points}
                          </Text>
                        ) : (
                          <StatusBadge status="pendiente">Pendiente</StatusBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>

        <div className="panel">
          <Text weight="semibold" size={400} block>Mi distribución de asistencia</Text>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                {pieData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <RTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <Text weight="semibold" size={400} block>Promedio por asignatura</Text>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={avgBySubject}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <RTooltip formatter={(v) => [`${v}`, 'Promedio']} />
              <Bar dataKey="promedio" fill="#0095C8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
