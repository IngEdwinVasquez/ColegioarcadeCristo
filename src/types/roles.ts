export type Role = 'docente' | 'estudiante' | 'padre' | 'admin' | 'psicologia' | 'tecnologia'

/** Roles con acceso a los módulos académicos compartidos (planificación, clases, encuentros). */
export const STAFF_ROLES: Role[] = ['admin', 'docente', 'psicologia', 'tecnologia']

export const ROLE_LABELS: Record<Role, string> = {
  docente: 'Docente',
  estudiante: 'Estudiante',
  padre: 'Padre / Tutor',
  admin: 'Administrativo',
  psicologia: 'Psicología y Orientación',
  tecnologia: 'Tecnología',
}

export const ROLE_PATHS: Record<Role, string> = {
  docente: '/docentes',
  estudiante: '/estudiantes',
  padre: '/padres',
  admin: '/administrativo',
  psicologia: '/psicologia',
  tecnologia: '/tecnologia',
}
