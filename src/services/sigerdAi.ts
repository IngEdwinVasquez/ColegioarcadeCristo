import type { SigerdHeader, SigerdStudent } from '../types'
import { nivelDeTanda } from '../utils/academic'

export interface SigerdParseResult {
  header: SigerdHeader
  estudiantes: SigerdStudent[]
}

const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

// ------------------------------------------------------------- Parser determinista
// El PDF del SIGERD genera una celda por línea. Cada estudiante ocupa 17 líneas:
// NoOrden, IdEstudiante, PrimerApellido, SegundoApellido, Nombre(s), Nacimiento,
// Declarado, Municipio, Oficialía, Libro, Folio, Acta, Año, Grado, Sec., Condición, Estado.

const isNum = (s: string) => /^\d{1,3}$/.test(s)
const isId = (s: string) => /^\d{7,9}$/.test(s)
const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s)

// Detecta el inicio de un encabezado del SIGERD (no aparece en las filas de la tabla).
const HEADER_MARK = /(direcci[oó]n\s+regional|centro\s+educativo|distrito\s+educativo|tanda[\s-]*servicio|a[nñ]o\s+\d{4}\s*-\s*\d{4})/i

function parseHeader(lines: string[]): SigerdHeader {
  const after = (label: string): string => {
    const key = strip(label).toLowerCase()
    for (let i = 0; i < lines.length; i++) {
      const l = strip(lines[i])
      const idx = l.toLowerCase().indexOf(key)
      if (idx === -1) continue
      const rest = l.slice(idx + key.length).replace(/^[:\s]+/, '').trim()
      if (rest) return rest
      for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j].trim()
      return ''
    }
    return ''
  }
  const anoLine = lines.find((l) => /a[nñ]o\s+\d{4}\s*-\s*\d{4}/i.test(strip(l)))
  const ano = anoLine ? (strip(anoLine).match(/\d{4}\s*-\s*\d{4}/)?.[0]?.replace(/\s+/g, '') ?? '') : ''
  return {
    ano,
    direccionRegional: after('Dirección Regional'),
    centroEducativo: after('Centro Educativo'),
    distritoEducativo: after('Distrito Educativo'),
    tandaServicio: after('Tanda-Servicio'),
    sector: after('Sector'),
    grado: after('Grado'),
    seccion: after('Sección'),
    cantidadEstudiantes: after('Cantidad de Estudiantes'),
    docentes: after('Docentes'),
  }
}

/** Parser determinista del reporte SIGERD (rápido y con todas las columnas). */
export function parseSigerdText(text: string): SigerdParseResult {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const estudiantes: SigerdStudent[] = []
  const starts: number[] = []
  const studentLine = new Set<number>()
  for (let i = 0; i + 16 < lines.length; i++) {
    if (!(isNum(lines[i]) && isId(lines[i + 1]) && isDate(lines[i + 5]))) continue
    const b = i
    estudiantes.push({
      noOrden: lines[b],
      idEstudiante: lines[b + 1],
      primerApellido: lines[b + 2],
      segundoApellido: lines[b + 3],
      nombres: lines[b + 4],
      nacimiento: lines[b + 5],
      declarado: lines[b + 6],
      municipio: lines[b + 7],
      oficialia: lines[b + 8],
      libro: lines[b + 9],
      folio: lines[b + 10],
      acta: lines[b + 11],
      anio: lines[b + 12],
      grado: lines[b + 13],
      seccion: lines[b + 14],
      condicion: lines[b + 15],
      estado: lines[b + 16],
    })
    starts.push(b)
    for (let k = b; k <= b + 16; k++) studentLine.add(k)
    i = b + 16
  }

  // Encabezados repetidos: cada bloque aplica a los estudiantes que le siguen. Si un
  // encabezado no trae Grado/Sección/Tanda, se hereda del encabezado anterior.
  const headerStarts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (studentLine.has(i)) continue
    if (HEADER_MARK.test(lines[i])) headerStarts.push(i)
  }
  const firstStudentAfter = (from: number) => starts.find((s) => s > from) ?? lines.length
  const bloques: Array<{ start: number; header: SigerdHeader }> = []
  let previo: SigerdHeader = {}
  for (let h = 0; h < headerStarts.length; h++) {
    const start = headerStarts[h]
    const end = Math.min(headerStarts[h + 1] ?? lines.length, firstStudentAfter(start))
    const eff: SigerdHeader = { ...parseHeader(lines.slice(start, end)) }
    for (const k of Object.keys(eff) as Array<keyof SigerdHeader>) if (!eff[k] && previo[k]) eff[k] = previo[k]
    bloques.push({ start, header: eff })
    previo = eff
  }

  // Se respeta el Grado/Sección de la propia fila cuando ya trae dato; si falta,
  // se completa con el encabezado inmediato superior (o el anterior, si aquel no lo trae).
  const hasVal = (v?: string) => !!v && v.trim() !== '' && v.trim() !== '-' && v.trim() !== '—'
  for (let idx = 0; idx < estudiantes.length; idx++) {
    const st = starts[idx]
    let hdr: SigerdHeader | undefined
    for (const b of bloques) {
      if (b.start < st) hdr = b.header
      else break
    }
    if (!hdr) continue
    if (!hasVal(estudiantes[idx].grado) && hdr.grado) estudiantes[idx].grado = hdr.grado
    if (!hasVal(estudiantes[idx].seccion) && hdr.seccion) estudiantes[idx].seccion = hdr.seccion
    const nivel = nivelDeTanda(hdr.tandaServicio)
    if (nivel) estudiantes[idx].nivel = nivel
  }

  let header: SigerdHeader = {}
  for (const b of bloques) header = mergeHeader(header, b.header)
  if (headerStarts.length === 0) header = parseHeader(lines)
  return { header, estudiantes }
}

// ------------------------------------------------------------- Respaldo con IA
const SIGERD_PROMPT = `Eres un asistente que extrae la información de un reporte del SIGERD (MINERD - República Dominicana).
Cada celda de la tabla aparece en su propia línea, en este orden por estudiante:
No. de Orden, Id Estudiante, Primer apellido, Segundo apellido, Nombre(s), Nacimiento, Declarado, Municipio, Oficialía, Libro, Folio, Acta, Año, Grado, Sec., Condición, Estado.
Devuelve un JSON válido con EXACTAMENTE:
{ "encabezado": { "ano": "", "direccionRegional": "", "centroEducativo": "", "distritoEducativo": "", "tandaServicio": "", "sector": "", "grado": "", "seccion": "", "cantidadEstudiantes": "", "docentes": "" },
  "estudiantes": [ { "noOrden": "", "idEstudiante": "", "primerApellido": "", "segundoApellido": "", "nombres": "", "nacimiento": "", "declarado": "", "municipio": "", "oficialia": "", "libro": "", "folio": "", "acta": "", "anio": "", "grado": "", "seccion": "", "condicion": "", "estado": "" } ] }
Reglas: una entrada por estudiante del fragmento; "nombres" = columna Nombre(s); los apellidos en sus campos; si falta un dato usa "". Responde ÚNICAMENTE el JSON.`

const CHUNK_SIZE = 6000

function splitChunks(text: string): string[] {
  const chunks: string[] = []
  let cur = ''
  for (const line of text.split('\n')) {
    if (cur && cur.length + line.length + 1 > CHUNK_SIZE) {
      chunks.push(cur)
      cur = ''
    }
    cur += line + '\n'
  }
  if (cur.trim()) chunks.push(cur)
  return chunks.length ? chunks : [text]
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const i = idx
      idx += 1
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

const headerOf = (v: unknown): SigerdHeader => {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    ano: toStr(o.ano), direccionRegional: toStr(o.direccionRegional), centroEducativo: toStr(o.centroEducativo),
    distritoEducativo: toStr(o.distritoEducativo), tandaServicio: toStr(o.tandaServicio), sector: toStr(o.sector),
    grado: toStr(o.grado), seccion: toStr(o.seccion), cantidadEstudiantes: toStr(o.cantidadEstudiantes), docentes: toStr(o.docentes),
  }
}
const mergeHeader = (base: SigerdHeader, next: SigerdHeader): SigerdHeader => {
  const out = { ...base }
  for (const k of Object.keys(next) as Array<keyof SigerdHeader>) if (!out[k] && next[k]) out[k] = next[k]
  return out
}

async function parseWithAi(text: string, onProgress?: (d: number, t: number) => void): Promise<SigerdParseResult> {
  const { aiChat, parseAiJson } = await import('./ai')
  const chunks = splitChunks(text)
  let done = 0
  const parts = await mapLimit(chunks, 3, async (chunk) => {
    try {
      const res = await aiChat(
        [{ role: 'system', content: SIGERD_PROMPT }, { role: 'user', content: `Fragmento:\n\n${chunk}` }],
        { temperature: 0.1, jsonMode: true, maxTokens: 3200 },
      )
      const parsed = parseAiJson<Record<string, unknown>>(res)
      return { header: headerOf(parsed?.encabezado), estudiantes: Array.isArray(parsed?.estudiantes) ? (parsed!.estudiantes as Array<Record<string, unknown>>) : [] }
    } catch {
      return { header: {} as SigerdHeader, estudiantes: [] as Array<Record<string, unknown>> }
    } finally {
      done += 1
      onProgress?.(done, chunks.length)
    }
  })
  let header: SigerdHeader = {}
  const seen = new Set<string>()
  const estudiantes: SigerdStudent[] = []
  for (const part of parts) {
    header = mergeHeader(header, part.header)
    for (const e of part.estudiantes) {
      const stu: SigerdStudent = {
        noOrden: toStr(e.noOrden), idEstudiante: toStr(e.idEstudiante), primerApellido: toStr(e.primerApellido),
        segundoApellido: toStr(e.segundoApellido), nombres: toStr(e.nombres), nacimiento: toStr(e.nacimiento),
        declarado: toStr(e.declarado), municipio: toStr(e.municipio), oficialia: toStr(e.oficialia), libro: toStr(e.libro),
        folio: toStr(e.folio), acta: toStr(e.acta), anio: toStr(e.anio), grado: toStr(e.grado), seccion: toStr(e.seccion),
        condicion: toStr(e.condicion), estado: toStr(e.estado),
      }
      if (!stu.nombres && !stu.primerApellido) continue
      const key = stu.idEstudiante ? `id:${stu.idEstudiante}` : `${stu.nombres}|${stu.primerApellido}|${stu.segundoApellido}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      estudiantes.push(stu)
    }
  }
  const nivelHeader = nivelDeTanda(header.tandaServicio)
  if (header.grado || header.seccion || nivelHeader) {
    for (const stu of estudiantes) {
      if (!stu.grado && header.grado) stu.grado = header.grado
      if (!stu.seccion && header.seccion) stu.seccion = header.seccion
      if (!stu.nivel && nivelHeader) stu.nivel = nivelHeader
    }
  }
  return { header, estudiantes }
}

/**
 * Extrae el reporte SIGERD (encabezado + estudiantes con todas las columnas).
 * Usa primero el parser determinista; si no obtiene resultados, recurre a la IA.
 */
export async function parseSigerdStudentsPdf(
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SigerdParseResult> {
  const det = parseSigerdText(text)
  if (det.estudiantes.length > 0) {
    onProgress?.(1, 1)
    return det
  }
  return parseWithAi(text, onProgress)
}
