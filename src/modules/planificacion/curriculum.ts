// Catálogo curricular de referencia (secuencias/unidades por asignatura) inspirado en
// el diseño curricular del MINERD y en la estructura del Eduplan. Es editable: el docente
// puede usarlo para "rellenar por defecto" el planificador o añadir sus propias secuencias.

export const SECUENCIAS: Record<string, string[]> = {
  'Ciencias Sociales': [
    'Los continentes',
    'América: características físicas, socioculturales y económicas',
    'Las migraciones',
    'La Prehistoria',
    'La Historia',
    'Las primeras civilizaciones americanas',
    'Europa en el siglo XV',
    'La expansión europea',
    'El Descubrimiento de América',
    'La organización política del territorio',
    'La población y sus dinámicas',
    'Recursos naturales y desarrollo sostenible',
  ],
  'Ciencias de la Naturaleza': [
    'La respiración y la circulación',
    'El sistema excretor',
    'La reproducción humana',
    'El cuerpo humano y sus sistemas',
    'La célula',
    'Los seres vivos y su clasificación',
    'La alimentación y la nutrición',
    'Los ecosistemas',
    'El agua y el ciclo hidrológico',
    'La energía y sus formas',
    'El sistema solar',
  ],
  'Matemática': [
    'Números naturales y operaciones',
    'Fracciones y decimales',
    'Proporcionalidad',
    'Geometría: figuras y cuerpos',
    'Medidas y magnitudes',
    'Estadística y probabilidad',
    'Solución de problemas',
    'Potencias y raíces',
    'Ecuaciones e inecuaciones',
    'Álgebra básica',
  ],
  'Lengua Española': [
    'La comunicación y el lenguaje',
    'El texto narrativo',
    'El texto descriptivo',
    'El texto expositivo',
    'El texto argumentativo',
    'La oración y sus elementos',
    'El párrafo',
    'La ortografía y la puntuación',
    'La poesía',
    'La lectura comprensiva',
    'La producción escrita',
  ],
  'Inglés': [
    'Greetings and introductions',
    'Personal information',
    'The family',
    'School and classroom',
    'Food and drinks',
    'Clothes',
    'The house',
    'Daily routines',
    'Free time activities',
    'Numbers and dates',
  ],
  'Educación Artística': [
    'El arte y la expresión',
    'El dibujo y la pintura',
    'La música y el ritmo',
    'La danza y el movimiento',
    'El teatro',
    'La apreciación artística',
    'El arte dominicano',
  ],
  'Educación Física': [
    'El calentamiento y la condición física',
    'Juegos y deportes',
    'Los fundamentos del atletismo',
    'La coordinación y el equilibrio',
    'Los deportes de equipo',
    'La salud y la actividad física',
    'La expresión corporal',
  ],
  'Formación Integral Humana y Religiosa': [
    'La persona y su dignidad',
    'La familia',
    'Los valores',
    'La convivencia y la paz',
    'La solidaridad',
    'La fe y la espiritualidad',
  ],
}

/** Devuelve la lista de secuencias (o vacía) para una asignatura por su nombre. */
export function secuenciasDeAsignatura(name?: string): string[] {
  if (!name) return []
  const n = name.trim().toLowerCase()
  const match = Object.keys(SECUENCIAS).find((k) => k.toLowerCase() === n || n.includes(k.toLowerCase()) || k.toLowerCase().includes(n))
  return match ? SECUENCIAS[match] : []
}

export const SECCIONES_PLAN = ['A', 'B', 'C', 'D']

/** Año escolar actual (ej. "2025-2026"). */
export function anioEscolar(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const start = m >= 8 ? y : y - 1
  return `${start}-${start + 1}`
}
