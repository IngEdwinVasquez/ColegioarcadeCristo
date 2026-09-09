import { graphErrorMessage, graphGetAll, graphRequest } from './graph'
import { appConfig } from '../config/appConfig'

/**
 * Listas de SharePoint Online que actúan como base de datos.
 * Cada elemento guarda el registro completo en `json_payload` y su identificador
 * lógico en `app_id` (el `Title` solo facilita la lectura desde SharePoint).
 */
export const SPO_LISTS = {
  users: 'ARC_Users',
  students: 'ARC_Students',
  teachers: 'ARC_Teachers',
  subjects: 'ARC_Subjects',
  grades: 'ARC_Grades',
  periods: 'ARC_Periods',
  classPlans: 'ARC_ClassPlans',
  dailyPlans: 'ARC_DailyPlans',
  teacherConfig: 'ARC_TeacherConfig',
  schedules: 'ARC_Schedules',
  accompaniments: 'ARC_Acompanamientos',
  personas: 'ARC_Personas',
  classes: 'ARC_Classes',
  attendance: 'ARC_Attendance',
  activities: 'ARC_Activities',
  scores: 'ARC_Scores',
  meetings: 'ARC_Meetings',
  enrollments: 'ARC_Enrollments',
  teacherAssignments: 'ARC_TeacherAssignments',
  guardians: 'ARC_Guardians',
  documentTypes: 'ARC_DocumentTypes',
  admissionDocs: 'ARC_AdmissionDocs',
  admissionEvals: 'ARC_AdmissionEvals',
  messages: 'ARC_Messages',
  announcements: 'ARC_Announcements',
  admissions: 'ARC_Admissions',
  documentRequests: 'ARC_DocumentRequests',
  psychRequests: 'ARC_PsychRequests',
  roleMeta: 'ARC_RoleMeta',
  ticPlan: 'ARC_TicPlan',
  ticCategories: 'ARC_TicCategories',
  weeklySchedules: 'ARC_WeeklySchedules',
  workCronogramas: 'ARC_WorkCronogramas',
} as const

export type SpoListName = (typeof SPO_LISTS)[keyof typeof SPO_LISTS]

export const PAYLOAD_FIELD = 'json_payload'
export const APP_ID_FIELD = 'app_id'

export class SharePointSetupError extends Error {
  readonly hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = 'SharePointSetupError'
    this.hint = hint
  }
}

// ------------------------------------------------------------------ Sitio

let cachedSiteId: string | null = null

async function resolveHostname(): Promise<string> {
  if (appConfig.m365.siteHostname) return appConfig.m365.siteHostname
  const root = await graphRequest<{ siteCollection?: { hostname?: string }; webUrl?: string }>('/sites/root?$select=siteCollection,webUrl')
  const hostname = root.siteCollection?.hostname ?? (root.webUrl ? new URL(root.webUrl).hostname : '')
  if (!hostname) throw new SharePointSetupError('No se pudo determinar el tenant de SharePoint.', 'Defina VITE_SPO_HOSTNAME en la configuración.')
  return hostname
}

export async function resolveSiteId(): Promise<string> {
  if (cachedSiteId) return cachedSiteId
  if (appConfig.m365.siteId) {
    cachedSiteId = appConfig.m365.siteId
    return cachedSiteId
  }
  const hostname = await resolveHostname()
  const path = appConfig.m365.sitePath.startsWith('/') ? appConfig.m365.sitePath : `/${appConfig.m365.sitePath}`
  try {
    const site = await graphRequest<{ id: string }>(`/sites/${hostname}:${path}?$select=id`)
    cachedSiteId = site.id
    return site.id
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 403) {
      throw new SharePointSetupError(
        `No se encontró el sitio de SharePoint https://${hostname}${path} o no tiene acceso a él.`,
        'Cree el sitio (Centro de administración de SharePoint → Sitios activos → Crear) y conceda acceso a los usuarios, o ajuste VITE_SPO_SITE_PATH.',
      )
    }
    throw error
  }
}

export async function getSiteWebUrl(): Promise<string> {
  const siteId = await resolveSiteId()
  const site = await graphRequest<{ webUrl: string }>(`/sites/${siteId}?$select=webUrl`)
  return site.webUrl
}

// ------------------------------------------------------------------ Aprovisionamiento

interface GraphList {
  id: string
  name?: string
  displayName: string
}

interface GraphColumn {
  name: string
}

const PROVISION_KEY = 'arca_spo_provisioned_v4'

/** Nombre de lista → id de SharePoint (se rellena al aprovisionar o a demanda). */
const listIds = new Map<string, string>()

export class ListProvisioningError extends Error {
  readonly hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = 'ListProvisioningError'
    this.hint = hint
  }
}

async function fetchLists(siteId: string): Promise<Map<string, GraphList>> {
  const existing = await graphGetAll<GraphList>(`/sites/${siteId}/lists?$select=id,name,displayName`)
  const byName = new Map<string, GraphList>()
  for (const list of existing) {
    byName.set(list.displayName, list)
    if (list.name) byName.set(list.name, list)
    listIds.set(list.displayName, list.id)
    if (list.name) listIds.set(list.name, list.id)
  }
  return byName
}

/** Devuelve el id de la lista (o su nombre si aún no se conoce el id). */
async function listRef(listName: string): Promise<string> {
  const cached = listIds.get(listName)
  if (cached) return cached
  const siteId = await resolveSiteId()
  const byName = await fetchLists(siteId)
  return byName.get(listName)?.id ?? listName
}

const PAYLOAD_COLUMN = { name: PAYLOAD_FIELD, text: { allowMultipleLines: true, textType: 'plain' } }
const APP_ID_COLUMN = { name: APP_ID_FIELD, indexed: true, text: {} }

/**
 * Crea las listas ARC_* que falten y garantiza las columnas `json_payload` y `app_id`.
 * Requiere Sites.ReadWrite.All (delegado) y permiso de edición en el sitio.
 */
let provisioning: Promise<{ created: string[]; updated: string[] }> | null = null

export function ensureProvisioned(force = false): Promise<{ created: string[]; updated: string[] }> {
  // Una sola ejecución en vuelo: evita carreras (p. ej. doble efecto de React en desarrollo).
  if (!provisioning) {
    provisioning = provisionLists(force).finally(() => {
      provisioning = null
    })
  }
  return provisioning
}

async function provisionLists(force: boolean): Promise<{ created: string[]; updated: string[] }> {
  const created: string[] = []
  const updated: string[] = []
  if (!force && sessionStorage.getItem(PROVISION_KEY) === '1') return { created, updated }

  const siteId = await resolveSiteId()
  const byName = await fetchLists(siteId)

  for (const listName of Object.values(SPO_LISTS)) {
    const list = byName.get(listName)
    if (!list) {
      try {
        const createdList = await graphRequest<GraphList>(`/sites/${siteId}/lists`, 'POST', {
          displayName: listName,
          description: 'Intranet Arca de Cristo — datos de la aplicación',
          list: { template: 'genericList' },
          columns: [PAYLOAD_COLUMN, APP_ID_COLUMN],
        })
        listIds.set(listName, createdList.id)
        created.push(listName)
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 409) {
          // Creada por otra ejecución concurrente o por un intento anterior: se reutiliza.
          const refreshed = await fetchLists(siteId)
          if (refreshed.get(listName)) continue
        }
        throw new ListProvisioningError(
          `No se pudo crear la lista ${listName} en SharePoint (${status ?? 'error'}): ${graphErrorMessage(error)}`,
          status === 403
            ? 'Crear listas requiere el permiso delegado Sites.Manage.All con consentimiento de administrador (Entra → Registros de aplicaciones → Permisos de API) y que su cuenta sea miembro o propietaria del sitio. Tras concederlo, cierre sesión y vuelva a entrar.'
            : 'Compruebe los permisos de la aplicación (Sites.ReadWrite.All y Sites.Manage.All) y reintente.',
        )
      }
      continue
    }
    const columns = await graphGetAll<GraphColumn>(`/sites/${siteId}/lists/${list.id}/columns?$select=name`)
    const names = new Set(columns.map((c) => c.name))
    if (!names.has(PAYLOAD_FIELD)) {
      await graphRequest(`/sites/${siteId}/lists/${list.id}/columns`, 'POST', PAYLOAD_COLUMN)
      updated.push(`${listName}.${PAYLOAD_FIELD}`)
    }
    if (!names.has(APP_ID_FIELD)) {
      await graphRequest(`/sites/${siteId}/lists/${list.id}/columns`, 'POST', APP_ID_COLUMN)
      updated.push(`${listName}.${APP_ID_FIELD}`)
    }
  }
  sessionStorage.setItem(PROVISION_KEY, '1')
  return { created, updated }
}

// ------------------------------------------------------------------ CRUD de elementos

interface GraphItem {
  id: string
  fields: Record<string, unknown>
}

/** Caché por lista: id lógico (app_id) → id numérico del elemento en SharePoint. */
const idCache = new Map<string, Map<string, string>>()

function cacheFor(listName: string): Map<string, string> {
  let map = idCache.get(listName)
  if (!map) {
    map = new Map()
    idCache.set(listName, map)
  }
  return map
}

const NON_INDEXED_PREFER = { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' }

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''")
}

async function findSpId(listName: string, appId: string): Promise<string | null> {
  const cached = cacheFor(listName).get(appId)
  if (cached) return cached
  const siteId = await resolveSiteId()
  const list = await listRef(listName)
  const response = await graphRequest<{ value: GraphItem[] }>(
    `/sites/${siteId}/lists/${list}/items?$select=id&$filter=fields/${APP_ID_FIELD} eq '${escapeODataString(appId)}'&$top=1`,
    'GET',
    undefined,
    { headers: NON_INDEXED_PREFER },
  )
  const spId = response.value[0]?.id ?? null
  if (spId) cacheFor(listName).set(appId, spId)
  return spId
}

export interface StoredRecord {
  id: string
  [key: string]: unknown
}

function parseItem<T extends StoredRecord>(listName: string, item: GraphItem): T {
  const fields = item.fields
  const raw = typeof fields[PAYLOAD_FIELD] === 'string' ? (fields[PAYLOAD_FIELD] as string) : ''
  let parsed: Record<string, unknown> = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  }
  const storedAppId = typeof fields[APP_ID_FIELD] === 'string' ? (fields[APP_ID_FIELD] as string) : ''
  const payloadId = typeof parsed.id === 'string' ? (parsed.id as string) : ''
  const appId = storedAppId || payloadId || item.id
  cacheFor(listName).set(appId, item.id)
  return { ...parsed, id: appId } as T
}

export async function getItems<T extends StoredRecord>(listName: string): Promise<T[]> {
  const siteId = await resolveSiteId()
  const list = await listRef(listName)
  const items = await graphGetAll<GraphItem>(
    `/sites/${siteId}/lists/${list}/items?$select=id&$expand=fields($select=Title,${PAYLOAD_FIELD},${APP_ID_FIELD})&$top=999`,
  )
  return items.map((item) => parseItem<T>(listName, item))
}

const TITLE_KEYS = ['title', 'topic', 'titulo', 'name', 'fullName', 'displayName', 'estudiante', 'label']

function titleOf(item: Record<string, unknown>): string {
  for (const key of TITLE_KEYS) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) return value.slice(0, 250)
  }
  if (typeof item.date === 'string') return item.date
  return 'Elemento'
}

/** Crea o actualiza el registro (según exista su `app_id`). Devuelve el registro guardado. */
export async function upsertItem<T extends StoredRecord>(listName: string, item: T): Promise<T> {
  const siteId = await resolveSiteId()
  const appId = item.id
  const fields = {
    Title: titleOf(item),
    [APP_ID_FIELD]: appId,
    [PAYLOAD_FIELD]: JSON.stringify(item),
  }
  const list = await listRef(listName)
  const spId = await findSpId(listName, appId)
  if (spId) {
    await graphRequest(`/sites/${siteId}/lists/${list}/items/${spId}/fields`, 'PATCH', fields)
  } else {
    const created = await graphRequest<GraphItem>(`/sites/${siteId}/lists/${list}/items`, 'POST', { fields })
    cacheFor(listName).set(appId, created.id)
  }
  return item
}

export async function deleteItem(listName: string, appId: string): Promise<void> {
  const siteId = await resolveSiteId()
  const list = await listRef(listName)
  const spId = await findSpId(listName, appId)
  if (!spId) return
  await graphRequest(`/sites/${siteId}/lists/${list}/items/${spId}`, 'DELETE')
  cacheFor(listName).delete(appId)
}
