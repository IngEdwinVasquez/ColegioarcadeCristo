import type { SigerdHeader, SigerdStudent } from '../types'

export interface SigerdParseResult {
  header: SigerdHeader
  estudiantes: SigerdStudent[]
}

const SIGERD_PROMPT = `Eres un asistente que extrae la información de un reporte del SIGERD (Sistema de Información para la Gestión Escolar, MINERD - República Dominicana).
El reporte tiene un ENCABEZADO (Año, Dirección Regional, Centro Educativo, Distrito Educativo, Tanda-Servicio, Sector, Grado, Sección, Cantidad de Estudiantes, Docentes) y una TABLA con columnas:
No. de Orden, Id Estudiante, Primer apellido, Segundo apellido, Nombre(s), Nacimiento, Declarado, Municipio, Oficialía, Libro, Folio, Acta, Año, Grado, Sec., Condición, Estado.
Devuelve un JSON válido con EXACTAMENTE:

{
  "encabezado": { "ano": "2026-2027", "direccionRegional": "05-SAN PEDRO DE MACORIS", "centroEducativo": "06983 - EVANGELICO ARCA DE CRISTO", "distritoEducativo": "0503-LA ROMANA", "tandaServicio": "Primario - JORNADA EXTENDIDA", "sector": "PÚBLICO", "grado": "Primero", "seccion": "A", "cantidadEstudiantes": "29", "docentes": "LESLEY RIJO PIMENTEL" },
  "estudiantes": [
    { "noOrden": "12", "idEstudiante": "36460269", "primerApellido": "PIMENTEL", "segundoApellido": "GREEN", "nombres": "AADAM OSMAR", "nacimiento": "04/02/2020", "declarado": "Si", "municipio": "026", "oficialia": "02", "libro": "00001", "folio": "0139", "acta": "139", "anio": "2020", "grado": "Primero", "seccion": "A", "condicion": "NoDefinido", "estado": "Inscrito" }
  ]
}

Reglas:
- Una entrada por estudiante del fragmento.
- "nombres" = columna Nombre(s); los apellidos en sus campos. No los mezcles.
- Conserva los valores tal cual (códigos, números, textos).
- Si un dato no está en este fragmento, usa "" (cadena vacía).
- Ignora totales y pies de página.
- Responde ÚNICAMENTE el JSON.`

const CHUNK_SIZE = 6000
const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

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
    ano: toStr(o.ano),
    direccionRegional: toStr(o.direccionRegional),
    centroEducativo: toStr(o.centroEducativo),
    distritoEducativo: toStr(o.distritoEducativo),
    tandaServicio: toStr(o.tandaServicio),
    sector: toStr(o.sector),
    grado: toStr(o.grado),
    seccion: toStr(o.seccion),
    cantidadEstudiantes: toStr(o.cantidadEstudiantes),
    docentes: toStr(o.docentes),
  }
}

const mergeHeader = (base: SigerdHeader, next: SigerdHeader): SigerdHeader => {
  const out = { ...base }
  for (const k of Object.keys(base) as Array<keyof SigerdHeader>) {
    if (!out[k] && next[k]) out[k] = next[k]
  }
  return out
}

/**
 * Extrae y estructura los estudiantes y el encabezado de un PDF del SIGERD usando IA.
 * Procesa el texto por fragmentos en paralelo para evitar tiempos de espera largos.
 */
export async function parseSigerdStudentsPdf(
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SigerdParseResult> {
  const { aiChat, parseAiJson } = await import('./ai')
  const chunks = splitChunks(text)
  let done = 0

  const parts = await mapLimit(chunks, 3, async (chunk) => {
    try {
      const res = await aiChat(
        [
          { role: 'system', content: SIGERD_PROMPT },
          { role: 'user', content: `Fragmento del reporte SIGERD:\n\n${chunk}` },
        ],
        { temperature: 0.1, jsonMode: true, maxTokens: 3200 },
      )
      const parsed = parseAiJson<Record<string, unknown>>(res)
      return {
        header: headerOf(parsed?.encabezado),
        estudiantes: Array.isArray(parsed?.estudiantes) ? (parsed!.estudiantes as Array<Record<string, unknown>>) : [],
      }
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
        noOrden: toStr(e.noOrden),
        idEstudiante: toStr(e.idEstudiante),
        primerApellido: toStr(e.primerApellido),
        segundoApellido: toStr(e.segundoApellido),
        nombres: toStr(e.nombres),
        nacimiento: toStr(e.nacimiento),
        declarado: toStr(e.declarado),
        municipio: toStr(e.municipio),
        oficialia: toStr(e.oficialia),
        libro: toStr(e.libro),
        folio: toStr(e.folio),
        acta: toStr(e.acta),
        anio: toStr(e.anio),
        grado: toStr(e.grado),
        seccion: toStr(e.seccion),
        condicion: toStr(e.condicion),
        estado: toStr(e.estado),
      }
      if (!stu.nombres && !stu.primerApellido) continue
      const key = stu.idEstudiante
        ? `id:${stu.idEstudiante}`
        : `${stu.nombres}|${stu.primerApellido}|${stu.segundoApellido}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      estudiantes.push(stu)
    }
  }
  return { header, estudiantes }
}
