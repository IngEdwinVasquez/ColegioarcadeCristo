import { dataService } from './dataService'
import { listEntraUsers, type EntraUser } from './entraUsers'

const GUID_LIKE = /^[a-z]?[-_]?[0-9a-f]{8}([-_][0-9a-f]{4}){3}[-_][0-9a-f]{12}$/i

export interface SyncPersonsResult {
  nombresActualizados: number
  personasEliminadas: number
  detalle: string[]
}

const emailDe = (u: EntraUser): string => (u.mail ?? u.userPrincipalName ?? '').toLowerCase()
const nombreDe = (u: EntraUser): string => (u.displayName ?? u.userPrincipalName ?? u.mail ?? '').trim()

/**
 * Sincroniza las fichas de la plataforma (docentes, estudiantes, acudientes y
 * personal) con los usuarios ACTIVOS de Microsoft 365:
 *  - Rellena el nombre desde la cuenta de M365 cuando falta o es un id.
 *  - Elimina las fichas sin cuenta activa en Microsoft 365.
 */
export async function syncPersonsWithEntra(): Promise<SyncPersonsResult> {
  const entra = await listEntraUsers()
  const byOid = new Map<string, EntraUser>(entra.map((u) => [u.id.toLowerCase(), u]))
  const byEmail = new Map<string, EntraUser>()
  for (const u of entra) { const e = emailDe(u); if (e) byEmail.set(e, u) }

  const match = (p: { userId?: string; email?: string }): EntraUser | undefined =>
    (p.userId ? byOid.get(p.userId.toLowerCase()) : undefined) ?? (p.email ? byEmail.get(p.email.toLowerCase()) : undefined)

  let nombresActualizados = 0
  let personasEliminadas = 0
  const detalle: string[] = []

  // ------------------------------ Docentes ------------------------------
  const teachers = await dataService.getTeachers()
  const assignments = await dataService.getTeacherAssignments()
  for (const t of teachers) {
    const u = match(t)
    if (!u) {
      for (const a of assignments.filter((a) => a.teacherId === t.id)) await dataService.deleteTeacherAssignment(a.id)
      await dataService.deleteTeacher(t.id)
      personasEliminadas++
      detalle.push(`Docente eliminado (sin usuario activo): ${t.fullName || t.id}`)
      continue
    }
    const nombre = nombreDe(u)
    if (nombre && (GUID_LIKE.test((t.fullName ?? '').trim()) || !t.fullName || t.fullName.trim().toLowerCase() !== nombre.toLowerCase())) {
      await dataService.saveTeacher({ ...t, fullName: nombre, email: t.email || emailDe(u), userId: t.userId || u.id })
      nombresActualizados++
    }
  }

  // ------------------------------ Estudiantes ------------------------------
  const students = await dataService.getStudents()
  const enrollments = await dataService.getEnrollments()
  const guardians = await dataService.getGuardians()
  for (const s of students) {
    const u = match(s)
    if (!u) {
      for (const e of enrollments.filter((e) => e.studentId === s.id)) await dataService.deleteEnrollment(e.id)
      for (const g of guardians.filter((g) => g.studentId === s.id)) await dataService.deleteGuardian(g.id)
      await dataService.deleteStudent(s.id)
      personasEliminadas++
      detalle.push(`Estudiante eliminado (sin usuario activo): ${s.fullName || s.id}`)
      continue
    }
    const nombre = nombreDe(u)
    if (nombre && (GUID_LIKE.test((s.fullName ?? '').trim()) || !s.fullName || s.fullName.trim().toLowerCase() !== nombre.toLowerCase())) {
      await dataService.saveStudent({ ...s, fullName: nombre, email: s.email || emailDe(u), userId: s.userId || u.id })
      nombresActualizados++
    }
  }

  // ------------------------------ Acudientes ------------------------------
  for (const g of guardians) {
    const u = match(g)
    if (!u) {
      await dataService.deleteGuardian(g.id)
      personasEliminadas++
      detalle.push(`Acudiente eliminado (sin usuario activo): ${g.fullName || g.id}`)
      continue
    }
    const nombre = nombreDe(u)
    if (nombre && (GUID_LIKE.test((g.fullName ?? '').trim()) || !g.fullName || g.fullName.trim().toLowerCase() !== nombre.toLowerCase())) {
      await dataService.saveGuardian({ ...g, fullName: nombre, email: g.email || emailDe(u), userId: g.userId || u.id })
      nombresActualizados++
    }
  }

  // ------------------------------ Personal (Persona) ------------------------------
  const personas = await dataService.getPersonas()
  for (const p of personas) {
    const u = match(p)
    if (!u) {
      await dataService.deletePersona(p.id)
      personasEliminadas++
      detalle.push(`Personal eliminado (sin usuario activo): ${p.fullName || p.id}`)
      continue
    }
    const nombre = nombreDe(u)
    if (nombre && (GUID_LIKE.test((p.fullName ?? '').trim()) || !p.fullName || p.fullName.trim().toLowerCase() !== nombre.toLowerCase())) {
      await dataService.savePersona({ ...p, fullName: nombre, email: p.email || emailDe(u), userId: p.userId || u.id })
      nombresActualizados++
    }
  }

  return { nombresActualizados, personasEliminadas, detalle }
}
