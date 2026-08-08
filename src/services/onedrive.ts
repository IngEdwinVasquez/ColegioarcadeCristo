import { graphRequest } from './graph'

export interface DriveFileRef {
  name: string
  id: string
  webUrl: string
  size?: number
  lastModifiedDateTime?: string
}

/**
 * Repositorio de documentos en OneDrive / SharePoint Documents.
 * Los adjuntos de actividades, clases y actas se guardan como DriveFileRef.
 */
export async function uploadFile(
  folder: string,
  fileName: string,
  content: Blob | ArrayBuffer | string,
): Promise<DriveFileRef> {
  const item = await graphRequest<{ id: string; name: string; webUrl: string; size?: number }>(
    `/me/drive/items/root:/${folder}/${fileName}:/content`,
    'PUT',
    content,
  )
  return { name: item.name, id: item.id, webUrl: item.webUrl, size: item.size }
}

export async function listFilesInFolder(folder: string): Promise<DriveFileRef[]> {
  const response = await graphRequest<{ value: Array<{ id: string; name: string; webUrl: string; size?: number; lastModifiedDateTime?: string }> }>(
    `/me/drive/items/root:/${folder}:/children`,
  )
  return response.value.map((f) => ({
    name: f.name,
    id: f.id,
    webUrl: f.webUrl,
    size: f.size,
    lastModifiedDateTime: f.lastModifiedDateTime,
  }))
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const item = await graphRequest<{ webUrl: string }>(`/me/drive/items/${fileId}`)
  return item.webUrl
}
