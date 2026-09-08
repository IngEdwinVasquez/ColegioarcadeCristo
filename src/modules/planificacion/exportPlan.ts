import type { DailyPlan } from '../../types'
import { appConfig } from '../../config/appConfig'

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
const list = (items?: string[]) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>—</p>')
const section = (title: string, body: string) => `<h2>${esc(title)}</h2>${body}`
const metaRow = (label: string, value: string) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`

const STYLE = `<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1B2430;max-width:860px;margin:24px auto;padding:0 20px;line-height:1.55}
  h1{color:#0A1F2B;border-bottom:3px solid #0082AD;padding-bottom:8px;margin-bottom:4px;font-size:22px}
  .kicker{color:#0082AD;font-weight:800;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:2px}
  .title{color:#0A1F2B;font-weight:800;font-size:20px;margin:0 0 2px}
  h2{color:#0082AD;font-size:14px;margin:16px 0 6px;border-left:4px solid #0082AD;padding-left:8px;text-transform:uppercase;letter-spacing:.02em}
  .meta{color:#667085;font-size:12.5px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  td,th{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:12.5px;vertical-align:top}
  th{background:#0A1F2B;color:#fff}
  ul{margin:4px 0 0 18px;padding:0}
  .act{border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:10px;break-inside:avoid}
  .act .n{color:#0082AD;font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  .act .t{font-weight:700;font-size:14px}
  .orient{background:#F3F8FB;border-radius:8px;padding:8px 10px;color:#0B2E3F;font-size:12.5px;margin:8px 0}
  .badge{display:inline-block;background:#E8F3F8;color:#0082AD;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;margin:2px 2px 0 0}
  .recuerda{border:1px solid #F0D9A8;background:#FFF9ED;border-radius:10px;padding:12px 14px}
  .situacion{border-left:4px solid #E62327;padding:4px 0 4px 14px;color:#0B2E3F}
  .marca{font-size:11px;color:#667085;text-align:center;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:8px}
</style>`

/** HTML de una Unidad de Aprendizaje con la estructura del currículo dominicano (Eduplan/MINERD). */
function unidadToHtml(plan: DailyPlan, subjectName: string, gradeName: string): string {
  const areas = plan.secuenciasCurriculares?.length
    ? plan.secuenciasCurriculares.map((s) => esc(`${s.area} ${s.codigo ? `SC ${s.codigo}` : ''}`).trim()).join(' · ')
    : subjectName

  const secList = plan.secuenciasCurriculares?.length
    ? `<table><tr><th>Área</th><th>Código</th><th>Título</th></tr>${plan.secuenciasCurriculares.map((s) => `<tr><td>${esc(s.area)}</td><td>${esc(s.codigo)}</td><td>${esc(s.titulo)}</td></tr>`).join('')}</table>`
    : ''

  const actividades = plan.actividadesDetalle?.length
    ? plan.actividadesDetalle.map((a, i) => `
      <div class="act">
        <div class="n">Actividad ${i + 1} · ${a.fase}</div>
        <div class="t">${esc(a.titulo || a.fase)}</div>
        <div>${esc(a.descripcion)}</div>
        ${a.orientaciones ? `<div class="orient"><b>Orientaciones para la o el docente:</b> ${esc(a.orientaciones)}</div>` : ''}
        ${a.duracion ? `<div style="margin-top:4px"><b>Duración:</b> ${esc(a.duracion)}</div>` : ''}
        ${list(a.estrategias)}
      </div>`).join('')
    : `<table>
        <tr><th>Inicio</th><td>${esc(plan.actividades.inicio)}</td></tr>
        <tr><th>Desarrollo</th><td>${esc(plan.actividades.desarrollo)}</td></tr>
        <tr><th>Cierre</th><td>${esc(plan.actividades.cierre)}</td></tr>
      </table>`

  const apoyos = plan.apoyos?.length
    ? `<table><tr><th>Si observas…</th><th>Trata de…</th></tr>${plan.apoyos.map((a) => `<tr><td>${esc(a.observacion)}</td><td>${esc(a.tratamiento)}</td></tr>`).join('')}</table>`
    : ''

  const anexos = plan.anexos?.length
    ? plan.anexos.map((a, i) => `<div class="act"><div class="n">Anexo ${i + 1}</div><div class="t">${esc(a.titulo)}</div><div>${esc(a.contenido)}</div></div>`).join('')
    : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Unidad de Aprendizaje · ${esc(plan.tema)}</title>${STYLE}</head><body>
<div class="kicker">Propuesta didáctica: Unidad de Aprendizaje</div>
<div class="title">UA · ${esc(plan.tema)}</div>
<p class="meta">${esc(gradeName)} ${esc(plan.section || '')} · ${esc(areas)} · ${esc(appConfig.institution)}</p>
<table>
${metaRow('Nivel', plan.nivel)}
${metaRow('Grado', `${gradeName} ${plan.section || ''}`)}
${metaRow('Área(s)', areas)}
${metaRow('Temporalización', plan.duracion)}
${metaRow('Fecha', plan.fecha)}
</table>
${secList ? section('Secuencias curriculares correspondientes', secList) : ''}
${plan.recuerda ? section('Recuerda', `<div class="recuerda">${esc(plan.recuerda)}</div>`) : ''}
${plan.situacionAprendizaje ? section('Situación de Aprendizaje', `<div class="situacion">${esc(plan.situacionAprendizaje)}</div>`) : ''}
${section('Competencias fundamentales', list(plan.competenciasFundamentales))}
${section('Competencias específicas · Contenidos · Indicadores de logro · Materiales', `<table>
<tr><th>Competencias específicas</th><th>Contenidos</th><th>Indicadores de logro</th><th>Materiales</th></tr>
<tr>
  <td>${list(plan.competenciasEspecificas)}</td>
  <td><b>Conceptuales:</b><br>${esc(plan.contenidos.conceptuales)}<br><br><b>Procedimentales:</b><br>${esc(plan.contenidos.procedimentales)}<br><br><b>Actitudinales:</b><br>${esc(plan.contenidos.actitudinales)}</td>
  <td>${list(plan.indicadoresLogro)}</td>
  <td>${list(plan.materiales ?? plan.recursos)}</td>
</tr></table>`)}
${section('Estrategias y técnicas de enseñanza y aprendizaje', list(plan.estrategias))}
${plan.recursosDigitales?.length ? section('Recursos didácticos digitales', list(plan.recursosDigitales)) : ''}
${section('Secuencia didáctica', actividades)}
${apoyos ? section('Si observas…, trata de…', apoyos) : ''}
${anexos ? section('Anexos', anexos) : ''}
${section('Evaluación', `Tipo: ${esc(plan.evaluacion.tipo)} · Instrumento: ${esc(plan.evaluacion.instrumento)}<br/>${esc(plan.evaluacion.criterios)}`)}
<p class="marca">Generado por la Intranet ${esc(appConfig.shortName)} · ${new Date().toLocaleDateString('es-DO')}</p>
</body></html>`
}

/** HTML estándar de una planificación diaria. */
function diariaToHtml(plan: DailyPlan, subjectName: string, gradeName: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Planificación ${esc(plan.tema)}</title>${STYLE}</head><body>
<div class="kicker">Planificación de clase</div>
<div class="title">${esc(plan.tema)}</div>
<p class="meta">${esc(gradeName)} ${esc(plan.section || '')} · ${esc(subjectName)} · ${esc(appConfig.institution)}</p>
<table>${metaRow('Nivel', plan.nivel)}${metaRow('Fecha', plan.fecha)}${metaRow('Duración', plan.duracion)}</table>
${plan.recuerda ? section('Recuerda', `<div class="recuerda">${esc(plan.recuerda)}</div>`) : ''}
${section('Competencias fundamentales', list(plan.competenciasFundamentales))}
${section('Competencias específicas', list(plan.competenciasEspecificas))}
${section('Contenidos', `<table><tr><th>Conceptuales</th><td>${esc(plan.contenidos.conceptuales)}</td></tr><tr><th>Procedimentales</th><td>${esc(plan.contenidos.procedimentales)}</td></tr><tr><th>Actitudinales</th><td>${esc(plan.contenidos.actitudinales)}</td></tr></table>`)}
${section('Actividades', `<table><tr><th>Inicio</th><td>${esc(plan.actividades.inicio)}</td></tr><tr><th>Desarrollo</th><td>${esc(plan.actividades.desarrollo)}</td></tr><tr><th>Cierre</th><td>${esc(plan.actividades.cierre)}</td></tr></table>`)}
${section('Estrategias', list(plan.estrategias))}
${section('Recursos', list(plan.recursos))}
${section('Indicadores de logro', list(plan.indicadoresLogro))}
${section('Evaluación', `Tipo: ${esc(plan.evaluacion.tipo)} · Instrumento: ${esc(plan.evaluacion.instrumento)}<br/>${esc(plan.evaluacion.criterios)}`)}
<p class="marca">Generado por la Intranet ${esc(appConfig.shortName)} · ${new Date().toLocaleDateString('es-DO')}</p>
</body></html>`
}

function planToHtml(plan: DailyPlan, subjectName: string, gradeName: string): string {
  return plan.tipo === 'unidad' ? unidadToHtml(plan, subjectName, gradeName) : diariaToHtml(plan, subjectName, gradeName)
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
  w.onload = () => { w.focus(); w.print() }
}
