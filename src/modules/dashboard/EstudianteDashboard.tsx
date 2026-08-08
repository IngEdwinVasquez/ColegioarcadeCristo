import { useApp } from '../../context/useApp'
import { StudentResumen } from './StudentResumen'
import { WelcomeHero } from '../../components/shared/WelcomeHero'

export function EstudianteDashboard() {
  const { user, studentById } = useApp()
  const student = studentById(user?.studentId)

  return (
    <div>
      <WelcomeHero
        title={<span>Hola, {student?.fullName ?? user?.displayName} 👋</span>}
        subtitle="Bienvenido a tu Campus Virtual. Consulta tus asignaturas, entrega tus tareas a tiempo, revisa tus calificaciones y participa activamente en tus actividades escolares."
      />
      <StudentResumen studentId={user?.studentId ?? ''} />
    </div>
  )
}
