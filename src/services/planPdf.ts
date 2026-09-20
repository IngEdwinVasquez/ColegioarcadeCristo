/**
 * Convierte el HTML de una planificación a un PDF real (A4) para guardarlo en OneDrive.
 * Se usa jsPDF de forma diferida para no cargarlo hasta que se genera una planificación.
 */

interface Block {
  text: string
  size: number
  bold: boolean
  indent: number
  gapBefore: number
  gapAfter: number
  bullet?: string
}

const BLOCK_TAGS = ['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'table', 'section', 'article']

function inlineText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function collect(node: Element, blocks: Block[]): void {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const sizes: Record<string, number> = { h1: 18, h2: 15, h3: 13, h4: 12 }
      const t = inlineText(child)
      if (t) blocks.push({ text: t, size: sizes[tag], bold: true, indent: 0, gapBefore: 8, gapAfter: 4 })
    } else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(child.children).filter((c) => c.tagName.toLowerCase() === 'li')
      items.forEach((li, i) => {
        const t = inlineText(li)
        if (t) blocks.push({ text: t, size: 11, bold: false, indent: 6, gapBefore: 0, gapAfter: 2, bullet: tag === 'ol' ? `${i + 1}.` : '•' })
      })
    } else if (tag === 'table') {
      for (const row of Array.from(child.querySelectorAll('tr'))) {
        const cells = Array.from(row.querySelectorAll('th,td')).map((c) => inlineText(c)).filter(Boolean)
        const t = cells.join('   ')
        if (t) blocks.push({ text: t, size: 10, bold: row.querySelector('th') !== null, indent: 0, gapBefore: 1, gapAfter: 1 })
      }
    } else if (tag === 'br') {
      /* salto ignorado: el espaciado se controla por bloques */
    } else {
      const hasBlockChildren = Array.from(child.children).some((c) => BLOCK_TAGS.includes(c.tagName.toLowerCase()))
      if (hasBlockChildren) collect(child, blocks)
      else {
        const t = inlineText(child)
        if (t) blocks.push({ text: t, size: 11, bold: false, indent: 0, gapBefore: 2, gapAfter: 4 })
      }
    }
  }
}

/** Genera un PDF (A4) a partir del HTML de la planificación. */
export async function htmlToPdfBlob(html: string, title: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 15
  const marginTop = 18
  const marginBottom = 16
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const usableW = pageW - marginX * 2
  let y = marginTop

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  for (const line of doc.splitTextToSize(title || 'Planificación', usableW) as string[]) {
    doc.text(line, marginX, y)
    y += 7
  }
  y += 2
  doc.setDrawColor(180)
  doc.line(marginX, y, pageW - marginX, y)
  y += 6

  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const blocks: Block[] = []
  collect(parsed.body, blocks)
  if (blocks.length === 0) {
    const t = (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t) blocks.push({ text: t, size: 11, bold: false, indent: 0, gapBefore: 0, gapAfter: 0 })
  }

  for (const b of blocks) {
    const text = b.bullet ? `${b.bullet} ${b.text}` : b.text
    doc.setFont('helvetica', b.bold ? 'bold' : 'normal')
    doc.setFontSize(b.size)
    const lines = doc.splitTextToSize(text, usableW - b.indent) as string[]
    const lineH = b.size * 0.42 + 1.2
    y += b.gapBefore
    for (const line of lines) {
      if (y + lineH > pageH - marginBottom) { doc.addPage(); y = marginTop }
      doc.text(line, marginX + b.indent, y)
      y += lineH
    }
    y += b.gapAfter
  }

  return doc.output('blob')
}

/** Genera el PDF de la planificación y lo descarga directamente en el navegador. */
export async function downloadPlanPdf(html: string, title: string): Promise<void> {
  const blob = await htmlToPdfBlob(html, title)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(title || 'Planificacion').replace(/[^\w.-]+/g, '_')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
