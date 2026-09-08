import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Text, makeStyles } from '@fluentui/react-components'
import { VideoRegular, ArrowRightRegular } from '@fluentui/react-icons'
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
  chip: { padding: '4px 12px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontSize: '12px', fontWeight: 600 },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
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
  const subjects = teacher?.subjects ?? []

  // Aulas (grupos por grado + sección) que el docente atiende.
  const aulas = useMemo(() => {
    const raw = teacherConfig?.selection?.length ? teacherConfig.selection : (teacher?.grades ?? []).map((g) => ({ gradeId: g, section: '' }))
    const seen = new Map<string, { gradeId: string; section: string }>()
    for (const sel of raw) {
      if (!gradeById(sel.gradeId)) continue
      seen.set(`${sel.gradeId}|${sel.section}`, { gradeId: sel.gradeId, section: sel.section })
    }
    return [...seen.values()]
  }, [teacherConfig, teacher, gradeById])

  if (!teacher) {
    return (
      <div>
        <PageHeader title="Mis Aulas" subtitle="Sus aulas (grupos por grado y sección) asignadas." />
        <EmptyStateView title="Sin aulas" message="Su cuenta aún no está vinculada a una ficha de docente. Contacte a Tecnología." icon={<VideoRegular />} />
      </div>
    )
  }

  const sinGrados = teacher.grades.length === 0 && (!teacherConfig?.selection?.length)

  return (
    <div>
      <PageHeader title="Mis Aulas" subtitle="Aulas (grupos por grado y sección) asignadas desde el portal de Tecnología. Entre a un aula para ver sus asignaturas." />
      {aulas.length === 0 && (
        <EmptyStateView
          title="Sin aulas configuradas"
          message={sinGrados
            ? 'Aún no tiene aulas (grado/sección) asignadas. Solicite a Tecnología que agregue el Nivel (Inicial, Primaria o Secundaria; en Primaria/Secundaria el Ciclo: Primer o Segundo), el Grado y la Sección de cada asignatura. Mientras tanto, sus asignaturas se muestran abajo.'
            : 'No tiene aulas asignadas. Solicite a Tecnología la asignación de cursos y materias.'}
          icon={<VideoRegular />}
        />
      )}
      {aulas.length === 0 && subjects.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <Text weight="semibold" size={400} block style={{ marginBottom: '10px' }}>Mis asignaturas (pendientes de aula)</Text>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {subjects.map((id) => {
              const s = subjectById(id)
              return <span key={id} className={styles.chip}>{s?.name ?? id}</span>
            })}
          </div>
        </div>
      )}
      <div className={styles.grid}>
        {aulas.map((a) => {
          const grade = gradeById(a.gradeId)
          return (
            <Card key={`${a.gradeId}-${a.section}`} className={styles.card} onClick={() => navigate(`/docentes/aulas/${a.gradeId}/${encodeURIComponent(a.section)}`)}>
              <span className={styles.icon} style={{ background: 'linear-gradient(135deg, #0082AD, #2AA9D8)' }}><VideoRegular /></span>
              <Text weight="semibold" size={400}>{grade?.name}</Text>
              <div className={styles.chips}><span className={styles.chip}>Sección {a.section || 'Toda'}</span><span className={styles.chip}>{subjects.length} asignatura(s)</span></div>
              <span className={styles.link}>Abrir aula <ArrowRightRegular /></span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
