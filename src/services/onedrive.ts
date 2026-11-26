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

/** Crea (si no existe) una carpeta en la raíz de OneDrive o dentro de `parent` (ruta relativa a la raíz). */
async function ensureFolder(parent: string, name: string): Promise<void> {
  const parentPath = parent ? parent.split('/').map(encodeURIComponent).join('/') : ''
  const endpoint = parentPath ? `/me/drive/root:/${parentPath}:/children` : '/me/drive/root/children'
  try {
    await graphRequest(endpoint, 'POST', { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' })
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
    if (msg.includes('exist') || msg.includes('existe') || msg.includes('namealreadyexists')) return
    throw e
  }
}

/**
 * Crea en el OneDrive del usuario conectado la estructura:
 * «Planificacion docente CP» → Inicial, Primaria, Secundaria.
 * No falla si ya existen.
 */
export async function asegurarCarpetasPlanificacionDocente(): Promise<void> {
  const root = 'Planificacion docente CP'
  await ensureFolder('', root)
  for (const sub of ['Inicial', 'Primaria', 'Secundaria']) await ensureFolder(root, sub)
}

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

/** Descarga el contenido de un archivo y lo devuelve como data URL (para incrustar imágenes en un PDF). */
export async function downloadFileAsDataUrl(fileId: string): Promise<string> {
  const token = await acquireToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export interface DriveItemFull {
  id: string
  name: string
  webUrl?: string
  downloadUrl?: string
  mimeType?: string
  path: string
  size?: number
  lastModifiedDateTime?: string
}

/** Lista recursivamente los archivos de una carpeta del OneDrive del usuario. */
export async function listFilesRecursive(folder: string, maxDepth = 4): Promise<DriveItemFull[]> {
  const out: DriveItemFull[] = []
  const encodedRaw = folder.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  let rootId = ''
  try {
    rootId = (await graphRequest<{ id: string }>(`/me/drive/root:/${buildPath(folder)}`)).id
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) throw error
    // Segundo intento: carpeta relativa a la raíz del OneDrive (no dentro de ArcaDeCristo).
    try {
      rootId = (await graphRequest<{ id: string }>(`/me/drive/root:/${encodedRaw}`)).id
    } catch (error2) {
      if ((error2 as { statusCode?: number }).statusCode === 404) return []
      throw error2
    }
  }
  interface Item {
    id: string
    name: string
    webUrl?: string
    file?: { mimeType?: string }
    folder?: { childCount: number }
    size?: number
    lastModifiedDateTime?: string
    '@microsoft.graph.downloadUrl'?: string
  }
  const walk = async (id: string, rel: string, depth: number): Promise<void> => {
    let next: string | undefined = `/me/drive/items/${id}/children?$select=id,name,webUrl,file,folder,size,lastModifiedDateTime,@microsoft.graph.downloadUrl&$top=200`
    while (next) {
      const page: { value: Item[]; '@odata.nextLink'?: string } = await graphRequest(next, 'GET')
      for (const it of page.value ?? []) {
        const p = rel ? `${rel}/${it.name}` : it.name
        if (it.folder) {
          if (depth < maxDepth) await walk(it.id, p, depth + 1)
        } else {
          out.push({
            id: it.id,
            name: it.name,
            webUrl: it.webUrl,
            downloadUrl: it['@microsoft.graph.downloadUrl'],
            mimeType: it.file?.mimeType,
            path: p,
            size: it.size,
            lastModifiedDateTime: it.lastModifiedDateTime,
          })
        }
      }
      next = page['@odata.nextLink']
    }
  }
  await walk(rootId, '', 0)
  return out
}
