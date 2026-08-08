import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles, Badge } from '@fluentui/react-components'
import {
  CalendarTodayRegular,
  CheckmarkCircleRegular,
  ClipboardTaskRegular,
  NotebookRegular,
  PlayRegular,
  ArrowRightRegular,
  CalendarCheckmarkRegular,
  AddRegular,
} from '@fluentui/react-icons'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Activity, ClassPlan, SchoolClassRecord } from '../../types'
import { formatDate, relativeDay, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  subtitle: { color: 'var(--texto-suave)' },
  heroActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
})

export function DocenteDashboard() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { user, teacherById, subjectById, gradeById } = useApp()
  const teacher = teacherById(user?.teacherId)

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)

  const myPlans = useMemo(() => plansCol.items.filter((p) => p.teacherId === user?.teacherId), [plansCol.items, user?.teacherId])
  const myClasses = useMemo(() => classesCol.items.filter((c) => c.teacherId === user?.teacherId), [classesCol.items, user?.teacherId])
  const myActivities = useMemo(() => activitiesCol.items.filter((a) => a.teacherId === user?.teacherId), [activitiesCol.items, user?.teacherId])

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

  const todayCount = myPlans.filter((p) => p.date === todayIso()).length

  const heroActions = (
    <div className={styles.heroActions}>
      <Button appearance="secondary" icon={<PlayRegular />} style={{ background: '#fff', color: 'var(--azul)', fontWeight: 600 }} onClick={() => navigate('/docentes/planificacion')}>
        Impartir clase
      </Button>
      <Button appearance="secondary" icon={<CalendarCheckmarkRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/docentes/asistencia')}>
        Tomar asistencia
      </Button>
      <Button appearance="secondary" icon={<AddRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/docentes/aulas')}>
        Nueva actividad
      </Button>
    </div>
  )

  return (
    <div>
      <WelcomeHero
        title={<span>Buen día, {teacher?.fullName ?? user?.displayName} 👋</span>}
        subtitle="Bienvenido a su centro de trabajo docente. Gestione su planificación anual, registre clases con su plan, desarrollo e informe, controle la asistencia y acompañe a sus estudiantes en el aula virtual."
        actions={heroActions}
      />

      <div className={styles.kpis}>
        <StatCard title="Clases de hoy" value={todayCount} icon={<CalendarTodayRegular />} color="#103F7E" gradient={gradientes.azul} sub={`${upcoming.filter((p) => p.date === todayIso()).length} por impartir hoy`} />
        <StatCard title="Clases completadas" value={myClasses.filter((c) => c.status === 'completada').length} icon={<CheckmarkCircleRegular />} color="#15803D" gradient={gradientes.verde} sub="Con registro antes / durante / después" />
        <StatCard title="Clases planificadas" value={myPlans.length} icon={<NotebookRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub="Planificación anual" />
        <StatCard title="Actividades publicadas" value={myActivities.length} icon={<ClipboardTaskRegular />} color="#EA580C" gradient={gradientes.naranja} sub="En las aulas virtuales" />
      </div>

      <div className={styles.grid}>
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
            <Text weight="semibold" size={400}>Clases recientes registradas</Text>
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
