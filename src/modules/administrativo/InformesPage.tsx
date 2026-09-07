import { useMemo, type ReactNode } from 'react'
import { Button, Card, Text, makeStyles, tokens } from '@fluentui/react-components'
import { PrintRegular, DocumentRegular, PeopleRegular, PersonSupportRegular, HeartPulseRegular, PeopleCheckmarkRegular, DeveloperBoardRegular, CalendarLtrRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatCard } from '../../components/shared/StatCard'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
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
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  card: { padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px' },
  icon: { width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px' },
  metric: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--borde)' },
  metricLabel: { fontSize: '13px', color: 'var(--texto-suave)' },
  metricValue: { fontSize: '14px', fontWeight: 800, color: 'var(--azul-oscuro)' },
  note: { fontSize: '12px', color: tokens.colorNeutralForeground2 },
})

interface AreaData {
  icon: ReactNode
  color: string
  title: string
  metrics: Array<{ label: string; value: string }>
}

export function InformesPage() {
  const styles = useStyles()
  const { students, teachers, guardians, users } = useApp()

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

  const d = useMemo(() => {
    const planificadas = plansCol.items.length
    const impartidas = plansCol.items.filter((p) => p.status === 'impartida').length
    const diarias = dailyCol.items.length
    const clases = classesCol.items.length
    const completadas = classesCol.items.filter((c) => c.status === 'completada').length
    const actividades = activitiesCol.items.length
    const encuentros = meetingsCol.items.length
    const asistencias = attendanceCol.items.length

    let attTotal = 0
    let attPres = 0
    attendanceCol.items.forEach((a) => { attTotal += a.entries.length; attPres += a.entries.filter((e) => e.status === 'presente').length })
    const asistencia = attTotal ? Math.round((attPres / attTotal) * 100) : 0

    const activitiesMap = new Map(activitiesCol.items.map((a) => [a.id, a.points]))
    const norm = scoresCol.items.map((s) => (s.score / (activitiesMap.get(s.activityId) ?? 100)) * 100)
    const promedio = norm.length ? Math.round(norm.reduce((x, y) => x + y, 0) / norm.length) : 0

    const accs = accsCol.items
    const realizados = accs.filter((x) => x.status === 'realizado').length
    const pendientes = accs.filter((x) => x.status === 'planificado').length
    const cumplimiento = planificadas ? Math.round((impartidas / planificadas) * 100) : 0

    const psych = psychCol.items
    const tic = ticCol.items

    return { planificadas, impartidas, diarias, clases, completadas, actividades, encuentros, asistencias, asistencia, promedio, accs: accs.length, realizados, pendientes, cumplimiento, psych, tic }
  }, [plansCol.items, dailyCol.items, classesCol.items, attendanceCol.items, activitiesCol.items, scoresCol.items, meetingsCol.items, accsCol.items, psychCol.items, ticCol.items])

  const areas: AreaData[] = useMemo(() => [
    {
      icon: <PersonSupportRegular />, color: '#0082AD', title: 'Docentes',
      metrics: [
        { label: 'Docentes registrados', value: String(teachers.length) },
        { label: 'Planificaciones anuales', value: String(d.planificadas) },
        { label: 'Planificaciones diarias/unidad', value: String(d.diarias) },
        { label: 'Clases impartidas', value: String(d.impartidas) },
        { label: 'Actividades publicadas', value: String(d.actividades) },
        { label: 'Encuentros virtuales', value: String(d.encuentros) },
      ],
    },
    {
      icon: <PeopleRegular />, color: '#0EA5E9', title: 'Estudiantes',
      metrics: [
        { label: 'Matrícula', value: String(students.length) },
        { label: 'Asistencia promedio', value: `${d.asistencia}%` },
        { label: 'Rendimiento académico', value: `${d.promedio}/100` },
        { label: 'Registros de asistencia', value: String(d.asistencias) },
      ],
    },
    {
      icon: <PeopleCheckmarkRegular />, color: '#E62327', title: 'Padres y tutores',
      metrics: [
        { label: 'Tutores registrados', value: String(guardians.length) },
        { label: 'Vinculados a estudiantes', value: String(new Set(guardians.map((g) => g.studentId)).size) },
      ],
    },
    {
      icon: <CalendarLtrRegular />, color: '#15803D', title: 'Coordinación pedagógica',
      metrics: [
        { label: 'Acompañamientos realizados', value: String(d.realizados) },
        { label: 'Acompañamientos pendientes', value: String(d.pendientes) },
        { label: 'Horarios de clase registrados', value: String(schedCol.items.length) },
        { label: 'Cumplimiento de planificación', value: `${d.cumplimiento}%` },
      ],
    },
    {
      icon: <HeartPulseRegular />, color: '#AD1457', title: 'Psicología y orientación',
      metrics: [
        { label: 'Casos registrados', value: String(d.psych.length) },
        { label: 'En atención', value: String(d.psych.filter((x) => x.estado === 'en_atencion').length) },
        { label: 'Pendientes', value: String(d.psych.filter((x) => x.estado === 'pendiente').length) },
        { label: 'Cerrados', value: String(d.psych.filter((x) => x.estado === 'cerrado').length) },
      ],
    },
    {
      icon: <DeveloperBoardRegular />, color: '#4A4F55', title: 'Tecnología e innovación',
      metrics: [
        { label: 'Cuentas de usuarios', value: String(users.length) },
        { label: 'Actividades del plan TIC', value: String(d.tic.length) },
        { label: 'En progreso', value: String(d.tic.filter((x) => x.status === 'en_progreso').length) },
        { label: 'Completadas', value: String(d.tic.filter((x) => x.status === 'completada').length) },
      ],
    },
  ], [teachers.length, students.length, guardians, users.length, schedCol.items.length, d])

  return (
    <div>
      <PageHeader
        title="Informes institucionales"
        subtitle="Consolidado de la actividad de todos los portales: docentes, estudiantes, padres, coordinación pedagógica, psicología y tecnología."
        actions={
          <Button appearance="primary" icon={<PrintRegular />} onClick={() => printReport(areas, students.length, teachers.length)}>
            Imprimir informe (PDF)
          </Button>
        }
      />

      <div className={styles.kpis}>
        <StatCard title="Matrícula" value={students.length} icon={<PeopleRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub="Estudiantes registrados" />
        <StatCard title="Docentes" value={teachers.length} icon={<PersonSupportRegular />} color="#0082AD" gradient={gradientes.azul} sub="Cuerpo docente" />
        <StatCard title="Cumplimiento" value={`${d.cumplimiento}%`} icon={<CalendarLtrRegular />} color="#15803D" gradient={gradientes.verde} sub={`${d.impartidas} de ${d.planificadas} planificadas`} />
        <StatCard title="Clases impartidas" value={d.completadas} icon={<DocumentRegular />} color="#EA580C" gradient={gradientes.naranja} sub="Con registro completo" />
      </div>

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

function printReport(areas: AreaData[], students: number, teachers: number): void {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const areaHtml = areas.map((a) => `
    <div style="break-inside:avoid;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:14px">
      <h2 style="margin:0 0 8px;color:#0082AD;font-size:15px">${esc(a.title)}</h2>
      ${a.metrics.map((m) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eef1f5"><span style="color:#667085">${esc(m.label)}</span><b>${esc(m.value)}</b></div>`).join('')}
    </div>`).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>Informe institucional</title><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#1B2430;max-width:820px;margin:24px auto;padding:0 20px}
h1{color:#0A1F2B;border-bottom:3px solid #0082AD;padding-bottom:8px;font-size:22px}
h2{color:#0082AD;font-size:15px;margin:0 0 8px}
.kpis{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0 20px}
.kpi{flex:1;min-width:150px;border:1px solid #E2E8F0;border-radius:12px;padding:12px}
.kpi label{font-size:11px;color:#667085}.kpi b{font-size:20px;display:block}
.marca{font-size:11px;color:#667085;text-align:center;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:8px}
</style></head><body>
<h1>Informe institucional · Plataforma Virtual</h1>
<div class="kpis">
  <div class="kpi"><label>Matrícula</label><b>${students}</b></div>
  <div class="kpi"><label>Docentes</label><b>${teachers}</b></div>
</div>
${areaHtml}
<p class="marca">Generado por la plataforma el ${new Date().toLocaleString('es-DO')}</p>
</body></html>`

  const w = window.open('', '_blank', 'noopener,width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}
