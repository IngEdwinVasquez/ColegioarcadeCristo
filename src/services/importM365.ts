import { graphGetAll, graphRequest } from './graph'

/**
 * Clasificación de cuentas del tenant para crear estudiantes y docentes
 * automáticamente, a partir de dos señales:
 *  - la licencia de Microsoft 365 asignada (SKU educativa STUDENT / FACULTY);
 *  - la pertenencia a equipos de clase de Teams (propietarios = docentes,
 *    miembros = estudiantes) — que además aporta el curso.
 * Requiere el permiso delegado Directory.Read.All (ya incluido).
 */

export type M365Classification = 'estudiante' | 'docente' | 'desconocido'

export interface DirectoryPerson {
  id: string
  displayName: string
  email: string
  jobTitle?: string
  licenses: string[]
  classification: M365Classification
}

interface RawUser {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
  accountEnabled?: boolean
  jobTitle?: string | null
  assignedLicenses?: Array<{ skuId: string }>
}

/** Mapa skuId → skuPartNumber (p. ej. STANDARDWOFFPACK_STUDENT, M365EDU_A3_FACULTY). */
export async function getLicenseSkuMap(): Promise<Map<string, string>> {
  const skus = await graphGetAll<{ skuId: string; skuPartNumber: string }>('/subscribedSkus')
  return new Map(skus.map((s) => [s.skuId, s.skuPartNumber]))
}

function classify(partNumbers: string[], jobTitle?: string | null): M365Classification {
  const joined = partNumbers.join(' ').toUpperCase()
  if (joined.includes('STUDENT') || joined.includes('_STU')) return 'estudiante'
  if (joined.includes('FACULTY') || joined.includes('_FCTY') || joined.includes('EDUCATION')) return 'docente'
  const title = (jobTitle ?? '').toLowerCase()
  if (/docente|profesor|maestro|teacher/.test(title)) return 'docente'
  if (/estudiante|alumno|student/.test(title)) return 'estudiante'
  return 'desconocido'
}

/** Lee el directorio con sus licencias y clasifica cada cuenta. */
export async function classifyDirectory(): Promise<DirectoryPerson[]> {
  const skuMap = await getLicenseSkuMap()
  const users = await graphGetAll<RawUser>(
    "/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,assignedLicenses&$filter=userType eq 'Member'&$top=999",
  )
  return users
    .filter((u) => u.accountEnabled !== false)
    .map((u) => {
      const licenses = (u.assignedLicenses ?? []).map((l) => skuMap.get(l.skuId) ?? l.skuId)
      return {
        id: u.id,
        displayName: u.displayName ?? u.userPrincipalName ?? '',
        email: (u.mail ?? u.userPrincipalName ?? '').toLowerCase(),
        jobTitle: u.jobTitle ?? undefined,
        licenses,
        classification: classify(licenses, u.jobTitle),
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export interface TeamRoster {
  owners: Array<{ id: string; displayName: string; email: string }>
  members: Array<{ id: string; displayName: string; email: string }>
}

interface RawMember {
  '@odata.type'?: string
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string
}

const toPerson = (m: RawMember) => ({
  id: m.id,
  displayName: m.displayName ?? m.userPrincipalName ?? '',
  email: (m.mail ?? m.userPrincipalName ?? '').toLowerCase(),
})

/** Propietarios (docentes) y miembros (estudiantes) de un equipo de clase. */
export async function getTeamRoster(groupId: string): Promise<TeamRoster> {
  const [owners, members] = await Promise.all([
    graphGetAll<RawMember>(`/groups/${groupId}/owners?$select=id,displayName,mail,userPrincipalName`),
    graphGetAll<RawMember>(`/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName`),
  ])
  const isUser = (m: RawMember) => !m['@odata.type'] || m['@odata.type'].includes('user')
  const ownerIds = new Set(owners.map((o) => o.id))
  return {
    owners: owners.filter(isUser).map(toPerson),
    members: members.filter((m) => isUser(m) && !ownerIds.has(m.id)).map(toPerson),
  }
}

/** Comprueba si Graph permite leer las licencias (para avisar en la interfaz). */
export async function canReadLicenses(): Promise<boolean> {
  try {
    await graphRequest('/subscribedSkus?$top=1')
    return true
  } catch {
    return false
  }
}
