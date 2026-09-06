import type { DailyPlan } from '../../types'
import { appConfig } from '../../config/appConfig'

/** Renderiza una planificación como HTML imprimible (para Word y PDF). */
function planToHtml(plan: DailyPlan, subjectName: string, gradeName: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  const list = (items: string[]) =>
    items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>—</p>'
  const section = (title: string, body: string) => `<h2>${esc(title)}</h2>${body}`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>Planificación ${esc(plan.tema)}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1B2430;max-width:820px;margin:24px auto;padding:0 20px;line-height:1.5}
  h1{color:#0A1F2B;border-bottom:3px solid #0095C8;padding-bottom:8px;margin-bottom:4px}
  h2{color:#0095C8;font-size:15px;margin:20px 0 6px;border-left:4px solid #0095C8;padding-left:8px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  td,th{border:1px solid #E4E8EF;padding:6px 10px;text-align:left;font-size:13px;vertical-align:top}
  th{background:#0A1F2B;color:#fff;width:140px}
  ul{margin:4px 0 0 18px;padding:0}
  .meta{color:#667085;font-size:13px;margin-bottom:16px}
  .marca{font-size:11px;color:#667085;text-align:center;margin-top:24px;border-top:1px solid #E4E8EF;padding-top:8px}
</style></head><body>
<h1>Planificación ${plan.tipo === 'unidad' ? 'de Unidad' : 'Diaria'}</h1>
<p class="meta">${esc(appConfig.institution)} · ${esc(plan.nivel)} · ${esc(gradeName)} ${esc(plan.section || '')} · ${esc(subjectName)}</p>
<table>
<tr><th>Unidad</th><td>${esc(plan.unidad)}</td></tr>
<tr><th>Tema</th><td>${esc(plan.tema)}</td></tr>
<tr><th>Fecha</th><td>${esc(plan.fecha)}</td></tr>
<tr><th>Duración</th><td>${esc(plan.duracion)}</td></tr>
</table>
${section('Competencias Fundamentales', list(plan.competenciasFundamentales))}
${section('Competencias Específicas', list(plan.competenciasEspecificas))}
${section('Ejes Transversales', list(plan.ejesTransversales))}
${section('Contenidos', `<table>
<tr><th>Conceptuales</th><td>${esc(plan.contenidos.conceptuales)}</td></tr>
<tr><th>Procedimentales</th><td>${esc(plan.contenidos.procedimentales)}</td></tr>
<tr><th>Actitudinales</th><td>${esc(plan.contenidos.actitudinales)}</td></tr></table>`)}
${section('Actividades', `<table>
<tr><th>Inicio</th><td>${esc(plan.actividades.inicio)}</td></tr>
<tr><th>Desarrollo</th><td>${esc(plan.actividades.desarrollo)}</td></tr>
<tr><th>Cierre</th><td>${esc(plan.actividades.cierre)}</td></tr></table>`)}
${section('Estrategias', list(plan.estrategias))}
${section('Recursos', list(plan.recursos))}
${section('Indicadores de Logro', list(plan.indicadoresLogro))}
${section('Evaluación', `<table>
<tr><th>Tipo</th><td>${esc(plan.evaluacion.tipo)}</td></tr>
<tr><th>Instrumento</th><td>${esc(plan.evaluacion.instrumento)}</td></tr>
<tr><th>Criterios</th><td>${esc(plan.evaluacion.criterios)}</td></tr></table>`)}
<p class="marca">Generado por la Intranet ${esc(appConfig.shortName)} · ${new Date().toLocaleDateString('es-DO')}</p>
</body></html>`
}

/** Descarga la planificación como documento Word (.doc, compatible con Word/Google Docs). */
export function exportPlanWord(plan: DailyPlan, subjectName: string, gradeName: string): void {
  const html = planToHtml(plan, subjectName, gradeName)
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Planificacion_${plan.tema.replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_').slice(0, 40)}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Abre la planificación en una ventana de impresión (permite guardar como PDF). */
export function printPlan(plan: DailyPlan, subjectName: string, gradeName: string): void {
  const html = planToHtml(plan, subjectName, gradeName)
  const w = window.open('', '_blank', 'noopener,width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.onload = () => {
    w.focus()
    w.print()
  }
}
