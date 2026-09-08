import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Text, makeStyles } from '@fluentui/react-components'
import { BookOpenRegular, ArrowRightRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { TeacherGradeConfig } from '../../types'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '18px' },
  card: { padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', ':hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,130,173,0.18)' } },
  icon: { width: '50px', height: '50px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px' },
  sub: { color: 'var(--texto-suave)' },
  link: { display: 'flex', alignItems: 'center', gap: '6px', color: '#0082AD', fontWeight: 700, fontSize: '13px' },
})

export function AulaPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const params = useParams()
  const { user, subjectById, gradeById, teacherById } = useApp()
  const configsCol = useCollection<TeacherGradeConfig>(dataService.getTeacherConfigs)

  const gradeId = params.gradeId ?? ''
  const section = decodeURIComponent(params.section ?? '')
  const teacher = teacherById(user?.teacherId)
  const teacherConfig = configsCol.items.find((c) => c.teacherId === user?.teacherId)

  const subjects = useMemo(() => (teacher?.subjects ?? []).map((id) => subjectById(id)).filter(Boolean), [teacher, subjectById])
  const grade = gradeById(gradeId)

  const allowed = (!teacherConfig?.masterMode)
    ? teacherConfig?.selection?.some((s) => s.gradeId === gradeId && s.section === section)
    : true

  if (allowed === false) {
    return <EmptyStateView title="Aula no disponible" message="Esta aula no corresponde a sus asignaciones." />
  }

  return (
    <div>
      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--azul)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }} onClick={() => navigate('/docentes/aulas')}>
        <ArrowLeftRegular /> Volver a Mis Aulas
      </button>
      <PageHeader title={`Aula · ${grade?.name ?? ''}${section ? ` · Sección ${section}` : ''}`} subtitle="Asignaturas que imparte en este curso. Seleccione una para gestionar sus clases, planificación y más." />
      {subjects.length === 0 && <EmptyStateView title="Sin asignaturas" message="No tiene asignaturas asignadas a este curso. Solicite a Tecnología su asignación." icon={<BookOpenRegular />} />}
      <div className={styles.grid}>
        {subjects.map((s) => (
          <Card key={s!.id} className={styles.card} onClick={() => navigate(`/docentes/aulas/${gradeId}/${encodeURIComponent(section)}/${s!.id}`)}>
            <span className={styles.icon} style={{ background: `linear-gradient(135deg, ${s!.color ?? '#0082AD'}, ${s!.color ?? '#0082AD'}cc)` }}><BookOpenRegular /></span>
            <Text weight="semibold" size={400}>{s!.name}</Text>
            <Text size={200} className={styles.sub}>{grade?.level ?? 'Primaria'} · {grade?.name}{section ? ` · ${section}` : ''}</Text>
            <span className={styles.link}>Abrir asignatura <ArrowRightRegular /></span>
          </Card>
        ))}
      </div>
    </div>
  )
}
