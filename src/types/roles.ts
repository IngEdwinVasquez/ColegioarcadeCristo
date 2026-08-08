export type Role = 'docente' | 'estudiante' | 'padre' | 'admin'

export const ROLE_LABELS: Record<Role, string> = {
  docente: 'Docente',
  estudiante: 'Estudiante',
  padre: 'Padre / Tutor',
  admin: 'Administrativo',
}

export const ROLE_PATHS: Record<Role, string> = {
  docente: '/docentes',
  estudiante: '/estudiantes',
  padre: '/padres',
  admin: '/administrativo',
}
