import { useMemo, type ReactNode } from 'react'
import { Card, ProgressBar, Text, makeStyles } from '@fluentui/react-components'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip as RTooltip } from 'recharts'
import { PersonSupportRegular, BookRegular, PeopleRegular, PremiumPersonRegular, HandOpenHeartRegular, DeveloperBoardRegular, ClipboardTaskRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { pct } from '../../utils/helpers'
import type {
  Accompaniment, Activity, Announcement, AttendanceRecord, ClassPlan, ClassSchedule, Grade, GradeRegister,
  Persona, PsychRequest, SchoolClassRecord, SigerdReport, StudentGuardian, User, VirtualMeeting,
} from '../../types'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '16px' },
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  head: { display: 'flex', alignItems: 'center', gap: '10px' },
  dot: { width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' },
})

interface PortalCardProps { title: string; subtitle: string; color: string; icon: ReactNode; metrics: Array<{ name: string; value: number }>; cumplimiento?: number }

function PortalCard({ title, subtitle, color, icon, metrics, cumplimiento }: PortalCardProps) {
  const styles = useStyles()
  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <span className={styles.dot} style={{ background: color }}>{icon}</span>
        <div>
          <Text weight="semibold" size={400} block>{title}</Text>
          <Text size={200} style={{ color: 'var(--texto-suave)' }}>{subtitle}</Text>
        </div>
      </div>
      {cumplimiento != null && (
        <div>
          <Text size={200} block>Cumplimiento: <strong>{cumplimiento}%</strong></Text>
          <ProgressBar value={cumplimiento / 100} color="success" thickness="large" />
        </div>
      )}
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={metrics} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" fontSize={10} interval={0} />
          <YAxis allowDecimals={false} fontSize={10} />
          <RTooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {metrics.map((m) => <Cell key={m.name} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {metrics.map((m) => (
          <span key={m.name} style={{ padding: '2px 10px', borderRadius: '999px', background: 'var(--fondo-suave, #F3F2F1)', fontSize: '12px' }}>
            {m.name}: <strong>{m.value}</strong>
          </span>
        ))}
      </div>
    </Card>
  )
}

/** Gráficos de actividad, progreso y cumplimiento por cada portal de la plataforma. */
export function PortalesActividad() {
  const styles = useStyles()
  const { students, teachers } = useApp()
  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings)
  const announcementsCol = useCollection<Announcement>(dataService.getAnnouncements)
  const psychCol = useCollection<PsychRequest>(dataService.getPsychRequests)
  const accompCol = useCollection<Accompaniment>(dataService.getAccompaniments)
  const schedulesCol = useCollection<ClassSchedule>(dataService.getSchedules)
  const sigerdCol = useCollection<SigerdReport>(dataService.getSigerdReports)
  const registersCol = useCollection<GradeRegister>(dataService.getGradeRegisters)
  const personasCol = useCollection<Persona>(dataService.getPersonas)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians)
  const usersCol = useCollection<User>(dataService.getUsers)

  const completed = classesCol.items.filter((c) => c.status === 'completada').length
  const cumplimientoPlan = plansCol.items.length ? pct(completed, plansCol.items.length) : 0

  const actsPublicadas = activitiesCol.items.filter((a) => a.status === 'publicada').length
  const entregas = scoresCol.items.length
  const cumplimientoEntrega = actsPublicadas ? pct(entregas, actsPublicadas) : 0

  const acuerdosPendientes = useMemo(
    () => meetingsCol.items.flatMap((m) => (m.record?.agreements ?? []).filter((a) => a.status !== 'completado')).length,
    [meetingsCol.items],
  )

  const psychPend = psychCol.items.filter((p) => p.estado === 'pendiente').length
  const psychAten = psychCol.items.filter((p) => p.estado === 'en_atencion').length
  const psychCerr = psychCol.items.filter((p) => p.estado === 'cerrado').length

  const accPlan = accompCol.items.filter((a) => a.status === 'planificado').length
  const accReal = accompCol.items.filter((a) => a.status === 'realizado').length
  const accSeg = accompCol.items.filter((a) => a.status === 'seguimiento').length
  const cumplimientoAcomp = accompCol.items.length ? pct(accReal, accompCol.items.length) : 0

  return (
    <div className={styles.grid}>
      <PortalCard
        title="Portal de Docentes"
        subtitle="Planificación, clases, asistencia y cumplimiento"
        color="#0082AD" icon={<PersonSupportRegular />}
        cumplimiento={cumplimientoPlan}
        metrics={[
          { name: 'Planificadas', value: plansCol.items.length },
          { name: 'Impartidas', value: completed },
          { name: 'Asistencia', value: attendanceCol.items.length },
          { name: 'Docentes', value: teachers.length },
        ]}
      />
      <PortalCard
        title="Campus Virtual de Estudiantes"
        subtitle="Actividades publicadas, entregas y calificaciones"
        color="#0E7C86" icon={<BookRegular />}
        cumplimiento={cumplimientoEntrega}
        metrics={[
          { name: 'Publicadas', value: actsPublicadas },
          { name: 'Calificaciones', value: entregas },
          { name: 'Estudiantes', value: students.length },
        ]}
      />
      <PortalCard
        title="Portal de Padres y Tutores"
        subtitle="Familias, comunicados y encuentros"
        color="#E30613" icon={<PeopleRegular />}
        metrics={[
          { name: 'Familias', value: guardiansCol.items.length },
          { name: 'Comunicados', value: announcementsCol.items.length },
          { name: 'Encuentros', value: meetingsCol.items.length },
        ]}
      />
      <PortalCard
        title="Dirección Académica"
        subtitle="Monitoreo institucional y toma de decisiones"
        color="#0A1F2B" icon={<PremiumPersonRegular />}
        cumplimiento={cumplimientoPlan}
        metrics={[
          { name: 'Informes', value: 0 },
          { name: 'Acuerdos pend.', value: acuerdosPendientes },
          { name: 'SIGERD', value: sigerdCol.items.length },
        ]}
      />
      <PortalCard
        title="Psicología y Orientación"
        subtitle="Solicitudes de acompañamiento integral"
        color="#EF6C00" icon={<HandOpenHeartRegular />}
        metrics={[
          { name: 'Pendientes', value: psychPend },
          { name: 'En atención', value: psychAten },
          { name: 'Cerradas', value: psychCerr },
        ]}
      />
      <PortalCard
        title="Tecnología e Innovación"
        subtitle="Datos de personas, cuentas, roles y configuración"
        color="#616161" icon={<DeveloperBoardRegular />}
        metrics={[
          { name: 'Personal', value: personasCol.items.length },
          { name: 'Usuarios', value: usersCol.items.length },
          { name: 'Registros', value: registersCol.items.length },
          { name: 'SIGERD', value: sigerdCol.items.length },
        ]}
      />
      <PortalCard
        title="Coordinación Pedagógica"
        subtitle="Acompañamiento docente y horarios del nivel"
        color="#2E7D32" icon={<ClipboardTaskRegular />}
        cumplimiento={cumplimientoAcomp}
        metrics={[
          { name: 'Planificados', value: accPlan },
          { name: 'Realizados', value: accReal },
          { name: 'Seguimiento', value: accSeg },
          { name: 'Horarios', value: schedulesCol.items.length },
        ]}
      />
    </div>
  )
}
