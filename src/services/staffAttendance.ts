import { dataService } from './dataService'
import { genId, todayIso } from '../utils/helpers'

/** Días hábiles (lunes a viernes) entre dos fechas ISO (incluidas). */
export function diasHabiles(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  while (d <= fin) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export interface PersonalRef { id: string; name: string; kind: 'docente' | 'persona' }

/**
 * Marca automáticamente como AUSENTE a todo el personal (docentes y personal
 * institucional) que no reportó asistencia en un día laboral ya transcurrido.
 * Excluye sábados y domingos. No toca los reportes existentes.
 */
export async function backfillStaffAbsent(staff: PersonalRef[], desde: string): Promise<number> {
  const hoy = todayIso()
  const existing = await dataService.getStaffAttendance()
  const dias = diasHabiles(desde, hoy).filter((d) => d < hoy)
  let creados = 0
  const ya = new Set(existing.map((r) => `${r.personId}|${r.date}`))
  for (const p of staff) {
    for (const date of dias) {
      if (ya.has(`${p.id}|${date}`)) continue
      await dataService.saveStaffAttendance({
        id: genId('satt'),
        personId: p.id,
        personName: p.name,
        kind: p.kind,
        date,
        status: 'ausente',
        auto: true,
        reportedBy: 'Sistema',
        updatedAt: new Date().toISOString(),
      })
      creados += 1
    }
  }
  return creados
}
