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

/** Nombre válido del usuario activo (no vacío ni con forma de id). */
function nombreValido(u?: EntraUser): string {
  if (!u) return ''
  const n = nombreDe(u)
  return n && !GUID_LIKE.test(n) ? n : ''
}

interface Ficha {
  id: string
  fullName: string
  email?: string
  userId?: string
}

/**
 * Sincroniza las fichas de la plataforma (docentes, estudiantes, acudientes y
 * personal) con los usuarios ACTIVOS de Microsoft 365:
 *  - Rellena el nombre desde la cuenta de M365 cuando falta o es un id.
 *  - Elimina las fichas sin cuenta activa o cuya cuenta no tiene nombre válido.
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

  /** Actualiza el nombre o elimina la ficha según su cuenta de Microsoft 365. */
  const resolver = async (f: Ficha, tipo: string, persistir: (n: string, u: EntraUser) => Promise<void>, eliminar: () => Promise<void>) => {
    const u = match(f)
    const nombre = nombreValido(u)
    if (!u || !nombre) {
      await eliminar()
      personasEliminadas++
      detalle.push(`${tipo} eliminado (sin usuario activo o sin nombre): ${f.fullName || f.id}`)
      return
    }
    if (GUID_LIKE.test((f.fullName ?? '').trim()) || !f.fullName || f.fullName.trim().toLowerCase() !== nombre.toLowerCase()) {
      await persistir(nombre, u)
      nombresActualizados++
    }
  }

  // ------------------------------ Docentes ------------------------------
  const teachers = await dataService.getTeachers()
  const assignments = await dataService.getTeacherAssignments()
  for (const t of teachers) {
    await resolver(
      t,
      'Docente',
      async (n, u) => dataService.saveTeacher({ ...t, fullName: n, email: t.email || emailDe(u), userId: t.userId || u.id }),
      async () => {
        for (const a of assignments.filter((a) => a.teacherId === t.id)) await dataService.deleteTeacherAssignment(a.id)
        await dataService.deleteTeacher(t.id)
      },
    )
  }

  // ------------------------------ Estudiantes ------------------------------
  const students = await dataService.getStudents()
  const enrollments = await dataService.getEnrollments()
  const guardians = await dataService.getGuardians()

  /** Nombre correcto del estudiante: fullName, o el del SIGERD (nombres + apellidos), o la cuenta de M365. */
  const nombreEstudiante = (s: { fullName: string; sigerd?: { nombres?: string; primerApellido?: string; segundoApellido?: string } }, u?: EntraUser): string => {
    const actual = (s.fullName ?? '').trim()
    if (actual && !GUID_LIKE.test(actual)) return actual
    const sg = [s.sigerd?.nombres, s.sigerd?.primerApellido, s.sigerd?.segundoApellido].map((x) => (x ?? '').trim()).filter(Boolean).join(' ')
    if (sg && !GUID_LIKE.test(sg)) return sg
    return nombreValido(u)
  }

  for (const s of students) {
    const u = match(s)
    const nombre = nombreEstudiante(s, u)
    if (!nombre) {
      for (const e of enrollments.filter((e) => e.studentId === s.id)) await dataService.deleteEnrollment(e.id)
      for (const g of guardians.filter((g) => g.studentId === s.id)) await dataService.deleteGuardian(g.id)
      await dataService.deleteStudent(s.id)
      personasEliminadas++
      detalle.push(`Estudiante eliminado (sin nombre válido): ${s.fullName || s.id}`)
      continue
    }
    if ((s.fullName ?? '').trim() !== nombre) {
      await dataService.saveStudent({ ...s, fullName: nombre, email: s.email || (u ? emailDe(u) : ''), userId: s.userId || (u ? u.id : undefined) })
      nombresActualizados++
    }
  }

  // ------------------------------ Acudientes ------------------------------
  for (const g of guardians) {
    await resolver(
      g,
      'Acudiente',
      async (n, u) => dataService.saveGuardian({ ...g, fullName: n, email: g.email || emailDe(u), userId: g.userId || u.id }),
      async () => dataService.deleteGuardian(g.id),
    )
  }

  // ------------------------------ Personal (Persona) ------------------------------
  const personas = await dataService.getPersonas()
  for (const p of personas) {
    await resolver(
      p,
      'Personal',
      async (n, u) => dataService.savePersona({ ...p, fullName: n, email: p.email || emailDe(u), userId: p.userId || u.id }),
      async () => dataService.deletePersona(p.id),
    )
  }

  // ------------------- Limpieza de registros huérfanos -------------------
  // Elimina matrículas, acudientes, calificaciones y asignaciones que apunten a
  // personas ya inexistentes (evita que se muestren ids como "-39625d65-…").
  const validStudentIds = new Set(students.filter((s) => nombreEstudiante(s, match(s))).map((s) => s.id))
  const validTeacherIds = new Set(teachers.filter((t) => nombreValido(match(t))).map((t) => t.id))

  for (const e of enrollments) if (!validStudentIds.has(e.studentId)) { await dataService.deleteEnrollment(e.id); personasEliminadas++ }
  for (const g of guardians) if (!validStudentIds.has(g.studentId)) { await dataService.deleteGuardian(g.id); personasEliminadas++ }
  for (const a of assignments) if (!validTeacherIds.has(a.teacherId)) { await dataService.deleteTeacherAssignment(a.id) }

  const scores = await dataService.getScores()
  for (const sc of scores) if (!validStudentIds.has(sc.studentId)) await dataService.deleteScore(sc.id)

  return { nombresActualizados, personasEliminadas, detalle }
}

/**
 * Repara (sin eliminar) el nombre de los estudiantes cuyo `fullName` es un id
 * o está vacío, reconstruyéndolo desde su ficha SIGERD o, si no, desde su
 * cuenta de Microsoft 365. Devuelve cuántos se repararon y cuántos quedaron
 * sin una fuente de nombre.
 */
export async function repairStudentNames(): Promise<{ reparados: number; sinFuente: number }> {
  const students = await dataService.getStudents()
  const entra = await listEntraUsers()
  const byOid = new Map<string, EntraUser>(entra.map((u) => [u.id.toLowerCase(), u]))
  const byEmail = new Map<string, EntraUser>()
  for (const u of entra) { const e = emailDe(u); if (e) byEmail.set(e, u) }

  let reparados = 0
  let sinFuente = 0
  for (const s of students) {
    const actual = (s.fullName ?? '').trim()
    if (actual && !GUID_LIKE.test(actual)) continue
    const sg = [s.sigerd?.nombres, s.sigerd?.primerApellido, s.sigerd?.segundoApellido].map((x) => (x ?? '').trim()).filter(Boolean).join(' ')
    const u = (s.userId ? byOid.get(s.userId.toLowerCase()) : undefined) ?? (s.email ? byEmail.get(s.email.toLowerCase()) : undefined)
    const cuenta = u ? nombreValido(u) : ''
    const nombre = (sg && !GUID_LIKE.test(sg) ? sg : '') || cuenta
    if (!nombre) { sinFuente++; continue }
    await dataService.saveStudent({ ...s, fullName: nombre })
    reparados++
  }
  return { reparados, sinFuente }
}
