import { acquireToken } from './msal'
import { graphRequest } from './graph'
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
