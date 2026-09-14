export interface SigerdStudent {
  idEstudiante?: string
  nombres: string
  primerApellido: string
  segundoApellido: string
  nacimiento?: string
  grado?: string
  seccion?: string
}

const SIGERD_PROMPT = `Eres un asistente que extrae la lista de estudiantes de un reporte del SIGERD (Sistema de Información para la Gestión Escolar, MINERD - República Dominicana).
El texto contiene una tabla con columnas como: No. de Orden, Id Estudiante, Primer apellido, Segundo apellido, Nombre(s), Nacimiento, Declarado, Municipio, Oficialía, Libro, Folio, Acta, Año, Grado, Sec., Condición, Estado.
Devuelve un JSON válido con EXACTAMENTE esta estructura:

{
  "estudiantes": [
    { "idEstudiante": "36460269", "nombres": "AADAM OSMAR", "primerApellido": "PIMENTEL", "segundoApellido": "GREEN", "nacimiento": "04/02/2020", "grado": "Primero", "seccion": "A" }
  ]
}

Reglas:
- Una entrada por cada estudiante de la tabla.
- "nombres" es el campo Nombre(s); los apellidos van en sus campos. No los mezcles.
- Conserva los nombres tal cual (en mayúsculas si así vienen).
- Si un dato no está, usa "" (cadena vacía).
- Ignora encabezados, pies de página y totales.
- Responde ÚNICAMENTE el JSON, sin texto adicional.`

/** Extrae y estructura los estudiantes de un PDF del SIGERD usando IA. */
export async function parseSigerdStudentsPdf(text: string): Promise<SigerdStudent[]> {
  const { aiChat, parseAiJson } = await import('./ai')
  const out = await aiChat(
    [
      { role: 'system', content: SIGERD_PROMPT },
      { role: 'user', content: `Texto del reporte SIGERD:\n\n${text.slice(0, 24000)}` },
    ],
    { temperature: 0.1, jsonMode: true, maxTokens: 8000 },
  )
  const parsed = parseAiJson<Record<string, unknown>>(out)
  const arr = Array.isArray(parsed?.estudiantes) ? (parsed!.estudiantes as Array<Record<string, unknown>>) : []
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return arr
    .map((e) => ({
      idEstudiante: s(e.idEstudiante),
      nombres: s(e.nombres),
      primerApellido: s(e.primerApellido),
      segundoApellido: s(e.segundoApellido),
      nacimiento: s(e.nacimiento),
      grado: s(e.grado),
      seccion: s(e.seccion),
    }))
    .filter((e) => e.nombres || e.primerApellido)
}
