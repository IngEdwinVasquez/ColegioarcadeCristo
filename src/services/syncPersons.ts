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
  for (const s of students) {
    await resolver(
      s,
      'Estudiante',
      async (n, u) => dataService.saveStudent({ ...s, fullName: n, email: s.email || emailDe(u), userId: s.userId || u.id }),
      async () => {
        for (const e of enrollments.filter((e) => e.studentId === s.id)) await dataService.deleteEnrollment(e.id)
        for (const g of guardians.filter((g) => g.studentId === s.id)) await dataService.deleteGuardian(g.id)
        await dataService.deleteStudent(s.id)
      },
    )
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
  const validStudentIds = new Set(students.filter((s) => nombreValido(match(s))).map((s) => s.id))
  const validTeacherIds = new Set(teachers.filter((t) => nombreValido(match(t))).map((t) => t.id))

  for (const e of enrollments) if (!validStudentIds.has(e.studentId)) { await dataService.deleteEnrollment(e.id); personasEliminadas++ }
  for (const g of guardians) if (!validStudentIds.has(g.studentId)) { await dataService.deleteGuardian(g.id); personasEliminadas++ }
  for (const a of assignments) if (!validTeacherIds.has(a.teacherId)) { await dataService.deleteTeacherAssignment(a.id) }

  const scores = await dataService.getScores()
  for (const sc of scores) if (!validStudentIds.has(sc.studentId)) await dataService.deleteScore(sc.id)

  return { nombresActualizados, personasEliminadas, detalle }
}
