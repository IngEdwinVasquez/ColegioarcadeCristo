import { aiChat, parseAiJson } from './ai'

export interface TicAuditEval {
  docente?: string
  mes?: string
  tipo?: string
  resumen?: string
  herramientas?: string[]
  evidencias?: string[]
  fortalezas?: string
  mejoras?: string
  puntaje?: number
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function normMes(v?: string): string | undefined {
  if (!v) return undefined
  const s = String(v).trim().toLowerCase()
  let m = s.match(/(20\d{2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${String(Math.min(12, Math.max(1, Number(m[2])))).padStart(2, '0')}`
  m = s.match(/(\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[2]}-${String(Math.min(12, Math.max(1, Number(m[1])))).padStart(2, '0')}`
  const idx = MESES.findIndex((mes) => s.includes(mes))
  const y = s.match(/(20\d{2})/)
  if (idx >= 0 && y) return `${y[1]}-${String(idx + 1).padStart(2, '0')}`
  const y2 = s.match(/\b(20\d{2})\b/)
  if (idx >= 0 && y2) return `${y2[1]}-${String(idx + 1).padStart(2, '0')}`
  return undefined
}

/** Analiza un documento (texto) de un docente TIC y extrae datos estructurados. */
export async function analizarEvidenciaTic(texto: string, meta: { level: string; fileName: string; path: string }): Promise<TicAuditEval> {
  const body = texto.replace(/\s+/g, ' ').trim().slice(0, 9000)
  const system = 'Eres un auditor experto en integración de tecnología educativa (Microsoft 365) en centros educativos. Analizas documentos de docentes y respondes SOLO con JSON válido.'
  const user = `Nivel: ${meta.level}. Archivo: "${meta.fileName}". Ruta: "${meta.path}".

Analiza el siguiente documento de un docente y extrae la información. Si el nombre del docente o el mes no aparecen claramente en el texto, usa el nombre o la ruta del archivo como pista. Responde con este JSON exacto:
{
  "docente": "nombre completo del docente (cadena vacía si no se identifica)",
  "mes": "mes de la evidencia en formato YYYY-MM (cadena vacía si no se identifica)",
  "tipo": "tipo de evidencia (planificación, informe, actividad, capacitación, fotografía, lista de cotejo, etc.)",
  "resumen": "resumen breve y claro del trabajo o evidencia realizada",
  "herramientas": ["herramientas tecnológicas o recursos digitales usados"],
  "evidencias": ["evidencias concretas observadas"],
  "fortalezas": "fortalezas del trabajo del docente",
  "mejoras": "aspectos a mejorar o recomendaciones",
  "puntaje": 0
}
El "puntaje" es de 0 a 100 según la calidad y el nivel de integración de tecnología en la evidencia.

DOCUMENTO:
${body}`
  const raw = await aiChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { jsonMode: true, temperature: 0.2, maxTokens: 1200 },
  )
  const parsed = parseAiJson<TicAuditEval>(raw)
  if (!parsed) throw new Error('La IA no devolvió un JSON válido.')
  const puntaje = Number(parsed.puntaje)
  return {
    docente: (parsed.docente ?? '').trim() || undefined,
    mes: normMes(parsed.mes),
    tipo: (parsed.tipo ?? '').trim() || undefined,
    resumen: (parsed.resumen ?? '').trim(),
    herramientas: Array.isArray(parsed.herramientas) ? parsed.herramientas.filter(Boolean) : [],
    evidencias: Array.isArray(parsed.evidencias) ? parsed.evidencias.filter(Boolean) : [],
    fortalezas: parsed.fortalezas,
    mejoras: parsed.mejoras,
    puntaje: Number.isFinite(puntaje) ? Math.max(0, Math.min(100, Math.round(puntaje))) : 0,
  }
}
