import { graphRequest } from './graph'
import { appConfig } from '../config/appConfig'

export const SPO_LISTS = {
  users: 'ARC_Users',
  students: 'ARC_Students',
  teachers: 'ARC_Teachers',
  subjects: 'ARC_Subjects',
  grades: 'ARC_Grades',
  periods: 'ARC_Periods',
  classPlans: 'ARC_ClassPlans',
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
} as const

let cachedSiteId: string | null = null

export async function resolveSiteId(): Promise<string> {
  if (cachedSiteId) return cachedSiteId
  if (appConfig.m365.siteId) {
    cachedSiteId = appConfig.m365.siteId
    return cachedSiteId
  }
  const path = appConfig.m365.sitePath.startsWith('/') ? appConfig.m365.sitePath.slice(1) : appConfig.m365.sitePath
  const site = await graphRequest<{ id: string }>(`/sites/${appConfig.m365.siteHostname}:/${path}`)
  cachedSiteId = site.id
  return site.id
}

function serializeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = typeof value === 'object' ? JSON.stringify(value) : value
  }
  return out
}

function deserializeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        out[key] = JSON.parse(value)
      } catch {
        /* se deja como texto */
      }
    }
  }
  return out
}

interface GraphItem {
  id: string
  fields: Record<string, unknown>
}

export async function getItems<T>(listName: string): Promise<Array<T & { id: string }>> {
  const siteId = await resolveSiteId()
  const response = await graphRequest<{ value: GraphItem[] }>(
    `/sites/${siteId}/lists/${listName}/items?expand=fields`,
  )
  return response.value.map((item) => ({ ...(deserializeFields(item.fields) as T), id: item.id }))
}

export async function addItem<T>(listName: string, fields: T): Promise<T & { id: string }> {
  const siteId = await resolveSiteId()
  const response = await graphRequest<GraphItem>(
    `/sites/${siteId}/lists/${listName}/items`,
    'POST',
    { fields: serializeFields(fields as Record<string, unknown>) },
  )
  return { ...(deserializeFields(response.fields) as T), id: response.id }
}

export async function updateItem<T>(listName: string, id: string, fields: Partial<T>): Promise<void> {
  const siteId = await resolveSiteId()
  await graphRequest(`/sites/${siteId}/lists/${listName}/items/${id}/fields`, 'PATCH', serializeFields(fields as Record<string, unknown>))
}

export async function deleteItem(listName: string, id: string): Promise<void> {
  const siteId = await resolveSiteId()
  await graphRequest(`/sites/${siteId}/lists/${listName}/items/${id}`, 'DELETE')
}
