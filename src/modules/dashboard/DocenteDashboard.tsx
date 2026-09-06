import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, Badge } from '@fluentui/react-components'
import {
  NotebookRegular,
  PlayRegular,
  ArrowRightRegular,
  CalendarCheckmarkRegular,
  AddRegular,
  PeopleRegular,
  AlertRegular,
  HeartPulseRegular,
  ArrowNextRegular,
} from '@fluentui/react-icons'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { ROLE_LABELS } from '../../types/roles'
import type { AttendanceRecord, ClassPlan, DailyPlan, SchoolClassRecord } from '../../types'
import { formatDate, genId, relativeDay, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  subtitle: { color: 'var(--texto-suave)' },
  heroActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  ahora: {
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  claseCard: {
    padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--borde)', background: 'var(--superficie)',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  claseActual: { borderLeft: '4px solid #0095C8' },
  claseProxima: { borderLeft: '4px solid #9A9C2E' },
  pausa: {
    padding: '16px 18px', borderRadius: '14px', color: '#fff',
    background: 'linear-gradient(135deg, #0B2E3F 0%, #0095C8 100%)',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
})

/** Devuelve los minutos desde medianoche de la hora de inicio de un periodo "HH:MM - HH:MM". */
function periodStart(period: string): number {
  const m = period.match(/(\d{1,2}):(\d{2})/)
  if (!m) return -1
  return Number(m[1]) * 60 + Number(m[2])
}

const PAUSAS = [
  'Estire brazos y cuello 30 segundos en cada dirección.',
  'Respiración profunda: inhale 4 segundos, retenga 4 y exhale 4.',
  'Levántese y camine 2 minutos; hidrátese con un vaso de agua.',
  'Relaje la vista: mire un punto lejano durante 20 segundos.',
  'Gire suavemente los tobillos y muñecas 10 veces cada uno.',
  'Hombros atrás y abajo: mantenga 10 segundos y repita 3 veces.',
]

export function DocenteDashboard() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { user, teacherById, subjectById, gradeById, students, role } = useApp()
  const teacher = teacherById(user?.teacherId)

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const dailyCol = useCollection<DailyPlan>(dataService.getDailyPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)

  const myPlans = useMemo(() => plansCol.items.filter((p) => p.teacherId === user?.teacherId), [plansCol.items, user?.teacherId])
  const myDaily = useMemo(() => dailyCol.items.filter((p) => p.teacherId === user?.teacherId), [dailyCol.items, user?.teacherId])
  const myClasses = useMemo(() => classesCol.items.filter((c) => c.teacherId === user?.teacherId), [classesCol.items, user?.teacherId])

  const totalEstudiantes = useMemo(
    () => students.filter((s) => (teacher?.grades ?? []).includes(s.gradeId)).length,
    [students, teacher],
  )

  const attendanceHoy = useMemo(() => {
    const classIds = new Set(myClasses.map((c) => c.id))
    const hoy = attendanceCol.items.filter((a) => a.date === todayIso() && classIds.has(a.classId))
    const total = hoy.reduce((sum, a) => sum + a.entries.length, 0)
    const presentes = hoy.reduce((sum, a) => sum + a.entries.filter((e) => e.status === 'presente').length, 0)
    return { total, presentes, pct: total ? Math.round((presentes / total) * 100) : null }
  }, [attendanceCol.items, myClasses])

  const pendientes = useMemo(() => {
    const vencidas = myPlans.filter((p) => p.status !== 'impartida' && p.status !== 'cancelada' && p.date < todayIso()).length
    const enProgreso = myClasses.filter((c) => c.status === 'en_progreso').length
    return vencidas + enProgreso
  }, [myPlans, myClasses])

  const upcoming = useMemo(() => {
    return myPlans
      .filter((p) => p.status === 'planificada' && p.date >= todayIso())
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(0, 6)
  }, [myPlans])

  const recent = useMemo(() => {
    return myClasses
      .filter((c) => c.status === 'completada')
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6)
  }, [myClasses])

  const { claseActual, claseProxima } = useMemo(() => {
    const hoy = myPlans.filter((p) => p.date === todayIso()).sort((a, b) => periodStart(a.period) - periodStart(b.period))
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    let actual: ClassPlan | undefined
    let proxima: ClassPlan | undefined
    for (const p of hoy) {
      const start = periodStart(p.period)
      if (start < 0) continue
      const end = periodStart(p.period.split('-')[1]?.trim() ?? p.period) || start + 45
      if (start <= nowMin && nowMin < end) actual = p
      if (!actual && start > nowMin && !proxima) proxima = p
    }
    if (!proxima) proxima = hoy.find((p) => periodStart(p.period) > nowMin)
    return { claseActual: actual, claseProxima: proxima }
  }, [myPlans])

  const pausa = PAUSAS[new Date().getMinutes() % PAUSAS.length]

  const startClass = async (plan: ClassPlan) => {
    const subject = subjectById(plan.subjectId)
    const record: SchoolClassRecord = {
      id: genId('class'),
      planId: plan.id,
      subjectId: plan.subjectId,
      teacherId: plan.teacherId,
      gradeId: plan.gradeId,
      date: plan.date,
      period: plan.period,
      title: `${subject?.name ?? ''} · ${plan.topic}`,
      status: 'en_progreso',
      before: {
        objectives: plan.objective,
        content: plan.content,
        activities: '',
        resources: plan.resources,
        cronograma: `${plan.period}: ${plan.topic}`,
      },
      during: { development: '', participation: '', observations: '' },
      after: { reflection: '', achieved: '', toImprove: '', report: '' },
      createdAt: new Date().toISOString(),
    }
    await classesCol.save(record)
    await plansCol.save({ ...plan, status: 'impartida', classId: record.id })
    navigate('/docentes/clases/' + record.id)
  }

  const heroActions = (
    <div className={styles.heroActions}>
      <Button appearance="secondary" icon={<PlayRegular />} style={{ background: '#fff', color: 'var(--azul)', fontWeight: 600 }} onClick={() => navigate('/docentes/planificacion')}>
        Impartir clase
      </Button>
      <Button appearance="secondary" icon={<CalendarCheckmarkRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/docentes/asistencia')}>
        Tomar asistencia
      </Button>
      <Button appearance="secondary" icon={<AddRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/docentes/planificaciones')}>
        Nueva planificación
      </Button>
    </div>
  )

  return (
    <div>
      <WelcomeHero
        title={<span>¡Hola, {teacher?.fullName ?? user?.displayName}! 👋</span>}
        subtitle={`Portal de ${ROLE_LABELS[role ?? 'docente']}. Gestione su planificación anual y diaria, registre clases, controle la asistencia y acompañe a sus estudiantes.`}
        actions={heroActions}
      />

      <div className={styles.kpis}>
        <StatCard title="Planificaciones creadas" value={myPlans.length + myDaily.length} icon={<NotebookRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub={`${myDaily.length} diarias/unidad · ${myPlans.length} anual`} />
        <StatCard title="Total de estudiantes" value={totalEstudiantes} icon={<PeopleRegular />} color="#0095C8" gradient={gradientes.azul} sub="En los grados que imparte" />
        <StatCard
          title="Asistencia de hoy"
          value={attendanceHoy.pct == null ? '—' : `${attendanceHoy.pct}%`}
          icon={<CalendarCheckmarkRegular />}
          color="#15803D"
          gradient={gradientes.verde}
          sub={attendanceHoy.pct == null ? 'Aún sin registrar' : `${attendanceHoy.presentes} presentes de ${attendanceHoy.total}`}
        />
        <StatCard title="Pendientes / Alertas" value={pendientes} icon={<AlertRegular />} color="#EA580C" gradient={gradientes.naranja} sub="Clases vencidas o en progreso" />
      </div>

      <div className={styles.grid}>
        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Horario del día</Text>
            <Button appearance="subtle" size="small" onClick={() => navigate('/docentes/planificacion')}>
              Ver todo <ArrowRightRegular />
            </Button>
          </div>
          <div className={styles.ahora}>
            {claseActual ? (
              <div className={`${styles.claseCard} ${styles.claseActual}`}>
                <Text size={200} weight="semibold" style={{ color: '#0095C8' }}>EN ESTE MOMENTO · {claseActual.period}</Text>
                <Text weight="semibold">{subjectById(claseActual.subjectId)?.name} · {gradeById(claseActual.gradeId)?.name}</Text>
                <Text size={300} className={styles.subtitle}>{claseActual.topic}</Text>
                <Button size="small" appearance="primary" icon={<PlayRegular />} onClick={() => void startClass(claseActual)} style={{ alignSelf: 'flex-start' }}>
                  Iniciar clase
                </Button>
              </div>
            ) : (
              <Text size={300} className={styles.subtitle}>No hay clase en curso ahora.</Text>
            )}
            {claseProxima ? (
              <div className={`${styles.claseCard} ${styles.claseProxima}`}>
                <Text size={200} weight="semibold" style={{ color: '#9A9C2E' }}>PRÓXIMA · {claseProxima.period}</Text>
                <Text weight="semibold">{subjectById(claseProxima.subjectId)?.name} · {gradeById(claseProxima.gradeId)?.name}</Text>
                <Text size={300} className={styles.subtitle}>{claseProxima.topic}</Text>
              </div>
            ) : (
              <Text size={300} className={styles.subtitle}><ArrowNextRegular /> Sin más clases hoy.</Text>
            )}
          </div>
        </div>

        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Pausa Activa</Text>
            <HeartPulseRegular style={{ color: '#0095C8' }} />
          </div>
          <div className={styles.pausa}>
            <Text weight="semibold" style={{ color: '#fff' }}>Recomendación de bienestar</Text>
            <Text size={400} style={{ color: '#fff', lineHeight: 1.5 }}>{pausa}</Text>
            <Text size={200} style={{ color: 'rgba(255,255,255,0.7)' }}>Se renueva automáticamente durante la jornada.</Text>
          </div>
        </div>

        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Próximas clases</Text>
            <Button appearance="subtle" size="small" onClick={() => navigate('/docentes/planificacion')}>
              Ver todo <ArrowRightRegular />
            </Button>
          </div>
          {upcoming.length === 0 && <Text size={300} className={styles.subtitle}>No hay clases programadas próximamente.</Text>}
          {upcoming.length > 0 && (
            <Table aria-label="Próximas clases">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Asignatura</TableHeaderCell>
                  <TableHeaderCell>Tema</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Text size={300} weight="semibold" block>{relativeDay(p.date)}</Text>
                      <Text size={200} className={styles.subtitle}>{formatDate(p.date)} · {p.period}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge appearance="tint" color="informative">{subjectById(p.subjectId)?.shortName ?? ''}</Badge>
                    </TableCell>
                    <TableCell>{p.topic}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Clases recientes</Text>
            <Button appearance="subtle" size="small" onClick={() => navigate('/docentes/clases')}>
              Ver todo <ArrowRightRegular />
            </Button>
          </div>
          {recent.length === 0 && <Text size={300} className={styles.subtitle}>Aún no ha registrado clases completadas.</Text>}
          {recent.length > 0 && (
            <Table aria-label="Clases recientes">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Clase</TableHeaderCell>
                  <TableHeaderCell>Grado</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell>{gradeById(c.gradeId)?.name ?? ''}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
