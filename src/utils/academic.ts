import type { GradeSection } from '../types'

/**
 * Fuente ÚNICA de todo lo académico de la plataforma: listas (Nivel, Grado,
 * Sección, Ciclo) y funciones para derivar Asignatura / Grado / Sección /
 * Curso a partir de los registros de Gestión académica (lista ARC_Grades).
 *
 * Todas las pantallas y portales deben usar estas constantes y funciones para
 * que los desplegables y etiquetas sean idénticos en toda la plataforma, y para
 * que cualquier creación/edición/duplicado/borrado se refleje en todos los
 * sitios (los cursos/asignaturas provienen de la misma lista compartida).
 */

/** Niveles educativos (etiqueta corta, alineada con Gestión académica). */
export const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

/** Grados (1ro…6to). */
export const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to']

/** Secciones (A…G), igual que Gestión académica. */
export const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Ciclos (solo Primaria/Secundaria). */
export const CICLOS = ['Primer ciclo', 'Segundo ciclo']

/** Deduce el nivel educativo (largo) a partir de la "Tanda-Servicio" u otro texto. */
export function nivelDeTanda(tanda?: string): string | null {
  const n = ` ${(tanda ?? '').toLowerCase()} `
  if (/(inicial|pre\s*-?\s*primar|preescolar|kinder|kínder|maternal|nido)/.test(n)) return 'Nivel Inicial'
  if (/(secundari|bachiller|liceo|\bmedia\b)/.test(n)) return 'Nivel Secundario'
  if (/(primari|primario|b[aá]sica)/.test(n)) return 'Nivel Primario'
  return null
}

/** Deduce el nivel educativo a partir del nombre del curso o del equipo. */
export function detectLevel(name: string): string | null {
  const n = ` ${name.toLowerCase()} `
  if (/(inicial|kinder|kínder|pre\s*-?\s*primar|preescolar|maternal|nido|kids)/.test(n)) return 'Nivel Inicial'
  // "Secundaria", "1roSec.", "2do Sec", "media", "bachillerato", "liceo"
  if (/(secundaria|secundario|bachiller|liceo|\bmedia\b|sec\.|\bsec\b|\dro?\.?\s*sec)/.test(n)) return 'Nivel Secundario'
  if (/(primaria|primario|b[aá]sica)/.test(n)) return 'Nivel Primario'
  return null
}

export const LEVEL_SHORT: Record<string, string> = {
  'Nivel Inicial': 'Inicial',
  'Nivel Primario': 'Primaria',
  'Nivel Primaria': 'Primaria',
  'Primario': 'Primaria',
  'Primaria': 'Primaria',
  'Nivel Secundario': 'Secundaria',
  'Nivel Secundaria': 'Secundaria',
  'Secundario': 'Secundaria',
  'Secundaria': 'Secundaria',
  'Inicial': 'Inicial',
}

export const nivelShort = (level: string) => LEVEL_SHORT[level] ?? level

// Grado en cualquier parte del nombre (1ro..6to y ordinales en palabras).
const GRADO_RE = /\b(1ro|2do|3ro|4to|5to|6to|primer|segundo|tercero|cuarto|quinto|sexto)\b/i
const ORD: Record<string, number> = { '1ro': 1, '2do': 2, '3ro': 3, '4to': 4, '5to': 5, '6to': 6, primer: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6 }
const GRADE_WORD = ['1ro', '2do', '3ro', '4to', '5to', '6to']

/** Extrae la sección del curso de forma segura: campo `section` o una letra A–G como palabra independiente. */
export const seccionDe = (curso: GradeSection): string => {
  if (curso.section) return curso.section.trim().toUpperCase()
  const m = curso.name.match(/\b([A-Ga-g])\b/)
  return m ? m[1].toUpperCase() : 'A'
}

/** Extrae el grado (normalizado a 1ro…6to) desde el campo `grado` o del nombre. */
export const gradoDe = (curso: GradeSection): string => {
  if (curso.grado) return curso.grado.trim()
  const m = curso.name.match(GRADO_RE)
  if (!m) return ''
  const num = ORD[m[1].toLowerCase()]
  return (num && GRADE_WORD[num - 1]) || m[1]
}

const gradeNum = (grado: string) => ORD[grado.toLowerCase()] ?? (parseInt(grado, 10) || null)

/** Grado + sección (ej. 1ro.A). En Inicial (sin grado numérico) se usa el nombre del curso. */
export const cursoGrado = (curso: GradeSection): string => {
  const g = gradoDe(curso)
  const s = seccionDe(curso)
  if (g) return `${g}.${s}`
  return (curso.name || s).trim()
}

/** Nombre del curso = Grado + Sección + Nivel (ej. "1ro.A · Primaria"). */
export const cursoNombre = (curso: GradeSection): string => {
  const base = cursoGrado(curso)
  const nivel = nivelShort(curso.level)
  return [base, nivel].filter(Boolean).join(' · ')
}

/** Ciclo según el grado: 1-3 → Primer ciclo, 4-6 → Segundo ciclo (Primaria/Secundaria). */
export const cicloFromGrade = (level: string, grado: string): string | undefined => {
  if (level !== 'Nivel Primario' && level !== 'Nivel Secundario') return undefined
  const n = gradeNum(grado)
  if (n == null) return undefined
  if (n >= 1 && n <= 3) return 'Primer ciclo'
  if (n >= 4 && n <= 6) return 'Segundo ciclo'
  return undefined
}

/** Extrae la asignatura limpia del nombre del curso (sin grado, sección, nivel ni anotaciones). */
export const asignaturaDe = (curso: GradeSection): string => {
  if (curso.asignatura) return curso.asignatura
  let s = curso.name || ''
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ')          // (YOSSY VILLAFAÑA), (Geografía…)
  s = s.replace(/\s*\[[^\]]*\]\s*/g, ' ')          // [copia]
  s = s.replace(/\b1(?:ro|°|er|a)|2(?:do|da|°)|3(?:ro|°)|4(?:to|°)|5(?:to|°)|6(?:to|°)\b/gi, ' ')
  s = s.replace(/\b(primer|segundo|tercero|cuarto|quinto|sexto)\b/gi, ' ')
  s = s.replace(/\bde\s+(primaria|secundaria|inicial)\b/gi, ' ')
  s = s.replace(/\b(primaria|secundaria|inicial|nivel)\b\.?/gi, ' ')
  s = s.replace(/\b[.-]?\s*[A-G]\s*\b/g, ' ')      // secciones sueltas
  s = s.replace(/\d{4}\s*[–\-/]\s*\d{4}/g, ' ')    // años
  s = s.replace(/\d+/g, ' ')
  s = s.replace(/\b(colegio|del|el|la|los|las|arca|cristo|tripulaci|espacial|equipo|implementaci|aula|practica|pr[aá]ctica|encuentros|virtual|imple)\b/gi, ' ')
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ') // emojis
  s = s.replace(/[|·,;:()\[\]+\-_.]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

const NIVEL_ORDEN = ['Inicial', 'Primaria', 'Secundaria']
const GRADO_ORDEN = ['1ro', '2do', '3ro', '4to', '5to', '6to']

/** Indica si un curso tiene estructura válida (tiene grado, o es de Inicial). */
export const esCursoValido = (g: GradeSection): boolean => !(gradoDe(g) === '' && nivelShort(g.level) !== 'Inicial')

const rankGrado = (g: GradeSection): number => {
  const i = GRADO_ORDEN.indexOf(gradoDe(g))
  return i === -1 ? 99 : i
}

/** Ordena y deduplica cursos por Nivel (Inicial → Primaria → Secundaria) → Grado → Sección. */
export function ordenarCursos(grades: GradeSection[]): GradeSection[] {
  const unicos = [...new Map(grades.map((g) => [cursoNombre(g), g])).values()]
  return unicos.sort((a, b) => {
    const ni = NIVEL_ORDEN.indexOf(nivelShort(a.level)) - NIVEL_ORDEN.indexOf(nivelShort(b.level))
    if (ni) return ni
    const gi = rankGrado(a) - rankGrado(b)
    if (gi) return gi
    return seccionDe(a).localeCompare(seccionDe(b))
  })
}

/**
 * Nombres de curso ordenados (Grado + Sección + Nivel). Única fuente para todos
 * los filtros de «Curso» de la plataforma. Si `soloReales`, limita a asignaturas.
 */
export function cursoNombresOrdenados(grades: GradeSection[], soloReales = false): string[] {
  const base = grades.filter((g) => esCursoValido(g) && (!soloReales || isRealSubject(asignaturaDe(g))))
  return ordenarCursos(base).map(cursoNombre)
}

/** Reconoce si un nombre es una asignatura real (por palabras clave curriculares). */
export const isRealSubject = (name: string): boolean => {
  const n = name.toLowerCase()
  const keys = ['matemat', 'lengua', 'ciencias de la naturaleza', 'ciencia', 'ciencias social', 'sociales', 'social', 'educación físico', 'ed. f', 'educación art', 'artística', 'formación integral', 'formación', 'religiosa', 'inglés', 'ingles', 'english', 'francés', 'frances', 'informática', 'informatica', 'artes', 'música', 'musica', 'natural', 'humanidades', 'historia', 'geografía', 'geografia', 'física', 'fisica', 'química', 'quimica', 'biología', 'biologia', 'tecnolog', 'general']
  return keys.some((k) => n.includes(k))
}
