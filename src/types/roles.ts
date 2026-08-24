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

/**
 * Expande una lista de roles (fijos o personalizados) a los roles de portal
 * a los que dan acceso, usando los metadatos de ARC_RoleMeta.
 */
export function expandPortalRoles(roleIds: string[], meta: Array<{ id: string; portal?: string; custom?: boolean }>): Role[] {
  const out = new Set<Role>()
  for (const id of roleIds) {
    if (id in ROLE_LABELS) {
      out.add(id as Role)
      continue
    }
    const m = meta.find((x) => x.id === id)
    if (m?.portal && m.portal in ROLE_LABELS) out.add(m.portal as Role)
  }
  return [...out]
}

export const ROLE_PATHS: Record<Role, string> = {
  docente: '/docentes',
  estudiante: '/estudiantes',
  padre: '/padres',
  admin: '/administrativo',
  psicologia: '/psicologia',
  tecnologia: '/tecnologia',
}
