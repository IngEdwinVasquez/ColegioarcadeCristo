import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, makeStyles } from '@fluentui/react-components'
import {
  PeopleRegular,
  PersonSupportRegular,
  CalendarLtrRegular,
  HeartPulseRegular,
  ArrowRightRegular,
  CheckmarkCircleRegular,
  AddRegular,
} from '@fluentui/react-icons'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { WelcomeHero } from '../../components/shared/WelcomeHero'
import { gradientes } from '../../theme'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import type { Accompaniment, ClassSchedule, SchoolClassRecord } from '../../types'
import { formatDate, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '20px' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  subtitle: { color: 'var(--texto-suave)' },
  heroActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
})

export function CoordDashboard() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { teachers, students, grades, gradeById, teacherById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()

  const schedulesCol = useCollection<ClassSchedule>(dataService.getSchedules)
  const accsCol = useCollection<Accompaniment>(dataService.getAccompaniments)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)

  const levelGradeIds = useMemo(() => grades.filter((g) => g.level === level).map((g) => g.id), [grades, level])
  const levelTeachers = useMemo(() => teachers.filter((t) => t.grades.some((g) => levelGradeIds.includes(g))), [teachers, levelGradeIds])
  const levelStudents = useMemo(() => students.filter((s) => levelGradeIds.includes(s.gradeId)), [students, levelGradeIds])
  const levelSchedules = useMemo(() => schedulesCol.items.filter((s) => levelGradeIds.includes(s.gradeId)), [schedulesCol.items, levelGradeIds])
  const levelAccs = useMemo(() => accsCol.items.filter((a) => a.level === level), [accsCol.items, level])
  const levelClasses = useMemo(() => classesCol.items.filter((c) => levelGradeIds.includes(c.gradeId)), [classesCol.items, levelGradeIds])

  const hoy = todayIso()
  const pendientes = levelAccs.filter((a) => a.status === 'planificado').length
  const realizados = levelAccs.filter((a) => a.status === 'realizado').length

  const clasesHoy = levelClasses.filter((c) => c.date === hoy)

  const heroActions = (
    <div className={styles.heroActions}>
      <Button appearance="secondary" icon={<PersonSupportRegular />} style={{ background: '#fff', color: 'var(--azul)', fontWeight: 600 }} onClick={() => navigate('/coordinacion/personas')}>
        Docentes y estudiantes
      </Button>
      <Button appearance="secondary" icon={<CalendarLtrRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/coordinacion/horarios')}>
        Horarios de clase
      </Button>
      <Button appearance="secondary" icon={<HeartPulseRegular />} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 600 }} onClick={() => navigate('/coordinacion/acompanamientos')}>
        Acompañar docente
      </Button>
    </div>
  )

  return (
    <div>
      <WelcomeHero
        title={<span>Coordinación Pedagógica · {level} 👋</span>}
        subtitle={`Acompañamiento a la práctica docente de ${level}: listas por curso, horarios, verificación de cumplimiento y mejora de la enseñanza alineada al currículo MINERD.`}
        actions={heroActions}
      />

      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
        <Button appearance="primary" icon={<AddRegular />} onClick={() => navigate('/coordinacion/acompanamientos')}>
          Nuevo acompañamiento
        </Button>
      </div>

      <div className={styles.kpis}>
        <StatCard title="Docentes del nivel" value={levelTeachers.length} icon={<PersonSupportRegular />} color="#0082AD" gradient={gradientes.azul} sub={`En ${levelGradeIds.length} curso(s)`} />
        <StatCard title="Estudiantes del nivel" value={levelStudents.length} icon={<PeopleRegular />} color="#0EA5E9" gradient={gradientes.celeste} sub="Matrícula por curso" />
        <StatCard title="Clases asignadas" value={levelSchedules.length} icon={<CalendarLtrRegular />} color="#15803D" gradient={gradientes.verde} sub="Horarios registrados" />
        <StatCard title="Acompañamientos" value={levelAccs.length} icon={<HeartPulseRegular />} color="#EA580C" gradient={gradientes.naranja} sub={`${pendientes} pendientes · ${realizados} realizados`} />
      </div>

      <div className={styles.grid}>
        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Clases de hoy</Text>
            <Button appearance="subtle" size="small" onClick={() => navigate('/coordinacion/cumplimiento')}>
              Ver cumplimiento <ArrowRightRegular />
            </Button>
          </div>
          {clasesHoy.length === 0 && <Text size={300} className={styles.subtitle}>No hay clases registradas para hoy en este nivel.</Text>}
          {clasesHoy.length > 0 && (
            <Table aria-label="Clases hoy">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Docente</TableHeaderCell>
                  <TableHeaderCell>Curso</TableHeaderCell>
                  <TableHeaderCell>Tema</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clasesHoy.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{teacherById(c.teacherId)?.fullName ?? '—'}</TableCell>
                    <TableCell>{gradeById(c.gradeId)?.name ?? ''}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="panel">
          <div className={styles.panelHead}>
            <Text weight="semibold" size={400}>Próximos acompañamientos</Text>
            <Button appearance="subtle" size="small" onClick={() => navigate('/coordinacion/acompanamientos')}>
              Ver todo <ArrowRightRegular />
            </Button>
          </div>
          {levelAccs.length === 0 && <Text size={300} className={styles.subtitle}>Aún no ha registrado acompañamientos.</Text>}
          {levelAccs.filter((a) => a.status === 'planificado').slice(0, 6).map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--borde)' }}>
              <CheckmarkCircleRegular style={{ color: 'var(--azul)', marginTop: '2px' }} />
              <div>
                <Text size={300} weight="semibold" block>{teacherById(a.teacherId)?.fullName ?? '—'}</Text>
                <Text size={200} className={styles.subtitle}>{formatDate(a.date)} · {a.topic}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
