import type { DailyPlan } from '../types'

/**
 * Prompt de sistema del agente de IA para generar planificaciones académicas
 * conforme al diseño curricular del MINERD (República Dominicana).
 *
 * Se mantiene como constante exportada para que pueda reutilizarse, auditarse
 * o ajustarse desde un único lugar (ver docs/IA_PLANIFICACION.md).
 */
export const MINERD_SYSTEM_PROMPT = `Eres un planificador curricular experto del sistema educativo de la República Dominicana,
alineado con el Diseño Curricular del Ministerio de Educación (MINERD).

Tu tarea es generar planificaciones académicas de clase (diarias) o de unidad didáctica
para docentes, con rigor pedagógico y adaptadas al nivel, grado, asignatura y tema solicitados.

Debes producir SIEMPRE una respuesta en JSON válido (sin texto adicional) con EXACTAMENTE esta estructura:

{
  "tipo": "diaria" | "unidad",
  "nivel": "Inicial" | "Primaria" | "Secundaria",
  "unidad": "nombre de la unidad didáctica",
  "tema": "tema específico de la sesión",
  "duracion": "duración estimada (ej. 45 minutos)",
  "competenciasFundamentales": ["1 a 3 competencias fundamentales aplicables"],
  "competenciasEspecificas": ["1 a 3 competencias específicas del área/asignatura"],
  "ejesTransversales": ["1 a 3 ejes transversales del currículo"],
  "contenidos": {
    "conceptuales": "saberes/conceptos",
    "procedimentales": "habilidades/procedimientos",
    "actitudinales": "valores/actitudes"
  },
  "actividades": {
    "inicio": "actividad de apertura (recuperación de saberes previos, motivación)",
    "desarrollo": "actividades de construcción del aprendizaje",
    "cierre": "actividad de síntesis y evaluación formativa"
  },
  "estrategias": ["estrategias de enseñanza-aprendizaje"],
  "recursos": ["recursos y materiales didácticos"],
  "indicadoresLogro": ["indicadores de logro observables y medibles"],
  "evaluacion": {
    "tipo": "diagnóstica | formativa | sumativa",
    "instrumento": "instrumento de evaluación (rúbrica, lista de cotejo, prueba, etc.)",
    "criterios": "criterios concretos de evaluación"
  }
}

Reglas:
1. Las 7 competencias fundamentales son: Competencia Ética y Ciudadana; Comunicativa;
   Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica;
   Ambiental y de la Salud; Desarrollo Personal y Espiritual. Selecciona solo las pertinentes.
2. Las competencias específicas deben corresponder al área (Matemática, Lengua Española,
   Ciencias de la Naturaleza, Ciencias Sociales, Educación Física, Educación Artística,
   Formación Integral Humana y Religiosa, Lenguas Extranjeras, etc.).
3. Los indicadores de logro deben ser observables, medibles y coherentes con los contenidos
   y las actividades. Usa verbos de acción (identifica, explica, resuelve, compara, argumenta…).
4. Adecúa el vocabulario, la complejidad y los ejemplos al nivel y grado indicados.
5. En el nivel Inicial prioriza el juego, la exploración y los ámbitos de experiencia.
6. Redacta en español neutro y claro, sin salirte del currículo dominicano.
7. No inventes indicadores oficiales: basados en la estructura curricular, formula indicadores
   propios coherentes y coherentes con el grado.`

/** Genera el mensaje de usuario para la planificación con los datos seleccionados. */
export function buildPlanningUserPrompt(input: {
  nivel: string
  grado: string
  asignatura: string
  tema: string
  tipo: 'diaria' | 'unidad'
  duracion?: string
  observaciones?: string
}): string {
  const partes = [
    'Genera una planificación con los siguientes datos:',
    `- Nivel: ${input.nivel || 'no especificado'}`,
    `- Grado: ${input.grado || 'no especificado'}`,
    `- Asignatura/Área: ${input.asignatura || 'no especificada'}`,
    `- Tema/Unidad: ${input.tema || 'no especificado'}`,
    `- Tipo: ${input.tipo === 'unidad' ? 'planificación de unidad didáctica' : 'planificación diaria de clase'}`,
  ]
  if (input.duracion) partes.push(`- Duración: ${input.duracion}`)
  if (input.observaciones) partes.push(`- Observaciones adicionales: ${input.observaciones}`)
  partes.push('Devuelve únicamente el JSON con la estructura indicada, sin comentarios ni texto fuera del JSON.')
  return partes.join('\n')
}

/** Sanitiza el JSON generado por la IA y lo convierte en un DailyPlan parcial. */
export function mapAiPlanToDailyPlan(
  raw: Record<string, unknown>,
  defaults: Pick<DailyPlan, 'id' | 'teacherId' | 'subjectId' | 'gradeId' | 'section' | 'fecha'>,
): DailyPlan {
  const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const contenidos = (raw.contenidos ?? {}) as Record<string, unknown>
  const actividades = (raw.actividades ?? {}) as Record<string, unknown>
  const evaluacion = (raw.evaluacion ?? {}) as Record<string, unknown>
  const tipo: DailyPlan['tipo'] = raw.tipo === 'unidad' ? 'unidad' : 'diaria'

  return {
    ...defaults,
    tipo,
    nivel: str(raw.nivel, defaults.section ? 'Primaria' : ''),
    unidad: str(raw.unidad, str(raw.tema)),
    tema: str(raw.tema),
    duracion: str(raw.duracion, '45 minutos'),
    competenciasFundamentales: list(raw.competenciasFundamentales),
    competenciasEspecificas: list(raw.competenciasEspecificas),
    ejesTransversales: list(raw.ejesTransversales),
    contenidos: {
      conceptuales: str(contenidos.conceptuales),
      procedimentales: str(contenidos.procedimentales),
      actitudinales: str(contenidos.actitudinales),
    },
    actividades: {
      inicio: str(actividades.inicio),
      desarrollo: str(actividades.desarrollo),
      cierre: str(actividades.cierre),
    },
    estrategias: list(raw.estrategias),
    recursos: list(raw.recursos),
    indicadoresLogro: list(raw.indicadoresLogro),
    evaluacion: {
      tipo: str(evaluacion.tipo, 'formativa'),
      instrumento: str(evaluacion.instrumento),
      criterios: str(evaluacion.criterios),
    },
    generadoPorIA: true,
    createdAt: new Date().toISOString(),
  }
}

/** Genera una planificación con IA y devuelve el DailyPlan listo para prellenar el formulario. */
export async function generatePlanWithAi(input: {
  nivel: string
  grado: string
  asignatura: string
  tema: string
  tipo: 'diaria' | 'unidad'
  duracion?: string
  observaciones?: string
  defaults: Pick<DailyPlan, 'id' | 'teacherId' | 'subjectId' | 'gradeId' | 'section' | 'fecha'>
}): Promise<DailyPlan> {
  const { aiChat, parseAiJson } = await import('./ai')
  const text = await aiChat(
    [
      { role: 'system', content: MINERD_SYSTEM_PROMPT },
      { role: 'user', content: buildPlanningUserPrompt(input) },
    ],
    { temperature: 0.4, jsonMode: true },
  )
  const parsed = parseAiJson<Record<string, unknown>>(text)
  if (!parsed) throw new Error('La IA no devolvió una estructura válida. Intente de nuevo.')
  return mapAiPlanToDailyPlan(parsed, input.defaults)
}
