import type { WeeklySchedule, TicActivity, TicScope, TicStage, PlanPhase } from '../types'
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

const WEEKLY_PROMPT = `Eres un coordinador TIC. Se te entrega el texto extraído de un PDF de un horario de trabajo semanal (una tabla con columnas HOR / LUNES / MARTES / MIÉRCOLES / JUEVES / VIERNES).
Debes reconstruir la tabla en JSON válido con EXACTAMENTE esta estructura:

{
  "title": "título del horario (ej. Horario mes de Enero)",
  "rows": [
    { "time": "7:45-8:00", "cells": ["texto Lunes", "texto Martes", "texto Miércoles", "texto Jueves", "texto Viernes"] }
  ]
}

Reglas:
- Cada fila tiene un rango de hora y EXACTAMENTE 5 celdas (Lunes..Viernes) en ese orden.
- Si una celda está vacía en el PDF, usa "" (cadena vacía).
- Conserva el texto tal cual, sin inventar contenido.
- Si el texto no parece un horario, devuelve rows vacío.
- Responde ÚNICAMENTE el JSON, sin texto adicional.`

export interface ActivityPlanInput {
  activity: string
  day: string
  time: string
  cronograma: string
  solicitante: string
  rolSolicitante?: string
  objetivo: string
  contenidos: string
  audiencia: string
  estrategia: string
  recursos: string
  evaluacion: string
}

const ACTIVITY_PLAN_PROMPT = `Eres coordinador de Tecnología e Innovación (TIC) y de acompañamiento pedagógico del sistema educativo dominicano.
Recibes la información de una actividad dentro de un cronograma de trabajo (tipo, día y hora) y un formulario llenado por la persona que solicita el programa.
Genera el plan detallado de la actividad en JSON válido con EXACTAMENTE esta estructura:

{
  "inicio": { "duracion": "10 min", "detalle": "..." },
  "desarrollo": { "duracion": "30 min", "detalle": "..." },
  "cierre": { "duracion": "15 min", "detalle": "..." }
}

Los tres momentos del plan deben ser:
- INICIO: elementos de planificación y cronograma de la actividad (bienvenida, presentación de objetivos, agenda, organización del grupo).
- DESARROLLO: presentación de contenidos, desarrollo de actividades y evaluación durante la ejecución de la capacitación o del acompañamiento.
- CIERRE: retroalimentación, reflexión de lo aprendido con los estudiantes, autoevaluación y recomendaciones de mejora por parte de quien imparte la capacitación.

Reglas:
- Usa la información real de la actividad (tipo, día, hora) y del formulario del solicitante; no inventes datos que contradigan la solicitud.
- Incluye el tiempo de cada momento (coherente con la hora planificada de la actividad) en el campo "duracion".
- Redacta en español, claro y orientado a la práctica en un centro educativo.
- Responde ÚNICAMENTE el JSON, sin comentarios ni texto adicional.`

/** Genera el plan (inicio / desarrollo / cierre) de una actividad del cronograma con IA. */
export async function generateActivityPlanWithAi(input: ActivityPlanInput): Promise<{ inicio: PlanPhase; desarrollo: PlanPhase; cierre: PlanPhase }> {
  const { aiChat, parseAiJson } = await import('./ai')
  const out = await aiChat(
    [
      { role: 'system', content: ACTIVITY_PLAN_PROMPT },
      {
        role: 'user',
        content: `ACTIVIDAD DEL CRONOGRAMA:\n- Cronograma: ${input.cronograma}\n- Título: ${input.activity}\n- Día: ${input.day}\n- Hora: ${input.time}\n\nFORMULARIO DE SOLICITUD:\n- Solicitante: ${input.solicitante}\n- Rol: ${input.rolSolicitante ?? '—'}\n- Objetivo: ${input.objetivo}\n- Contenidos/temas: ${input.contenidos}\n- Audiencia: ${input.audiencia}\n- Estrategia/metodología: ${input.estrategia}\n- Recursos: ${input.recursos}\n- Evaluación: ${input.evaluacion}`,
      },
    ],
    { temperature: 0.5, jsonMode: true },
  )
  const parsed = parseAiJson<Record<string, unknown>>(out)
  if (!parsed) throw new Error('La IA no devolvió un plan válido. Intente de nuevo.')
  const phase = (v: unknown): PlanPhase => {
    const o = (v ?? {}) as Record<string, unknown>
    return {
      duracion: typeof o.duracion === 'string' && o.duracion.trim() ? o.duracion.trim() : '',
      detalle: typeof o.detalle === 'string' ? o.detalle : '',
    }
  }
  return {
    inicio: phase(parsed.inicio),
    desarrollo: phase(parsed.desarrollo),
    cierre: phase(parsed.cierre),
  }
}

/** Convierte el texto de un PDF de horario semanal en la estructura (filas de hora × 5 días). */
export async function parseWeeklySchedulePdf(text: string, titleFallback: string): Promise<WeeklySchedule> {
  const { aiChat, parseAiJson } = await import('./ai')
  const out = await aiChat(
    [
      { role: 'system', content: WEEKLY_PROMPT },
      { role: 'user', content: `Contenido del PDF del horario:\n\n${text}` },
    ],
    { temperature: 0.1, jsonMode: true },
  )
  const parsed = parseAiJson<Record<string, unknown>>(out)
  if (!parsed) throw new Error('La IA no pudo interpretar el horario. Verifique que el PDF sea legible.')
  const rows = Array.isArray(parsed.rows)
    ? (parsed.rows as Array<Record<string, unknown>>).map((r) => {
        const time = typeof r.time === 'string' ? r.time.trim() : ''
        const cells = Array.isArray(r.cells) ? (r.cells as unknown[]).map((c) => (typeof c === 'string' ? c : '')) : []
        return { time, cells: [...cells.slice(0, 5), '', '', '', '', ''].slice(0, 5) }
      })
    : []
  return {
    id: genId('ws'),
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : titleFallback,
    rows,
    createdAt: new Date().toISOString(),
  }
}
