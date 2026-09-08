import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Text, makeStyles } from '@fluentui/react-components'
import { VideoRegular, BookOpenRegular, ArrowRightRegular } from '@fluentui/react-icons'
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
  meta: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: { padding: '4px 12px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontSize: '12px', fontWeight: 700 },
  link: { display: 'flex', alignItems: 'center', gap: '6px', color: '#0082AD', fontWeight: 700, fontSize: '13px' },
  sub: { color: 'var(--texto-suave)' },
})

export function MisAulasPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { user, subjectById, gradeById, teacherById } = useApp()
  const configsCol = useCollection<TeacherGradeConfig>(dataService.getTeacherConfigs)
  const teacher = teacherById(user?.teacherId)
  const teacherConfig = configsCol.items.find((c) => c.teacherId === user?.teacherId)

  const aulas = useMemo(() => {
    const out: Array<{ subjectId: string; gradeId: string; section: string }> = []
    const subjectIds = teacher?.subjects ?? []
    const selections = teacherConfig?.selection?.length ? teacherConfig.selection : (teacher?.grades ?? []).map((g) => ({ gradeId: g, section: '' }))
    for (const sel of selections) for (const subjectId of subjectIds) out.push({ subjectId, gradeId: sel.gradeId, section: sel.section })
    return out.filter((a) => subjectById(a.subjectId) && gradeById(a.gradeId))
  }, [teacher, teacherConfig, subjectById, gradeById])

  const enter = (a: { subjectId: string; gradeId: string; section: string }) => {
    navigate(`/docentes/aulas/${encodeURIComponent(`${a.subjectId}|${a.gradeId}|${a.section}`)}`)
  }

  if (!teacher) {
    return (
      <div>
        <PageHeader title="Mis Aulas" subtitle="Sus asignaturas asignadas por nivel, grado y sección." />
        <EmptyStateView title="Sin aulas" message="Su cuenta aún no está vinculada a una ficha de docente. Contacte a Tecnología." icon={<VideoRegular />} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Mis Aulas" subtitle="Aulas (asignatura × grado × sección) asignadas desde el portal de Tecnología. Entre a una aula para gestionar sus clases." />
      {aulas.length === 0 && (
        <EmptyStateView title="Sin aulas asignadas" message="No tiene asignaturas asignadas. Solicite a Tecnología la asignación de materias y cursos." icon={<VideoRegular />} />
      )}
      <div className={styles.grid}>
        {aulas.map((a) => {
          const subj = subjectById(a.subjectId)
          const grade = gradeById(a.gradeId)
          return (
            <Card key={`${a.subjectId}-${a.gradeId}-${a.section}`} className={styles.card} onClick={() => enter(a)}>
              <span className={styles.icon} style={{ background: `linear-gradient(135deg, ${subj?.color ?? '#0082AD'}, ${subj?.color ?? '#0082AD'}cc)` }}>
                <BookOpenRegular />
              </span>
              <Text weight="semibold" size={400}>{subj?.name}</Text>
              <div className={styles.meta}>
                <span className={styles.chip}>{grade?.level ?? 'Primaria'}</span>
                <span className={styles.chip}>{grade?.name}</span>
                {a.section && <span className={styles.chip}>Sección {a.section}</span>}
              </div>
              <span className={styles.link}>Abrir Mis Clases <ArrowRightRegular /></span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
