import { useMemo, useState } from 'react'
import { Card, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, tokens } from '@fluentui/react-components'
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
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import type { AttendanceRecord } from '../../types'
import { formatDate, pct } from '../../utils/helpers'

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
    gap: '20px',
    marginTop: '16px',
  },
  card: { padding: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' },
})

const PIE_COLORS: Record<string, string> = {
  presente: '#2E7D32',
  ausente: '#C8102E',
  tarde: '#EF6C00',
  justificado: '#0084B3',
}

const PIE_LABELS: Record<string, string> = {
  presente: 'Presentes',
  ausente: 'Ausentes',
  tarde: 'Tardanzas',
  justificado: 'Justificados',
}

export function AsistenciaReportes() {
  const styles = useStyles()
  const { subjects, grades, gradeById, students } = useApp()
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')

  const filtered = useMemo(() => {
    return attendanceCol.items
      .filter((a) => !subjectFilter || a.subjectId === subjectFilter)
      .filter((a) => !gradeFilter || a.gradeId === gradeFilter)
  }, [attendanceCol.items, subjectFilter, gradeFilter])

  const totals = useMemo(() => {
    const counts = { presente: 0, ausente: 0, tarde: 0, justificado: 0 }
    for (const rec of filtered) {
      for (const e of rec.entries) counts[e.status] = (counts[e.status] ?? 0) + 1
    }
    return counts
  }, [filtered])

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; presente: number; total: number }>()
    for (const rec of filtered) {
      const entry = map.get(rec.date) ?? { date: rec.date, presente: 0, total: 0 }
      entry.total += rec.entries.length
      entry.presente += rec.entries.filter((e) => e.status === 'presente').length
      map.set(rec.date, entry)
    }
    return [...map.values()]
      .map((d) => ({ ...d, porcentaje: pct(d.presente, d.total) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [filtered])

  const pieData = (Object.keys(totals) as Array<keyof typeof totals>)
    .map((k) => ({ name: PIE_LABELS[k], value: totals[k], key: k }))
    .filter((d) => d.value > 0)

  const studentStats = useMemo(() => {
    if (!gradeFilter) return []
    const gradeStudents = students.filter((s) => s.gradeId === gradeFilter)
    return gradeStudents.map((s) => {
      const records = filtered.filter((a) => a.entries.some((e) => e.studentId === s.id))
      const myEntries = records.flatMap((a) => a.entries.filter((e) => e.studentId === s.id))
      const presentes = myEntries.filter((e) => e.status === 'presente').length
      const total = myEntries.length
      return { student: s, presentes, total, porcentaje: pct(presentes, total) }
    })
  }, [gradeFilter, students, filtered])

  const totalEntries = pieData.reduce((acc, d) => acc + d.value, 0)

  return (
    <div>
      <div className={styles.filterRow}>
        <Select value={subjectFilter} onChange={(_, d) => setSubjectFilter(d.value)} style={{ minWidth: '200px' }}>
          <option value="">Todas las asignaturas</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '160px' }}>
          <option value="">Todos los grados</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 && (
        <EmptyStateView title="Sin datos de asistencia" message="Registre asistencia para visualizar los informes gráficos." />
      )}

      {filtered.length > 0 && (
        <div className={styles.grid}>
          <Card className={styles.card}>
            <Text weight="semibold" size={400} block>Distribución de asistencia</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }} block>Total de registros: {totalEntries}</Text>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={PIE_COLORS[d.key]} />
                  ))}
                </Pie>
                <RTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className={styles.card}>
            <Text weight="semibold" size={400} block>Asistencia por día</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }} block>% de estudiantes presentes por clase registrada</Text>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} minTickGap={16} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <RTooltip formatter={(v) => [`${v}%`, 'Presentes']} labelFormatter={(v) => formatDate(String(v))} />
                <Bar dataKey="porcentaje" name="% presentes" fill="#004D6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className={styles.card}>
            <Text weight="semibold" size={400} block>Tendencia de asistencia</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }} block>Evolución del % de presencia a lo largo del tiempo</Text>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} minTickGap={16} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <RTooltip formatter={(v) => [`${v}%`, 'Presentes']} labelFormatter={(v) => formatDate(String(v))} />
                <Line type="monotone" dataKey="porcentaje" name="% presentes" stroke="#E30613" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <Text weight="semibold" size={400} block>
              Detalle por estudiante {gradeFilter ? `· ${gradeById(gradeFilter)?.name ?? ''}` : '(seleccione un grado)'}
            </Text>
            {studentStats.length > 0 ? (
              <Table aria-label="Asistencia por estudiante" style={{ marginTop: '12px' }}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Estudiante</TableHeaderCell>
                    <TableHeaderCell>Clases registradas</TableHeaderCell>
                    <TableHeaderCell>Presentes</TableHeaderCell>
                    <TableHeaderCell>% de asistencia</TableHeaderCell>
                    <TableHeaderCell>Nivel</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentStats
                    .slice()
                    .sort((a, b) => b.porcentaje - a.porcentaje)
                    .map((s) => (
                      <TableRow key={s.student.id}>
                        <TableCell>{s.student.fullName}</TableCell>
                        <TableCell>{s.total}</TableCell>
                        <TableCell>{s.presentes}</TableCell>
                        <TableCell>{s.porcentaje}%</TableCell>
                        <TableCell>
                          <span
                            style={{
                              padding: '2px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: s.porcentaje >= 90 ? '#2E7D32' : s.porcentaje >= 75 ? '#EF6C00' : '#C8102E',
                              color: '#fff',
                            }}
                          >
                            {s.porcentaje >= 90 ? 'Óptimo' : s.porcentaje >= 75 ? 'Regular' : 'Crítico'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <Text size={300} style={{ marginTop: '12px' }} block>Seleccione un grado para ver el detalle individual.</Text>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
