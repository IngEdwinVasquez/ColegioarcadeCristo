import type { Accompaniment } from '../../types'
import { appConfig } from '../../config/appConfig'

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
}

function acompToHtml(a: Accompaniment, teacherName: string): string {
  const meta = (label: string, value: string) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`
  const section = (title: string, body: string) => `<h2>${esc(title)}</h2><p>${body || '—'}</p>`
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>Acompañamiento docente · ${esc(a.topic)}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1B2430;max-width:820px;margin:24px auto;padding:0 20px;line-height:1.55}
  h1{color:#0A1F2B;border-bottom:3px solid #0082AD;padding-bottom:8px;font-size:22px}
  h2{color:#0082AD;font-size:14px;margin:18px 0 6px;border-left:4px solid #0082AD;padding-left:8px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  td,th{border:1px solid #E2E8F0;padding:6px 10px;text-align:left;font-size:13px;vertical-align:top}
  th{background:#0A1F2B;color:#fff;width:160px}
  p{margin:4px 0;white-space:pre-wrap}
  .marca{font-size:11px;color:#667085;text-align:center;margin-top:24px;border-top:1px solid #E2E8F0;padding-top:8px}
</style></head><body>
<h1>Registro de Acompañamiento Docente</h1>
<p>${esc(appConfig.institution)} · Coordinación Pedagógica · ${esc(a.level)}</p>
<table>
${meta('Docente', teacherName)}
${meta('Fecha', a.date)}
${meta('Fase', a.phase)}
${meta('Tema / objetivo', a.topic)}
${meta('Estado', a.status)}
${a.agreedFollowUp ? meta('Compromiso acordado', a.agreedFollowUp) : ''}
${a.followUpDate ? meta('Fecha de seguimiento', a.followUpDate) : ''}
</table>
${section('Observaciones de la sesión', a.observations)}
${section('Fortalezas observadas', a.strengths)}
${section('Aspectos a mejorar', a.improvements)}
${section('Recomendaciones', a.recommendations)}
<p class="marca">Generado por la Intranet ${esc(appConfig.shortName)} · ${new Date().toLocaleDateString('es-DO')}</p>
</body></html>`
}

/** Abre la ventana de impresión (permite guardar como PDF). */
export function printAcompanamiento(a: Accompaniment, teacherName: string): void {
  const w = window.open('', '_blank', 'noopener,width=900,height=700')
  if (!w) return
  w.document.open()
  w.document.write(acompToHtml(a, teacherName))
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

/** Descarga como documento Word (.doc). */
export function exportAcompanamientoWord(a: Accompaniment, teacherName: string): void {
  const blob = new Blob(['\ufeff', acompToHtml(a, teacherName)], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const aEl = document.createElement('a')
  aEl.href = url
  aEl.download = `Acompanamiento_${a.topic.replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_').slice(0, 40)}.doc`
  document.body.appendChild(aEl)
  aEl.click()
  document.body.removeChild(aEl)
  URL.revokeObjectURL(url)
}
