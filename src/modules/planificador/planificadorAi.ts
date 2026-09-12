import type { PlanAlcance, PlanMomento, PlanMomentoNombre, PlanificacionDinamica } from '../../types'
import { genId } from '../../utils/helpers'

export interface GenerarPlanInput {
  nivel?: string
  grado: string
  asignatura: string
  tema: string
  alcance: PlanAlcance
  duracion?: string
  observaciones?: string
  defaults: Pick<PlanificacionDinamica, 'id' | 'teacherId' | 'gradeId' | 'subjectId'>
}

const SYSTEM_PROMPT = `Eres un experto diseñador curricular del MINERD (República Dominicana) y coach de docentes.
A partir de muy poca información (grado/curso, asignatura y tema/objetivo) redactas una planificación pedagógica completa y realista.
Responde ÚNICAMENTE en JSON válido con EXACTAMENTE esta estructura:

{
  "objetivo": "objetivo general de la planificación",
  "competencias": ["2 a 4 competencias fundamentales/específicas"],
  "indicadores": ["3 a 6 indicadores de logro observables"],
  "momentos": [
    { "momento": "inicio", "duracion": "15 min", "descripcion": "qué hace el docente y qué hacen los estudiantes", "actividades": ["actividad 1", "actividad 2"] },
    { "momento": "desarrollo", "duracion": "30 min", "descripcion": "...", "actividades": ["...", "..."] },
    { "momento": "cierre", "duracion": "10 min", "descripcion": "...", "actividades": ["..."] }
  ],
  "recursos": ["recursos y materiales necesarios"],
  "herramientasTec": ["herramientas tecnológicas recomendadas (M365, Teams, etc.)"],
  "evaluacion": "cómo se evaluará (tipo, instrumento y criterios)"
}

Reglas:
- Adapta el vocabulario, la dificultad y las actividades al grado/curso indicado.
- Los tres momentos deben existir siempre, en orden inicio, desarrollo, cierre, con su duración.
- Usa un enfoque activo y competencial (MINERD), integrando tecnología cuando aporte.
- Español claro y profesional. Responde SOLO el JSON.`

function toStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : []
}

/** Genera una planificación dinámica con IA a partir de 3 datos clave. */
export async function generarPlanConIA(input: GenerarPlanInput): Promise<PlanificacionDinamica> {
  const { aiChat, parseAiJson } = await import('../../services/ai')
  const texto = await aiChat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Grado/curso: ${input.grado}\nAsignatura: ${input.asignatura}\nTema u objetivo: ${input.tema}\nAlcance: ${input.alcance}${input.duracion ? `\nDuración: ${input.duracion}` : ''}${input.observaciones ? `\nObservaciones: ${input.observaciones}` : ''}`,
      },
    ],
    { temperature: 0.4, jsonMode: true },
  )
  const parsed = parseAiJson<Record<string, unknown>>(texto)
  if (!parsed) throw new Error('La IA no devolvió una planificación válida. Intente de nuevo.')

  const orden: PlanMomentoNombre[] = ['inicio', 'desarrollo', 'cierre']
  const momentosIA = Array.isArray(parsed.momentos) ? (parsed.momentos as Array<Record<string, unknown>>) : []
  const momentos: PlanMomento[] = orden.map((nombre) => {
    const m = momentosIA.find((x) => String(x.momento ?? '').toLowerCase() === nombre)
    return {
      momento: nombre,
      duracion: typeof m?.duracion === 'string' ? m.duracion : '',
      descripcion: typeof m?.descripcion === 'string' ? m.descripcion : '',
      actividades: toStrArray(m?.actividades),
    }
  })

  return {
    id: input.defaults.id || genId('plan'),
    teacherId: input.defaults.teacherId,
    alcance: input.alcance,
    estado: 'borrador',
    nivel: input.nivel,
    gradeId: input.defaults.gradeId,
    subjectId: input.defaults.subjectId,
    tema: input.tema,
    objetivo: typeof parsed.objetivo === 'string' ? parsed.objetivo : '',
    duracion: input.duracion,
    competencias: toStrArray(parsed.competencias),
    indicadores: toStrArray(parsed.indicadores),
    momentos,
    recursos: toStrArray(parsed.recursos),
    herramientasTec: toStrArray(parsed.herramientasTec),
    evaluacion: typeof parsed.evaluacion === 'string' ? parsed.evaluacion : '',
    generadoPorIA: true,
    createdAt: new Date().toISOString(),
  }
}
