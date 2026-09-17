import { dataService } from './dataService'
import { genId } from '../utils/helpers'
import { entraEmail, getDirectoryUsers, linkUserRole, unlinkUserRole, type LinkTarget } from './userLinks'
import type { Persona, PersonaTipo, Student, StudentGuardian, Teacher } from '../types'
import type { Role } from '../types/roles'

export type PersonKind = 'estudiante' | 'docente' | 'padre' | 'persona'

export interface PersonRef {
  kind: PersonKind
  id: string
  fullName: string
  userId?: string
  email?: string
  tipo?: PersonaTipo
}

export interface PersonGroup {
  key: string
  label: string
  color: string
  kind: PersonKind
  tipo?: PersonaTipo
  tipos?: PersonaTipo[]
}

/** Grupos de personas por rol (igual que las pestañas de Datos institucionales). */
export const PERSON_GROUPS: PersonGroup[] = [
  { key: 'estudiantes', label: 'Estudiantes', color: '#004D6B', kind: 'estudiante' },
  { key: 'docentes', label: 'Docentes', color: '#2E7D32', kind: 'docente' },
  { key: 'familias', label: 'Familias', color: '#7D1D24', kind: 'padre' },
  { key: 'padres', label: 'Padres', color: '#5B6B1F', kind: 'padre' },
  { key: 'coordinacion', label: 'Coordinación Pedagógica', color: '#EF6C00', kind: 'persona', tipo: 'coordinador' },
  { key: 'tecnologia', label: 'Tecnología', color: '#0084B3', kind: 'persona', tipo: 'tic' },
  { key: 'psicologia', label: 'Psicología y Prometacom', color: '#AD1457', kind: 'persona', tipos: ['psicologia', 'prometacom'] },
  { key: 'pasantes', label: 'Pasantes', color: '#9A9C2E', kind: 'persona', tipo: 'pasante' },
  { key: 'apoyo', label: 'Personal de apoyo', color: '#795548', kind: 'persona', tipo: 'apoyo' },
  { key: 'directores', label: 'Directores', color: '#37474F', kind: 'persona', tipo: 'director' },
  { key: 'administradores', label: 'Administradores', color: '#616161', kind: 'persona', tipo: 'administrador' },
  { key: 'siger', label: 'SIGERD', color: '#00695C', kind: 'persona', tipo: 'siger' },
  { key: 'personal', label: 'Personal (todos)', color: '#455A64', kind: 'persona' },
]

const ROLE_BY_TIPO: Record<string, Role> = {
  coordinador: 'coordinacion', tic: 'tecnologia', psicologia: 'psicologia', prometacom: 'psicologia',
  pasante: 'docente', apoyo: 'admin', director: 'admin', administrador: 'admin', siger: 'admin',
}

const targetRoleOf = (g: PersonGroup): Role =>
  g.kind === 'estudiante' ? 'estudiante' : g.kind === 'docente' ? 'docente' : g.kind === 'padre' ? 'padre' : (ROLE_BY_TIPO[g.tipo ?? g.tipos?.[0] ?? 'apoyo'] ?? 'admin')

const sourceRoleOf = (ref: PersonRef): Role | null =>
  ref.kind === 'estudiante' ? 'estudiante' : ref.kind === 'docente' ? 'docente' : ref.kind === 'padre' ? 'padre' : (ref.tipo ? ROLE_BY_TIPO[ref.tipo] ?? null : null)

const sourceLinkOf = (ref: PersonRef): LinkTarget =>
  ref.kind === 'estudiante' ? { studentId: ref.id } : ref.kind === 'docente' ? { teacherId: ref.id } : {}

interface PeopleData { students: Student[]; teachers: Teacher[]; guardians: StudentGuardian[]; personas: Persona[] }

/** Personas que pertenecen a un grupo (por rol). */
export function peopleInGroup(group: PersonGroup, data: PeopleData): PersonRef[] {
  if (group.kind === 'estudiante') return data.students.map((s) => ({ kind: 'estudiante', id: s.id, fullName: s.fullName, userId: s.userId, email: s.email }))
  if (group.kind === 'docente') return data.teachers.map((t) => ({ kind: 'docente', id: t.id, fullName: t.fullName, userId: t.userId, email: t.email }))
  if (group.kind === 'padre') return data.guardians.map((g) => ({ kind: 'padre', id: g.id, fullName: g.fullName, userId: g.userId, email: g.email }))
  const tipos = group.tipos ?? (group.tipo ? [group.tipo] : null)
  const list = tipos ? data.personas.filter((p) => tipos.includes(p.tipo)) : data.personas
  return list.map((p) => ({ kind: 'persona', id: p.id, fullName: p.fullName, userId: p.userId, email: p.email, tipo: p.tipo }))
}

/** Transfiere una persona de su grupo actual a otro grupo (cambia el registro y el rol de acceso). */
export async function transferPerson(ref: PersonRef, target: PersonGroup, defaultGradeId = ''): Promise<void> {
  const account = ref.userId ? (await getDirectoryUsers()).find((u) => u.id === ref.userId) ?? null : null
  const email = ref.email || (account ? entraEmail(account) : '')
  const targetTipo = (target.tipo ?? target.tipos?.[0] ?? 'apoyo') as PersonaTipo
  const targetRole = targetRoleOf(target)
  const sourceRole = sourceRoleOf(ref)

  let link: LinkTarget = {}
  // Mismo tipo de registro (persona → persona): solo cambia el tipo y el rol.
  if (ref.kind === 'persona' && target.kind === 'persona') {
    await dataService.savePersona({ id: ref.id, fullName: ref.fullName, email, userId: ref.userId, tipo: targetTipo, createdAt: new Date().toISOString() })
  } else {
    const newId = genId(target.kind === 'estudiante' ? 's' : target.kind === 'docente' ? 't' : target.kind === 'padre' ? 'gr' : 'p')
    if (target.kind === 'estudiante') { await dataService.saveStudent({ id: newId, fullName: ref.fullName, email, userId: ref.userId, gradeId: defaultGradeId }); link = { studentId: newId } }
    else if (target.kind === 'docente') { await dataService.saveTeacher({ id: newId, fullName: ref.fullName, email, userId: ref.userId, subjects: [], grades: [] }); link = { teacherId: newId } }
    else if (target.kind === 'padre') await dataService.saveGuardian({ id: newId, fullName: ref.fullName, email, userId: ref.userId, studentId: '', parentesco: 'padre' })
    else await dataService.savePersona({ id: newId, fullName: ref.fullName, email, userId: ref.userId, tipo: targetTipo, createdAt: new Date().toISOString() })

    if (ref.kind === 'estudiante') await dataService.deleteStudent(ref.id)
    else if (ref.kind === 'docente') await dataService.deleteTeacher(ref.id)
    else if (ref.kind === 'padre') await dataService.deleteGuardian(ref.id)
    else await dataService.deletePersona(ref.id)
  }

  if (account) {
    if (sourceRole && sourceRole !== targetRole) await unlinkUserRole(account.id, sourceRole, sourceLinkOf(ref))
    await linkUserRole(account, targetRole, link)
  }
}
