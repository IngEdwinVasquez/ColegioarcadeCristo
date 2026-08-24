import { acquireToken } from './msal'
import { graphGetAll, graphRequest } from './graph'
import { appConfig } from '../config/appConfig'
import type { GradeSection } from '../types'

export interface ClassTeamResult {
  teamId: string
  webUrl: string
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Crea un equipo de clase de Microsoft Teams para un curso (RM-008).
 * Usa la plantilla educativa `educationClass`; el usuario conectado queda como propietario
 * y puede agregar docentes y estudiantes desde Teams.
 * Requiere el permiso delegado Team.Create (y licencia de Teams).
 */
export async function createClassTeam(grade: GradeSection): Promise<ClassTeamResult> {
  const token = await acquireToken()
  const displayName = `${appConfig.shortName} · ${grade.name}${grade.section ? ` ${grade.section}` : ''}`
  const response = await fetch('https://graph.microsoft.com/v1.0/teams', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'template@odata.bind': "https://graph.microsoft.com/v1.0/teamsTemplates('educationClass')",
      displayName,
      description: `Equipo del curso ${grade.name} (${grade.level}) — ${appConfig.institution}`,
    }),
  })
  if (response.status !== 202 && !response.ok) {
    const body = await response.text()
    let message = `Error ${response.status}`
    try {
      message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? message
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(message)
  }
  // La creación es asíncrona: el id del equipo viene en el encabezado Content-Location: /teams('{id}')
  const location = response.headers.get('Content-Location') ?? response.headers.get('Location') ?? ''
  const teamId = /teams\('([^']+)'\)/.exec(location)?.[1] ?? ''
  if (!teamId) throw new Error('El equipo se está creando, pero no se recibió su identificador. Reintente en unos minutos.')

  // Esperar a que el aprovisionamiento termine para obtener la URL del equipo.
  let webUrl = ''
  for (let i = 0; i < 10 && !webUrl; i++) {
    await wait(3000)
    try {
      const team = await graphRequest<{ webUrl?: string }>(`/teams/${teamId}?$select=webUrl`)
      webUrl = team.webUrl ?? ''
    } catch {
      /* aún aprovisionando */
    }
  }
  return { teamId, webUrl: webUrl || `https://teams.microsoft.com/l/team/${teamId}` }
}

/** Comprueba si el equipo vinculado sigue existiendo. */
export async function classTeamExists(teamId: string): Promise<boolean> {
  try {
    await graphRequest(`/teams/${teamId}?$select=id`)
    return true
  } catch {
    return false
  }
}

export interface TeamInfo {
  id: string
  displayName: string
  description?: string
}

/**
 * Lista los equipos de Teams del tenant para importarlos como cursos.
 * 1) Intenta listar todos los grupos con equipo (requiere Directory.Read.All, ya concedido).
 * 2) Si no es posible, lista los equipos a los que pertenece el usuario (Team.ReadBasic.All).
 */
export async function listTenantTeams(): Promise<TeamInfo[]> {
  try {
    const groups = await graphGetAll<{ id: string; displayName: string; description?: string }>(
      "/groups?$select=id,displayName,description&$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$count=true",
      { headers: { ConsistencyLevel: 'eventual' } },
    )
    if (groups.length > 0) return groups.sort((a, b) => a.displayName.localeCompare(b.displayName))
  } catch {
    /* sin permiso para listar grupos: se usa el plan B */
  }
  const joined = await graphGetAll<{ id: string; displayName: string; description?: string }>('/me/joinedTeams')
  return joined.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** URL directa del equipo (para entrar a la clase con un clic). */
export async function resolveTeamUrl(teamId: string): Promise<string> {
  try {
    const team = await graphRequest<{ webUrl?: string }>(`/teams/${teamId}?$select=webUrl`)
    if (team.webUrl) return team.webUrl
  } catch {
    /* el usuario no es miembro: enlace genérico por groupId */
  }
  return `https://teams.microsoft.com/l/team/0/conversations?groupId=${teamId}&tenantId=${appConfig.m365.tenantId}`
}
