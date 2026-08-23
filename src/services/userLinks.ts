import type { Period, Teacher, TeacherAssignment, User } from '../types'
import type { Role } from '../types/roles'
import { dataService } from './dataService'
import { listEntraUsers, type EntraUser } from './entraUsers'
import { genId } from '../utils/helpers'

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

/**
 * Sincroniza las asignaciones docentes del período activo con las combinaciones
 * grado × asignatura marcadas en la ficha del docente: crea las que falten y retira,
 * solo dentro de ese período, las que ya no correspondan.
 */
export async function syncTeacherAssignments(teacher: Teacher, periods: Period[]): Promise<{ created: number; removed: number; period?: Period }> {
  const period = periods.find((p) => p.isActive) ?? periods[0]
  if (!period) return { created: 0, removed: 0 }
  const all = await dataService.getTeacherAssignments()
  const mine = all.filter((a) => a.teacherId === teacher.id && a.periodId === period.id)
  const wanted = new Set<string>()
  for (const gradeId of teacher.grades) for (const subjectId of teacher.subjects) wanted.add(`${gradeId}|${subjectId}`)

  let created = 0
  let removed = 0
  for (const key of wanted) {
    const [gradeId, subjectId] = key.split('|')
    if (!mine.some((a) => a.gradeId === gradeId && a.subjectId === subjectId)) {
      const assignment: TeacherAssignment = { id: genId('ta'), teacherId: teacher.id, gradeId, subjectId, periodId: period.id }
      await dataService.saveTeacherAssignment(assignment)
      created++
    }
  }
  for (const a of mine) {
    if (!wanted.has(`${a.gradeId}|${a.subjectId}`)) {
      await dataService.deleteTeacherAssignment(a.id)
      removed++
    }
  }
  return { created, removed, period }
}
