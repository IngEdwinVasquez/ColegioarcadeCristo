import { buildSeedDb } from './seed'

const STORAGE_KEY = 'arca_demo_db_v6'

export type DemoDb = Record<string, object[]>

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb
      if (parsed.ARC_Students?.length) {
        // Asegurar que haya comunicados demo aunque exista DB previa
        seedComunicados()
        return parsed
      }
    }
  } catch {
    /* se reconstruye */
  }
  const db = buildSeedDb()
  persist()
  seedComunicados()
  return db
}

function seedComunicados() {
  const key = 'arca_comunicados'
  if (localStorage.getItem(key)) return
  const now = new Date()
  const ago = (dias: number) => new Date(now.getTime() - dias * 86400000).toISOString()
  const comunicados = [
    { id: 'com-1', titulo: 'Circular #1 — Inicio del período de evaluaciones', contenido: 'Estimadas familias: Les informamos que el período de evaluaciones parciales inicia el próximo lunes 15. Los estudiantes deben presentarse puntualmente con los materiales necesarios. Agradecemos su colaboración para garantizar un proceso ordenado.', fecha: ago(5) },
    { id: 'com-2', titulo: 'Reunión de padres — Entrega de boletines', contenido: 'El viernes 20 se realizará la reunión de padres y tutores para la entrega de boletines del trimestre. La cita es a las 4:00 p.m. en el salón de actos. Su asistencia es fundamental para conocer el progreso académico de sus hijos.', fecha: ago(3) },
    { id: 'com-3', titulo: 'Aviso — Actividad del Día de la Familia', contenido: 'El sábado 28 celebraremos el Día de la Familia con actividades recreativas, concursos y almuerzo compartido. Se invita a todas las familias a participar. Los estudiantes deben venir con su uniforme de educación física.', fecha: ago(1) },
  ]
  localStorage.setItem(key, JSON.stringify(comunicados))
}

let db: DemoDb = load()

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* almacenamiento no disponible */
  }
}

export function demoGet<T>(listName: string): Array<T & { id: string }> {
  return (db[listName] ?? []) as Array<T & { id: string }>
}

export function demoAdd<T>(listName: string, item: T): T & { id: string } {
  const existingId = (item as { id?: string } | null)?.id
  const full = { ...item, id: existingId || genId() } as T & { id: string }
  db[listName] = db[listName] ?? []
  db[listName].push(full)
  persist()
  return full
}

export function demoUpdate<T>(listName: string, id: string, patch: Partial<T>): void {
  db[listName] = db[listName] ?? []
  db[listName] = db[listName].map((item) =>
    (item as { id: string }).id === id ? { ...item, ...patch } : item,
  )
  persist()
}

export function demoDelete(listName: string, id: string): void {
  db[listName] = (db[listName] ?? []).filter((item) => (item as { id: string }).id !== id)
  persist()
}

export function demoReplace(listName: string, items: Record<string, unknown>[]): void {
  db[listName] = items
  persist()
}

export function resetDemoData(): void {
  db = {}
  persist()
}
