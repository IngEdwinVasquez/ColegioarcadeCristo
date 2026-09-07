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
