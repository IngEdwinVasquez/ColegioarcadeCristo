import type { User } from '../types'
import type { Role } from '../types/roles'
import { dataService } from './dataService'
import { listEntraUsers, type EntraUser } from './entraUsers'

/** Caché de usuarios del directorio (se comparte entre selectores durante la sesión). */
let directoryCache: Promise<EntraUser[]> | null = null

export function getDirectoryUsers(force = false): Promise<EntraUser[]> {
  if (!directoryCache || force) {
    directoryCache = listEntraUsers().catch((error: unknown) => {
      directoryCache = null
      throw error
    })
  }
  return directoryCache
}

export const entraEmail = (u: EntraUser): string => (u.mail ?? u.userPrincipalName ?? '').toLowerCase()

export interface LinkTarget {
  teacherId?: string
  studentId?: string
}

/**
 * Garantiza que la cuenta de Entra ID tenga el rol indicado en ARC_Users y quede
 * vinculada a su ficha (docente o estudiante). Crea el usuario si no existía.
 */
export async function linkUserRole(account: EntraUser, role: Role, link: LinkTarget = {}): Promise<User> {
  const users = await dataService.getUsers()
  const email = entraEmail(account)
  const existing = users.find((u) => u.id === account.id) ?? users.find((u) => u.email.toLowerCase() === email)
  const roles = new Set<Role>(existing?.roles ?? [])
  roles.add(role)
  const next: User = {
    id: account.id,
    displayName: account.displayName ?? existing?.displayName ?? email,
    email,
    jobTitle: account.jobTitle ?? existing?.jobTitle,
    roles: [...roles],
    teacherId: link.teacherId ?? existing?.teacherId,
    studentId: link.studentId ?? existing?.studentId,
    updatedAt: new Date().toISOString(),
  }
  if (existing && existing.id !== next.id) {
    // Registro previo identificado solo por correo: se reemplaza por el oid real.
    await dataService.deleteUser(existing.id)
  }
  await dataService.saveUser(next)
  return next
}

/**
 * Quita el rol (y el vínculo) de la cuenta cuando se elimina la ficha asociada.
 * Si el usuario se queda sin roles, se conserva el registro con roles vacíos
 * (pierde el acceso hasta que Dirección le asigne otro).
 */
export async function unlinkUserRole(userId: string | undefined, role: Role, link: LinkTarget = {}): Promise<void> {
  if (!userId) return
  const users = await dataService.getUsers()
  const existing = users.find((u) => u.id === userId)
  if (!existing) return
  const next: User = {
    ...existing,
    roles: existing.roles.filter((r) => r !== role),
    teacherId: link.teacherId && existing.teacherId === link.teacherId ? undefined : existing.teacherId,
    studentId: link.studentId && existing.studentId === link.studentId ? undefined : existing.studentId,
    updatedAt: new Date().toISOString(),
  }
  await dataService.saveUser(next)
}
