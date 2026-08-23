import { acquireToken } from './msal'
import { graphRequest } from './graph'
import { appConfig } from '../config/appConfig'

export interface DriveFileRef {
  name: string
  id: string
  webUrl: string
  size?: number
  lastModifiedDateTime?: string
}

const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024 // 4 MB (límite de Graph para PUT directo)
const CHUNK_SIZE = 5 * 1024 * 1024 // múltiplo de 320 KiB

function sanitizeSegment(segment: string): string {
  return segment.replace(/[\\/:*?"<>|#%]/g, '-').trim() || 'carpeta'
}

function buildPath(folder: string, fileName?: string): string {
  const parts = [appConfig.m365.driveRootFolder, ...folder.split('/')].filter(Boolean).map(sanitizeSegment)
  const path = parts.map(encodeURIComponent).join('/')
  return fileName ? `${path}/${encodeURIComponent(sanitizeSegment(fileName))}` : path
}

interface DriveItem {
  id: string
  name: string
  webUrl: string
  size?: number
  lastModifiedDateTime?: string
}

const toRef = (item: DriveItem): DriveFileRef => ({
  id: item.id,
  name: item.name,
  webUrl: item.webUrl,
  size: item.size,
  lastModifiedDateTime: item.lastModifiedDateTime,
})

/**
 * Repositorio documental en OneDrive del usuario conectado.
 * Los archivos se guardan bajo `/<VITE_ONEDRIVE_ROOT_FOLDER>/<folder>/<fileName>`.
 */
export async function uploadFile(folder: string, fileName: string, content: Blob): Promise<DriveFileRef> {
  if (content.size <= SIMPLE_UPLOAD_LIMIT) {
    const item = await graphRequest<DriveItem>(`/me/drive/root:/${buildPath(folder, fileName)}:/content`, 'PUT', content)
    return toRef(item)
  }
  return uploadLarge(folder, fileName, content)
}

async function uploadLarge(folder: string, fileName: string, content: Blob): Promise<DriveFileRef> {
  const session = await graphRequest<{ uploadUrl: string }>(
    `/me/drive/root:/${buildPath(folder, fileName)}:/createUploadSession`,
    'POST',
    { item: { '@microsoft.graph.conflictBehavior': 'rename', name: fileName } },
  )
  const token = await acquireToken()
  let offset = 0
  let last: DriveItem | null = null
  while (offset < content.size) {
    const end = Math.min(offset + CHUNK_SIZE, content.size)
    const chunk = content.slice(offset, end)
    const response = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': String(end - offset),
        'Content-Range': `bytes ${offset}-${end - 1}/${content.size}`,
      },
      body: chunk,
    })
    if (!response.ok) throw new Error(`Error al subir el archivo (${response.status})`)
    if (response.status === 200 || response.status === 201) last = (await response.json()) as DriveItem
    offset = end
  }
  if (!last) throw new Error('La carga del archivo no se completó')
  return toRef(last)
}

/**
 * Crea (o reutiliza) un enlace de solo lectura para toda la organización,
 * de modo que estudiantes y docentes puedan abrir el documento.
 */
export async function createOrganizationLink(fileId: string): Promise<string> {
  const link = await graphRequest<{ link: { webUrl: string } }>(`/me/drive/items/${fileId}/createLink`, 'POST', {
    type: 'view',
    scope: 'organization',
  })
  return link.link.webUrl
}

/** Sube un archivo y devuelve una referencia con enlace compartido en la organización. */
export async function uploadAndShare(folder: string, file: File): Promise<DriveFileRef> {
  const ref = await uploadFile(folder, file.name, file)
  try {
    const shared = await createOrganizationLink(ref.id)
    return { ...ref, webUrl: shared }
  } catch {
    // Si no se puede crear el enlace (política del tenant), se devuelve el enlace directo.
    return ref
  }
}

export async function listFilesInFolder(folder: string): Promise<DriveFileRef[]> {
  try {
    const response = await graphRequest<{ value: DriveItem[] }>(`/me/drive/root:/${buildPath(folder)}:/children`)
    return response.value.map(toRef)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return []
    throw error
  }
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const item = await graphRequest<{ '@microsoft.graph.downloadUrl'?: string; webUrl: string }>(`/me/drive/items/${fileId}`)
  return item['@microsoft.graph.downloadUrl'] ?? item.webUrl
}
