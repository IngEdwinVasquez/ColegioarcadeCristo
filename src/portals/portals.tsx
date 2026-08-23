import type { ReactNode } from 'react'
import type { Role } from '../types/roles'
import {
  PersonSupportRegular,
  PersonRegular,
  PeopleTeamRegular,
  PremiumPersonRegular,
} from '@fluentui/react-icons'

export interface PortalMeta {
  role: Role
  path: string
  title: string
  shortTitle: string
  description: string
  icon: ReactNode
  accent: string
}

export const PORTALS: PortalMeta[] = [
  {
    role: 'docente',
    path: '/docentes',
    title: 'Portal de Docentes',
    shortTitle: 'Docentes',
    description:
      'Bienvenido a su centro de trabajo docente. Acceda a la gestión académica, publicación de tareas, registro de evaluaciones, control de asistencia y seguimiento continuo a sus clases virtuales.',
    icon: <PersonSupportRegular />,
    accent: '#0084B3',
  },
  {
    role: 'estudiante',
    path: '/estudiantes',
    title: 'Campus Virtual de Estudiantes',
    shortTitle: 'Estudiantes',
    description:
      'Bienvenido a tu Campus Virtual. Encuentra tus asignaturas, consulta las guías de estudio, entrega tus tareas a tiempo y participa activamente en tus actividades escolares.',
    icon: <PersonRegular />,
    accent: '#C8102E',
  },
  {
    role: 'padre',
    path: '/padres',
    title: 'Portal de Padres y Tutores',
    shortTitle: 'Padres',
    description:
      'Bienvenido al Portal de Familias. Conéctese con el centro educativo, supervise el progreso académico de sus hijos, consulte reportes de asistencia y manténgase al día con las circulares oficiales.',
    icon: <PeopleTeamRegular />,
    accent: '#0B6E4F',
  },
  {
    role: 'admin',
    path: '/administrativo',
    title: 'Portal Administrativo',
    shortTitle: 'Administrativo',
    description:
      'Espacio ejecutivo para el monitoreo institucional, análisis de indicadores de rendimiento académico, supervisión docente y toma de decisiones estratégicas.',
    icon: <PremiumPersonRegular />,
    accent: '#7D1D24',
  },
]

export const portalByRole = (role?: Role | null): PortalMeta | undefined =>
  PORTALS.find((p) => p.role === role)

