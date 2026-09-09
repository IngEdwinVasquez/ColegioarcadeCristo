import type { TicActivity, TicScope, TicStage } from '../types'
import { genId, todayIso } from '../utils/helpers'

const SCOPES: TicScope[] = ['anual', 'mensual', 'semanal']
const STAGES: TicStage[] = ['inicio', 'desarrollo', 'finalizacion']

const TIC_PROMPT = `Eres un coordinador de Tecnología e Innovación (TIC) del sistema educativo dominicano.
A partir de un texto o descripción que se te entrega, genera un plan de trabajo TIC estructurado en JSON válido, con EXACTAMENTE esta estructura:

{
  "title": "título claro de la actividad",
  "description": "descripción detallada de la actividad (objetivo, alcance y tareas principales)",
  "scope": "anual" | "mensual" | "semanal",
  "category": "infraestructura" | "soporte" | "capacitacion" | "innovacion" | "plataforma" | "otros",
  "stage": "inicio" | "desarrollo" | "finalizacion"
}

Reglas:
- Deriva el ámbito, categoría y etapa a partir de la naturaleza del texto (ej. capacitación docente → capacitacion; mantenimiento de equipos → infraestructura; introducción de M365 → plataforma).
- Redacta en español, claro y orientado a la mejora del uso de la tecnología en un centro educativo.
- Responde ÚNICAMENTE el JSON, sin comentarios ni texto adicional.`

/** Genera un plan de trabajo TIC (TicActivity) a partir de un texto/descripción. */
export async function generateTicPlanWithAi(input: { source: string; scope: TicScope; category: string; stage: TicStage; responsible: string }): Promise<TicActivity> {
  const { aiChat, parseAiJson } = await import('./ai')
  const out = await aiChat(
    [
      { role: 'system', content: TIC_PROMPT },
      { role: 'user', content: `Contenido de referencia para el plan de trabajo TIC:\n\n${input.source}` },
    ],
    { temperature: 0.4, jsonMode: true },
  )
  const parsed = parseAiJson<Record<string, unknown>>(out)
  if (!parsed) throw new Error('La IA no devolvió un plan válido. Intente de nuevo.')
  const today = todayIso()
  const as = <T,>(v: unknown, arr: readonly T[], fallback: T): T => (arr.includes(v as T) ? (v as T) : fallback)
  return {
    id: genId('tic'),
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Plan de trabajo TIC',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    scope: as(parsed.scope, SCOPES, input.scope),
    category: input.category,
    stage: as(parsed.stage, STAGES, input.stage),
    startDate: today,
    endDate: today,
    status: 'pendiente',
    progress: 0,
    responsible: input.responsible,
    evidences: [],
    log: [],
    createdAt: new Date().toISOString(),
  }
}
