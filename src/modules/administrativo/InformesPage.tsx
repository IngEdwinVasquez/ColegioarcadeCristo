import { useMemo, useState, type ReactNode } from 'react'
import { Button, Card, Select, Text, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens } from '@fluentui/react-components'
import { PrintRegular, DocumentRegular, PeopleRegular, PersonSupportRegular, HeartPulseRegular, PeopleCheckmarkRegular, DeveloperBoardRegular, CalendarLtrRegular } from '@fluentui/react-icons'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell, Legend } from 'recharts'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { CoordinationLevel } from '../../types'
import type {
  Accompaniment,
  Activity,
  AttendanceRecord,
  ClassPlan,
  ClassSchedule,
  DailyPlan,
  Grade,
  PsychRequest,
  SchoolClassRecord,
  TicActivity,
  VirtualMeeting,
} from '../../types'

const useStyles = makeStyles({
  controls: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  card: { padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px' },
  icon: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' },
  metric: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--borde)' },
  metricLabel: { fontSize: '13px', color: 'var(--texto-suave)' },
  metricValue: { fontSize: '14px', fontWeight: 800, color: 'var(--azul-oscuro)' },
  title: { fontWeight: 600, fontSize: '16px', marginBottom: '8px' },
  note: { fontSize: '12px', color: tokens.colorNeutralForeground2 },
})

interface AreaData {
  icon: ReactNode
  color: string
  title: string
  metrics: Array<{ label: string; value: string }>
}

const LEVELS: Array<CoordinationLevel | 'Todos'> = ['Todos', 'Inicial', 'Primaria', 'Secundaria']

const PERIODS = [
  { value: 'all', label: 'Todo el período' },
  { value: 'month', label: 'Este mes' },
  { value: 'quarter', label: 'Este trimestre' },
] as const

export function InformesPage() {
  const styles = useStyles()
  const { students, teachers, guardians, users, grades, subjects } = useApp()

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const dailyCol = useCollection<DailyPlan>(dataService.getDailyPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings)
  const accsCol = useCollection<Accompaniment>(dataService.getAccompaniments)
  const schedCol = useCollection<ClassSchedule>(dataService.getSchedules)
  const psychCol = useCollection<PsychRequest>(dataService.getPsychRequests)
  const ticCol = useCollection<TicActivity>(dataService.getTicActivities)

  const [levelFilter, setLevelFilter] = useState<CoordinationLevel | 'Todos'>('Todos')
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter'>('all')
  const [subjectFilter, setSubjectFilter] = useState('')

  const levelGradeIds = useMemo(() => {
    if (levelFilter === 'Todos') return null
    return new Set(grades.filter((g) => g.level === levelFilter).map((g) => g.id))
  }, [grades, levelFilter])

  const byLevel = (gradeId: string) => !levelGradeIds || levelGradeIds.has(gradeId)
  const byLevelTeacher = (gradesArr: string[]) => !levelGradeIds || gradesArr.some((g) => levelGradeIds.has(g))

  const cutoff = useMemo(() => {
    if (periodFilter === 'all') return ''
    const d = new Date()
    d.setMonth(d.getMonth() - (periodFilter === 'month' ? 1 : 3))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [periodFilter])
  const inPeriod = (date: string) => !cutoff || (!!date && date >= cutoff)

  const studentsLvl = useMemo(() => students.filter((s) => byLevel(s.gradeId)), [students, levelGradeIds])
  const teachersLvl = useMemo(() => teachers.filter((t) => byLevelTeacher(t.grades)), [teachers, levelGradeIds])
  const bySubject = (subjectId: string) => !subjectFilter || subjectId === subjectFilter
  const plans = useMemo(() => plansCol.items.filter((p) => byLevel(p.gradeId) && inPeriod(p.date) && bySubject(p.subjectId)), [plansCol.items, levelGradeIds, cutoff, subjectFilter])
  const dailies = useMemo(() => dailyCol.items.filter((p) => byLevel(p.gradeId) && inPeriod(p.fecha) && bySubject(p.subjectId)), [dailyCol.items, levelGradeIds, cutoff, subjectFilter])
  const classes = useMemo(() => classesCol.items.filter((c) => byLevel(c.gradeId) && inPeriod(c.date) && bySubject(c.subjectId)), [classesCol.items, levelGradeIds, cutoff, subjectFilter])
  const attendance = useMemo(() => attendanceCol.items.filter((a) => byLevel(a.gradeId) && inPeriod(a.date) && bySubject(a.subjectId)), [attendanceCol.items, levelGradeIds, cutoff, subjectFilter])
  const activities = useMemo(() => activitiesCol.items.filter((a) => byLevel(a.gradeId) && inPeriod(a.publishDate) && bySubject(a.subjectId)), [activitiesCol.items, levelGradeIds, cutoff, subjectFilter])
  const meetings = useMemo(() => meetingsCol.items.filter((m) => inPeriod(m.date)), [meetingsCol.items, cutoff])
  const accs = useMemo(() => accsCol.items.filter((a) => (levelFilter === 'Todos' || a.level === levelFilter) && inPeriod(a.date)), [accsCol.items, levelFilter, cutoff])
  const schedules = useMemo(() => schedCol.items.filter((s) => byLevel(s.gradeId) && bySubject(s.subjectId)), [schedCol.items, levelGradeIds, subjectFilter])

  const d = useMemo(() => {
    const planificadas = plans.length
    const impartidas = plans.filter((p) => p.status === 'impartida').length
    const completadas = classes.filter((c) => c.status === 'completada').length

    let attTotal = 0, attPres = 0
    attendance.forEach((a) => { attTotal += a.entries.length; attPres += a.entries.filter((e) => e.status === 'presente').length })
    const asistencia = attTotal ? Math.round((attPres / attTotal) * 100) : 0

    const activitiesMap = new Map(activities.map((a) => [a.id, a.points]))
    const norm = scoresCol.items.map((s) => (s.score / (activitiesMap.get(s.activityId) ?? 100)) * 100)
    const promedio = norm.length ? Math.round(norm.reduce((x, y) => x + y, 0) / norm.length) : 0

    const realizados = accs.filter((x) => x.status === 'realizado').length
    const pendientes = accs.filter((x) => x.status === 'planificado').length
    const cumplimiento = planificadas ? Math.round((impartidas / planificadas) * 100) : 0

    return {
      planificadas, impartidas, diarias: dailies.length, completadas,
      actividades: activities.length, encuentros: meetings.length, asistencias: attendance.length,
      asistencia, promedio, accs: accs.length, realizados, pendientes, cumplimiento,
    }
  }, [plans, dailies, classes, attendance, activities, meetings, accs, scoresCol.items])

  const areas: AreaData[] = useMemo(() => [
    {
      icon: <PersonSupportRegular />, color: '#0082AD', title: 'Docentes',
      metrics: [
        { label: 'Docentes', value: String(teachersLvl.length) },
        { label: 'Planificaciones anuales', value: String(d.planificadas) },
        { label: 'Diarias / unidad', value: String(d.diarias) },
        { label: 'Clases impartidas', value: String(d.impartidas) },
        { label: 'Actividades publicadas', value: String(d.actividades) },
        { label: 'Encuentros virtuales', value: String(d.encuentros) },
      ],
    },
    {
      icon: <PeopleRegular />, color: '#0EA5E9', title: 'Estudiantes',
      metrics: [
        { label: 'Matrícula', value: String(studentsLvl.length) },
        { label: 'Asistencia promedio', value: `${d.asistencia}%` },
        { label: 'Rendimiento académico', value: `${d.promedio}/100` },
        { label: 'Registros de asistencia', value: String(d.asistencias) },
      ],
    },
    {
      icon: <PeopleCheckmarkRegular />, color: '#E62327', title: 'Padres y tutores',
      metrics: [
        { label: 'Tutores registrados', value: String(guardians.length) },
      ],
    },
    {
      icon: <CalendarLtrRegular />, color: '#15803D', title: 'Coordinación pedagógica',
      metrics: [
        { label: 'Acompañamientos realizados', value: String(d.realizados) },
        { label: 'Acompañamientos pendientes', value: String(d.pendientes) },
        { label: 'Horarios registrados', value: String(schedules.length) },
        { label: 'Cumplimiento', value: `${d.cumplimiento}%` },
      ],
    },
    {
      icon: <HeartPulseRegular />, color: '#AD1457', title: 'Psicología y orientación',
      metrics: [
        { label: 'Casos', value: String(psychCol.items.length) },
        { label: 'En atención', value: String(psychCol.items.filter((x) => x.estado === 'en_atencion').length) },
        { label: 'Pendientes', value: String(psychCol.items.filter((x) => x.estado === 'pendiente').length) },
      ],
    },
    {
      icon: <DeveloperBoardRegular />, color: '#4A4F55', title: 'Tecnología e innovación',
      metrics: [
        { label: 'Cuentas de usuarios', value: String(users.length) },
        { label: 'Actividades del plan TIC', value: String(ticCol.items.length) },
        { label: 'En progreso', value: String(ticCol.items.filter((x) => x.status === 'en_progreso').length) },
        { label: 'Completadas', value: String(ticCol.items.filter((x) => x.status === 'completada').length) },
      ],
    },
  ], [teachersLvl.length, studentsLvl.length, guardians.length, schedules.length, users.length, ticCol.items, psychCol.items, d])

  const chartData = useMemo(() => [
    { area: 'Docentes', value: d.impartidas, color: '#0082AD' },
    { area: 'Estudiantes', value: d.asistencias, color: '#0EA5E9' },
    { area: 'Coordinación', value: d.realizados, color: '#15803D' },
    { area: 'Psicología', value: psychCol.items.length, color: '#AD1457' },
    { area: 'Tecnología', value: ticCol.items.length, color: '#4A4F55' },
  ], [d, psychCol.items.length, ticCol.items.length])

  const teacherCumplimiento = useMemo(() => {
    const map = new Map<string, { plan: number; impartidas: number }>()
    plans.forEach((p) => {
      const e = map.get(p.teacherId) ?? { plan: 0, impartidas: 0 }
      e.plan++
      if (p.status === 'impartida') e.impartidas++
      map.set(p.teacherId, e)
    })
    return [...map.entries()]
      .map(([teacherId, v]) => {
        const fullName = teachers.find((t) => t.id === teacherId)?.fullName
        if (!fullName) return null
        return { name: fullName, Planificadas: v.plan, Impartidas: v.impartidas }
      })
      .filter((r): r is { name: string; Planificadas: number; Impartidas: number } => !!r)
      .sort((a, b) => b.Planificadas - a.Planificadas)
      .slice(0, 12)
  }, [plans, teachers])

  const nivelComparison = useMemo(() => {
    return (['Inicial', 'Primaria', 'Secundaria'] as CoordinationLevel[]).map((lvl) => {
      const gIds = new Set(grades.filter((g) => g.level === lvl).map((g) => g.id))
      const lvTeachers = teachers.filter((t) => t.grades.some((g) => gIds.has(g)))
      const lvStudents = students.filter((s) => gIds.has(s.gradeId))
      const lvPlans = plansCol.items.filter((p) => gIds.has(p.gradeId) && inPeriod(p.date) && bySubject(p.subjectId))
      const impartidas = lvPlans.filter((p) => p.status === 'impartida').length
      const lvAccs = accsCol.items.filter((a) => a.level === lvl && inPeriod(a.date))
      return {
        nivel: lvl,
        estudiantes: lvStudents.length,
        docentes: lvTeachers.length,
        planificadas: lvPlans.length,
        impartidas,
        cumplimiento: lvPlans.length ? Math.round((impartidas / lvPlans.length) * 100) : 0,
        acs: lvAccs.length,
      }
    })
  }, [teachers, students, grades, plansCol.items, accsCol.items, cutoff, subjectFilter])

  const exportExcel = () => {
    const rows: Array<[string, string]> = [
      ['Matrícula', String(studentsLvl.length)],
      ['Docentes', String(teachersLvl.length)],
      ['Cumplimiento de planificación', `${d.cumplimiento}%`],
      ['Clases impartidas', String(d.impartidas)],
      ['Asistencia promedio', `${d.asistencia}%`],
      ['Rendimiento académico', `${d.promedio}/100`],
    ]
    const areaRows: Array<[string, string]> = areas.flatMap((a) => a.metrics.map((m) => [`${a.title} — ${m.label}`, m.value] as [string, string]))
    const all = [...rows, ['', ''], ...areaRows]
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr><th>Indicador</th><th>Valor</th></tr>${all.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url
    el.download = `Informe_institucional_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Informes institucionales"
        subtitle="Consolidado de la actividad de todos los portales: docentes, estudiantes, padres, coordinación pedagógica, psicología y tecnología."
        actions={
          <>
            <Button appearance="secondary" icon={<DocumentRegular />} onClick={exportExcel}>Exportar Excel</Button>
            <Button appearance="primary" icon={<PrintRegular />} onClick={() => window.print()}>Imprimir (PDF)</Button>
          </>
        }
      />

      <div className={styles.controls}>
        <Select value={levelFilter} onChange={(_, d) => setLevelFilter(d.value as CoordinationLevel | 'Todos')} style={{ minWidth: '180px' }}>
          {LEVELS.map((l) => (<option key={l} value={l}>{l === 'Todos' ? 'Todos los niveles' : l}</option>))}
        </Select>
        <Select value={periodFilter} onChange={(_, d) => setPeriodFilter(d.value as typeof periodFilter)} style={{ minWidth: '170px' }}>
          {PERIODS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
        </Select>
        <Select value={subjectFilter} onChange={(_, d) => setSubjectFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todas las asignaturas</option>
          {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        {levelFilter !== 'Todos' && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Filtrando por: {levelFilter}</Text>}
      </div>

      <div className={styles.kpis}>
        <StatCard title="Matrícula" value={studentsLvl.length} icon={<PeopleRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub={levelFilter === 'Todos' ? 'Estudiantes' : `Nivel ${levelFilter}`} />
        <StatCard title="Docentes" value={teachersLvl.length} icon={<PersonSupportRegular />} color="#0082AD" gradient={gradientes.azul} sub="Cuerpo docente" />
        <StatCard title="Cumplimiento" value={`${d.cumplimiento}%`} icon={<CalendarLtrRegular />} color="#15803D" gradient={gradientes.verde} sub={`${d.impartidas} de ${d.planificadas} planificadas`} />
        <StatCard title="Clases registradas" value={d.completadas} icon={<DocumentRegular />} color="#EA580C" gradient={gradientes.naranja} sub="Con registro completo" />
      </div>

      <Card className={styles.card} style={{ marginBottom: '20px' }}>
        <Text className={styles.title}>Actividad comparativa por área</Text>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis type="category" dataKey="area" width={100} fontSize={12} />
            <RTooltip />
            <Legend />
            <Bar dataKey="value" name="Registros" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((d, i) => (<Cell key={i} fill={d.color} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Text size={200} className={styles.note}>Cantidad de registros/actividades por área en el período seleccionado.</Text>
      </Card>

      <Card className={styles.card} style={{ marginBottom: '20px' }}>
        <Text className={styles.title}>Planificación vs. impartida por docente</Text>
        {teacherCumplimiento.length === 0 ? (
          <Text size={300} style={{ color: 'var(--texto-suave)' }}>No hay planificaciones para los filtros actuales.</Text>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, teacherCumplimiento.length * 34)}>
            <BarChart data={teacherCumplimiento} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis type="category" dataKey="name" width={90} fontSize={11} />
              <RTooltip />
              <Legend />
              <Bar dataKey="Planificadas" fill="#0082AD" radius={[0, 3, 3, 0]} barSize={14} />
              <Bar dataKey="Impartidas" fill="#E62327" radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className={styles.card} style={{ marginBottom: '20px' }}>
        <Text className={styles.title}>Comparativo entre niveles</Text>
        <Table aria-label="Comparativo entre niveles" style={{ marginTop: '8px' }}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Nivel</TableHeaderCell>
              <TableHeaderCell>Estudiantes</TableHeaderCell>
              <TableHeaderCell>Docentes</TableHeaderCell>
              <TableHeaderCell>Planificadas</TableHeaderCell>
              <TableHeaderCell>Impartidas</TableHeaderCell>
              <TableHeaderCell>% Cumplimiento</TableHeaderCell>
              <TableHeaderCell>Acompañamientos</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nivelComparison.map((n) => (
              <TableRow key={n.nivel}>
                <TableCell><Text weight="semibold">{n.nivel}</Text></TableCell>
                <TableCell>{n.estudiantes}</TableCell>
                <TableCell>{n.docentes}</TableCell>
                <TableCell>{n.planificadas}</TableCell>
                <TableCell>{n.impartidas}</TableCell>
                <TableCell>{n.cumplimiento}%</TableCell>
                <TableCell>{n.acs}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className={styles.grid}>
        {areas.map((area) => (
          <Card key={area.title} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.icon} style={{ background: area.color }}>{area.icon}</span>
              <Text weight="semibold" size={400}>{area.title}</Text>
            </div>
            <div>
              {area.metrics.map((m) => (
                <div key={m.label} className={styles.metric}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <span className={styles.metricValue}>{m.value}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Text size={200} className={styles.note} block style={{ marginTop: '20px' }}>
        Datos actualizados en tiempo real desde Microsoft 365 (SharePoint) · Generado el {new Date().toLocaleString('es-DO')}
      </Text>
    </div>
  )
}
