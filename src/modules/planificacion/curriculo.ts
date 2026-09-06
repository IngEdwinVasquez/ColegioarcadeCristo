// Constantes curriculares del sistema educativo dominicano (MINERD).

export const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

export const SECCIONES = ['A', 'B', 'C', 'D']

export const COMPETENCIAS_FUNDAMENTALES = [
  'Competencia Ética y Ciudadana',
  'Competencia Comunicativa',
  'Competencia Pensamiento Lógico, Creativo y Crítico',
  'Competencia Resolución de Problemas',
  'Competencia Científica y Tecnológica',
  'Competencia Ambiental y de la Salud',
  'Competencia Desarrollo Personal y Espiritual',
]

export const EJES_TRANSVERSALES = [
  'Educación para la salud',
  'Educación ambiental y desarrollo sostenible',
  'Educación en valores y derechos humanos',
  'Educación para la convivencia y la paz',
  'Género y equidad',
  'Tecnología, información y comunicación',
  'Cultura dominicana e identidad nacional',
]

export const TIPOS_EVALUACION = ['diagnóstica', 'formativa', 'sumativa']

/** Separa una lista de strings en líneas para editarlas en un textarea. */
export const joinLines = (items: string[]): string => (items ?? []).join('\n')

/** Convierte un textarea (una por línea) en un array limpio. */
export const splitLines = (text: string): string[] =>
  (text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
