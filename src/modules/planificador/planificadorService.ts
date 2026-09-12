import type { PlanificacionDinamica } from '../../types'
import { dataService } from '../../services/dataService'
import { uploadAndShare } from '../../services/onedrive'
import { formatDate } from '../../utils/helpers'

export interface PlanLabels {
  grado: string
  asignatura: string
  teacher?: string
  institution?: string
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).toLowerCase() || 'planificacion'

const ALCANCE_LABEL: Record<PlanificacionDinamica['alcance'], string> = {
  anual: 'Planificación Anual',
  mensual: 'Planificación Mensual',
  semanal: 'Planificación Semanal',
  actividad: 'Planificación por Actividad',
}

/** Genera el documento HTML de la planificación (para compartir e imprimir/PDF). */
export function planToHtml(plan: PlanificacionDinamica, labels: PlanLabels): string {
  const lista = (arr: string[]) => (arr.length ? `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p class="muted">—</p>')
  const momentos = plan.momentos
    .map(
      (m) => `
      <div class="momento">
        <div class="momento-head"><span>${escapeHtml(m.momento[0].toUpperCase() + m.momento.slice(1))}</span><span>${escapeHtml(m.duracion || '')}</span></div>
        <p>${escapeHtml(m.descripcion || '')}</p>
        ${lista(m.actividades)}
      </div>`,
    )
    .join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(plan.tema || 'Planificación')}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#111;margin:18mm;font-size:11pt;line-height:1.45}
    h1{font-size:18pt;margin:0 0 2px}
    .sub{color:#555;font-size:9pt;margin-bottom:12px}
    h2{font-size:12pt;margin:14px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
    ul{margin:4px 0 8px 18px}
    .momento{border:1px solid #999;border-radius:5px;padding:6px 10px;margin-bottom:6px;break-inside:avoid}
    .momento-head{display:flex;justify-content:space-between;font-weight:700;font-size:10.5pt}
    .muted{color:#888;margin:2px 0}
    @page{size:A4 portrait;margin:12mm}
  </style></head><body>
    <h1>${escapeHtml(ALCANCE_LABEL[plan.alcance])}</h1>
    <div class="sub">${escapeHtml(labels.institution ?? '')}${labels.teacher ? ` · Docente: ${escapeHtml(labels.teacher)}` : ''} · ${escapeHtml(labels.grado)} · ${escapeHtml(labels.asignatura)} · ${formatDate(plan.createdAt.slice(0, 10))}</div>
    <h2>Tema / objetivo</h2><p>${escapeHtml(plan.tema)}${plan.objetivo ? `<br>${escapeHtml(plan.objetivo)}` : ''}</p>
    <h2>Competencias</h2>${lista(plan.competencias)}
    <h2>Indicadores de logro</h2>${lista(plan.indicadores)}
    <h2>Momentos de la clase</h2>${momentos}
    <h2>Recursos</h2>${lista(plan.recursos)}
    <h2>Herramientas tecnológicas</h2>${lista(plan.herramientasTec)}
    <h2>Evaluación</h2><p>${escapeHtml(plan.evaluacion || '—')}</p>
  </body></html>`
}

export const planificadorService = {
  /** Lista todas las planificaciones (el filtrado por docente se hace en la vista). */
  getAll: dataService.getPlanificaciones,
  save: dataService.savePlanificacion,
  remove: dataService.deletePlanificacion,

  /** Comparte la planificación subiéndola a OneDrive y devuelve el enlace. */
  async compartir(plan: PlanificacionDinamica, labels: PlanLabels): Promise<string> {
    const html = planToHtml(plan, labels)
    const file = new File([html], `${slug(plan.tema)}.html`, { type: 'text/html' })
    const ref = await uploadAndShare(`Planificador/${plan.teacherId || 'docente'}`, file)
    return ref.webUrl
  },

  /** Abre la vista de impresión (Guardar como PDF) del plan. */
  descargar(plan: PlanificacionDinamica, labels: PlanLabels): void {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(planToHtml(plan, labels))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  },
}
