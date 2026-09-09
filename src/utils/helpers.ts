export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** Convierte «YYYY-MM» (o una fecha ISO) a una etiqueta legible, ej. «Septiembre 2026». */
export function monthLabel(value: string): string {
  if (!value) return '—'
  const [y, m] = value.slice(0, 7).split('-').map(Number)
  if (!y || !m) return value
  return `${MONTHS_ES[m - 1] ?? ''} ${y}`.trim()
}

/** Lista de meses «YYYY-MM» desde startDate hasta endDate (inclusive). */
export function monthsBetween(startDate: string, endDate: string): string[] {
  const s = startDate.slice(0, 7)
  const e = endDate.slice(0, 7)
  if (!s || !e || s > e) return s ? [s] : []
  const result: string[] = []
  let [y, m] = s.split('-').map(Number)
  const [ey, em] = e.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return result
}

export function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function pct(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function relativeDay(iso: string): string {
  const today = todayIso()
  if (iso === today) return 'Hoy'
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'
  return formatDate(iso)
}

/** Nombre de un aula: grado + sección + nivel (ej. "1ro.A de secundaria"), con ciclo si aplica. */
export function aulaLabel(grade: { name?: string; level?: string; nivel?: string; ciclo?: string } | undefined, section?: string): string {
  if (!grade?.name) return 'Aula'
  const base = `${grade.name}${section ? `.${section}` : ''}`
  const nivel = (grade.nivel ?? grade.level ?? '').toLowerCase()
  const part = nivel ? `${base} de ${nivel}` : base
  return grade.ciclo ? `${part} · ${grade.ciclo}` : part
}
