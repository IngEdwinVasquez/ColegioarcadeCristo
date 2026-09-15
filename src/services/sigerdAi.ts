export interface SigerdStudent {
  idEstudiante?: string
  nombres: string
  primerApellido: string
  segundoApellido: string
  nacimiento?: string
  grado?: string
  seccion?: string
}

const SIGERD_PROMPT = `Eres un asistente que extrae estudiantes de un reporte del SIGERD (MINERD - República Dominicana).
El texto contiene una tabla con columnas: No. de Orden, Id Estudiante, Primer apellido, Segundo apellido, Nombre(s), Nacimiento, Declarado, Municipio, Oficialía, Libro, Folio, Acta, Año, Grado, Sec., Condición, Estado.
Devuelve un JSON válido con EXACTAMENTE:

{ "estudiantes": [ { "idEstudiante": "36460269", "nombres": "AADAM OSMAR", "primerApellido": "PIMENTEL", "segundoApellido": "GREEN", "nacimiento": "04/02/2020", "grado": "Primero", "seccion": "A" } ] }

Reglas:
- Una entrada por estudiante del fragmento.
- "nombres" = campo Nombre(s); los apellidos en sus campos. No los mezcles.
- Ignora encabezados, pies y totales. Si un dato falta, "".
- Responde ÚNICAMENTE el JSON.`

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

const toStr = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

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

/**
 * Extrae y estructura los estudiantes de un PDF del SIGERD usando IA.
 * Procesa el texto por fragmentos en paralelo (varias llamadas cortas) para
 * evitar tiempos de espera largos, y deduplica los resultados.
 */
export async function parseSigerdStudentsPdf(
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SigerdStudent[]> {
  const { aiChat, parseAiJson } = await import('./ai')
  const chunks = splitChunks(text)
  const seen = new Set<string>()
  let done = 0

  const parts = await mapLimit(chunks, 3, async (chunk) => {
    try {
      const res = await aiChat(
        [
          { role: 'system', content: SIGERD_PROMPT },
          { role: 'user', content: `Fragmento del reporte SIGERD:\n\n${chunk}` },
        ],
        { temperature: 0.1, jsonMode: true, maxTokens: 3000 },
      )
      const parsed = parseAiJson<Record<string, unknown>>(res)
      return Array.isArray(parsed?.estudiantes) ? (parsed!.estudiantes as Array<Record<string, unknown>>) : []
    } catch {
      return [] as Array<Record<string, unknown>>
    } finally {
      done += 1
      onProgress?.(done, chunks.length)
    }
  })

  const out: SigerdStudent[] = []
  for (const arr of parts) {
    for (const e of arr) {
      const stu: SigerdStudent = {
        idEstudiante: toStr(e.idEstudiante),
        nombres: toStr(e.nombres),
        primerApellido: toStr(e.primerApellido),
        segundoApellido: toStr(e.segundoApellido),
        nacimiento: toStr(e.nacimiento),
        grado: toStr(e.grado),
        seccion: toStr(e.seccion),
      }
      if (!stu.nombres && !stu.primerApellido) continue
      const key = stu.idEstudiante
        ? `id:${stu.idEstudiante}`
        : `${stu.nombres}|${stu.primerApellido}|${stu.segundoApellido}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(stu)
    }
  }
  return out
}
