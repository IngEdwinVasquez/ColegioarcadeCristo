import { useNavigate } from 'react-router-dom'
import { AulasView, subjectIdOf } from '../aulas/aulas'
import { useApp } from '../../context/useApp'
import { seccionDe } from '../../utils/academic'
import type { GradeSection } from '../../types'

/**
 * "Mis Aulas" del docente: muestra las aulas (un aula por curso) donde tiene
 * asignaturas asignadas y, dentro de cada aula, únicamente esas asignaturas.
 */
export function MisAulasPage() {
  const navigate = useNavigate()
  const { user, subjects } = useApp()
  const teacherId = user?.teacherId ?? ''

  return (
    <AulasView
      scope={{ kind: 'docente', teacherId }}
      pageTitle="Mis Aulas"
      subtitle="Aulas donde tienes asignaturas asignadas. Entre a un aula para abrir sus asignaturas y su aula de Teams."
      onOpenSubject={(g: GradeSection) => navigate(`/docentes/aulas/${g.id}/${encodeURIComponent(seccionDe(g))}/${subjectIdOf(g, subjects)}/virtual`)}
    />
  )
}
