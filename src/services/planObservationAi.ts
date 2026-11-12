import { aiChat, parseAiJson } from './ai'

export interface PlanEval {
  docente?: string
  herramientas: string[]
  recursos: string[]
  puntaje: number
  resumen: string
  fortalezas?: string
  mejoras?: string
  recomendaciones?: string
}

/**
 * Analiza el texto de una planificación y evalúa el uso de herramientas y
 * recursos tecnológicos en la enseñanza. Devuelve datos estructurados.
 */
export async function evaluarPlanificacion(texto: string, meta: { level: string; fileName: string; suggestedTeacher?: string }): Promise<PlanEval> {
  const body = texto.replace(/\s+/g, ' ').trim().slice(0, 9000)
  const system = 'Eres un evaluador pedagógico experto en integración de tecnología educativa (Microsoft 365, recursos digitales, plataformas). Analizas documentos de planificación docente y respondes SOLO con JSON válido.'
  const user = `Nivel: ${meta.level}. Archivo: ${meta.fileName}. Docente sugerido: ${meta.suggestedTeacher ?? '(desconocido)'}.

Evalúa la siguiente planificación y responde con este JSON exacto:
{
  "docente": "nombre del docente si aparece",
  "herramientas": ["herramientas tecnológicas usadas (ej. Teams, PowerPoint, Excel, Minecraft, Scratch, plataforma M365)"],
  "recursos": ["recursos digitales o físicos usados (videos, simuladores, PDF, laboratorio, robótica)"],
  "puntaje": 0,
  "resumen": "resumen breve de cómo integra la tecnología",
  "fortalezas": "fortalezas observadas",
  "mejoras": "aspectos a mejorar",
  "recomendaciones": "recomendaciones concretas"
}
El "puntaje" es de 0 a 100 según el nivel de integración de herramientas/recursos tecnológicos.

PLANIFICACIÓN:
${body}`
  const raw = await aiChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { jsonMode: true, temperature: 0.2, maxTokens: 1200 },
  )
  const parsed = parseAiJson<PlanEval>(raw)
  if (!parsed) throw new Error('La IA no devolvió un JSON válido.')
  return {
    docente: parsed.docente,
    herramientas: Array.isArray(parsed.herramientas) ? parsed.herramientas.filter(Boolean) : [],
    recursos: Array.isArray(parsed.recursos) ? parsed.recursos.filter(Boolean) : [],
    puntaje: Number.isFinite(parsed.puntaje) ? Math.max(0, Math.min(100, Math.round(parsed.puntaje))) : 0,
    resumen: parsed.resumen ?? '',
    fortalezas: parsed.fortalezas,
    mejoras: parsed.mejoras,
    recomendaciones: parsed.recomendaciones,
  }
}
