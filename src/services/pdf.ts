import * as pdfjs from 'pdfjs-dist'

let workerReady = false

/** Configura el worker de PDF.js (una sola vez) para Vite. */
async function ensureWorker(): Promise<void> {
  if (workerReady) return
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  workerReady = true
}

/** Extrae el texto de todas las páginas de un archivo PDF. */
export async function extractPdfText(file: File): Promise<string> {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('El archivo debe ser un PDF.')
  }
  await ensureWorker()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      if ('str' in item) text += (item as unknown as { str: string }).str + '\n'
    }
    pages.push(text)
  }
  return pages.join('\n---- PAGINA ----\n')
}

/** Extrae solo el texto de la primera página (para metadatos del registro). */
export async function extractPdfFirstPageText(file: File): Promise<string> {
  await ensureWorker()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  return content.items
    .filter((item) => 'str' in item)
    .map((item) => (item as unknown as { str: string }).str)
    .join(' ')
}

/** Renderiza la primera página del PDF como imagen (JPEG) para usarla de portada. */
export async function renderPdfFirstPageToBlob(file: File, maxWidth = 340): Promise<Blob | null> {
  await ensureWorker()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = maxWidth / base.width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72))
}
