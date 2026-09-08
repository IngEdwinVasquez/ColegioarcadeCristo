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
