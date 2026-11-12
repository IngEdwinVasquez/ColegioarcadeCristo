import { graphRequest } from './graph'
import { acquireToken } from './msal'

/** Codifica una URL de recurso compartido para el endpoint /shares de Graph. */
const shareToken = (url: string) => 'u!' + btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

export interface SharedItem {
  id: string
  name: string
  webUrl?: string
  downloadUrl?: string
  mimeType?: string
  /** Ruta relativa dentro de la carpeta compartida (para inferir docente). */
  path: string
}

interface DriveItem {
  id: string
  name: string
  webUrl?: string
  parentReference?: { driveId?: string }
  remoteItem?: { id: string; name: string; parentReference?: { driveId?: string } }
  folder?: { childCount: number }
  file?: { mimeType?: string }
  '@microsoft.graph.downloadUrl'?: string
}

interface ChildrenPage {
  value: DriveItem[]
  '@odata.nextLink'?: string
}

/** Resuelve un enlace compartido de OneDrive/SharePoint a su unidad y elemento. */
export async function resolveSharedFolder(shareUrl: string): Promise<{ driveId: string; itemId: string; name: string }> {
  const item = await graphRequest<DriveItem>(`/shares/${shareToken(shareUrl)}/driveItem?$select=id,name,webUrl,parentReference,remoteItem`, 'GET')
  const remote = item.remoteItem
  const driveId = remote?.parentReference?.driveId ?? item.parentReference?.driveId
  const itemId = remote?.id ?? item.id
  if (!driveId || !itemId) throw new Error('No se pudo resolver la carpeta compartida. Verifique el enlace y que tenga acceso.')
  return { driveId, itemId, name: remote?.name ?? item.name }
}

/** Lista (recursivamente) los archivos de una carpeta compartida. */
export async function listSharedFiles(driveId: string, itemId: string, maxDepth = 3): Promise<SharedItem[]> {
  const out: SharedItem[] = []
  const walk = async (id: string, path: string, depth: number): Promise<void> => {
    let next: string | undefined = `/drives/${driveId}/items/${id}/children?$select=id,name,folder,file,webUrl,size,@microsoft.graph.downloadUrl&$top=200`
    while (next) {
      const page: ChildrenPage = await graphRequest<ChildrenPage>(next, 'GET')
      for (const it of page.value ?? []) {
        const p = path ? `${path}/${it.name}` : it.name
        if (it.folder) {
          if (depth < maxDepth) await walk(it.id, p, depth + 1)
        } else {
          out.push({ id: it.id, name: it.name, webUrl: it.webUrl, downloadUrl: it['@microsoft.graph.downloadUrl'], mimeType: it.file?.mimeType, path: p })
        }
      }
      next = page['@odata.nextLink']
    }
  }
  await walk(itemId, '', 0)
  return out
}

/** Busca (hasta `maxDepth`) una subcarpeta cuyo nombre cumpla `match`. */
export async function findSubfolder(driveId: string, itemId: string, match: (name: string) => boolean, maxDepth = 2): Promise<{ id: string; name: string } | null> {
  const queue: Array<{ id: string; name: string; depth: number }> = [{ id: itemId, name: '', depth: 0 }]
  while (queue.length) {
    const cur = queue.shift() as { id: string; name: string; depth: number }
    if (cur.depth > 0 && match(cur.name)) return { id: cur.id, name: cur.name }
    if (cur.depth >= maxDepth) continue
    let next: string | undefined = `/drives/${driveId}/items/${cur.id}/children?$select=id,name,folder&$top=200`
    while (next) {
      const page: ChildrenPage = await graphRequest<ChildrenPage>(next, 'GET')
      for (const it of page.value ?? []) if (it.folder) queue.push({ id: it.id, name: it.name, depth: cur.depth + 1 })
      next = page['@odata.nextLink']
    }
  }
  return null
}

/** Descarga un archivo compartido como `File` (para extraer texto del PDF). */export async function downloadSharedFile(driveId: string, item: SharedItem): Promise<File> {
  let url = item.downloadUrl
  if (!url) {
    const token = await acquireToken()
    const res = await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/content`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`No se pudo descargar «${item.name}» (${res.status}).`)
    const blob = await res.blob()
    return new File([blob], item.name, { type: item.mimeType ?? blob.type })
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar «${item.name}» (${res.status}).`)
  const blob = await res.blob()
  return new File([blob], item.name, { type: item.mimeType ?? blob.type })
}
