import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, Tab, TabList, Textarea, Spinner, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { SparkleRegular, CopyRegular, DocumentPdfRegular, CloudArrowUpRegular } from '@fluentui/react-icons'
import { ModalForm } from './ModalForm'
import { FormField } from './form'
import { useApp } from '../../context/useApp'
import { appConfig } from '../../config/appConfig'
import { aiChat, isAiConfigured } from '../../services/ai'
import { extractPdfText } from '../../services/pdf'

const useStyles = makeStyles({
  fab: {
    position: 'fixed',
    right: '22px',
    bottom: '22px',
    zIndex: 1500,
    boxShadow: '0 10px 26px rgba(10,31,43,0.35)',
    borderRadius: '999px',
  },
  hint: { background: tokens.colorNeutralBackground2, borderRadius: '10px', padding: '8px 12px', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '10px', color: tokens.colorNeutralForeground2 },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
})

type Modo = 'crear' | 'modificar' | 'investigar' | 'reporte' | 'evaluacion'

const MODOS: Array<{ value: Modo; label: string; hint: string }> = [
  { value: 'crear', label: 'Crear', hint: 'Genera un recurso, actividad, material o texto nuevo.' },
  { value: 'modificar', label: 'Modificar', hint: 'Mejora, corrige, resume o adapta un contenido existente.' },
  { value: 'investigar', label: 'Investigar', hint: 'Investiga un tema y entrega un resumen con ideas clave.' },
  { value: 'reporte', label: 'Reporte', hint: 'Redacta un informe o síntesis profesional.' },
  { value: 'evaluacion', label: 'Evaluación', hint: 'Crea preguntas, rúbricas o instrumentos de evaluación.' },
]

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function buildSystemPrompt(modo: Modo, section: string, rol?: string): string {
  const base = `Eres un asistente experto de la Plataforma Virtual del ${appConfig.institution} (República Dominicana). El usuario está en la sección «${section}» con el rol «${rol ?? 'usuario'}». Responde en español, claro, profesional y listo para usar en un centro educativo.`
  const porModo: Record<Modo, string> = {
    crear: 'REDACTA desde cero el recurso/actividad/material solicitado, con estructura y detalles suficientes para usarlo de inmediato.',
    modificar: 'MEJORA el contenido que se te entrega: corrige, ordena, enriquece y adapta al contexto indicado, conservando la intención original.',
    investigar: 'INVESTIGA el tema solicitado y entrega un resumen organizado (contexto, ideas clave, datos relevantes y recomendaciones). Si algo no es verificable, indícalo.',
    reporte: 'REDACTA un informe profesional con título, introducción, desarrollo por secciones, conclusiones y recomendaciones.',
    evaluacion: 'DISEÑA instrumentos de evaluación (preguntas, rúbricas, listas de cotejo) alineados a los indicadores de logro, con criterios claros.',
  }
  return `${base}\n${porModo[modo]}\nNo inventes datos institucionales que no se te den. Devuelve texto listo para copiar.`
}

/** Asistente de IA global (Crear / Modificar / Investigar / Reporte / Evaluación) disponible en todos los portales. */
export function GlobalAiAssistant() {
  const styles = useStyles()
  const toaster = useToastController()
  const { role } = useApp()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<Modo>('crear')
  const [prompt, setPrompt] = useState('')
  const [contexto, setContexto] = useState('')
  const [salida, setSalida] = useState('')
  const [generando, setGenerando] = useState(false)
  const pdfRef = useRef<HTMLInputElement>(null)
  const aiReady = isAiConfigured()

  const section = location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/-/g, ' ') || 'inicio'
  const hint = MODOS.find((m) => m.value === modo)?.hint

  const generar = async () => {
    if (!prompt.trim()) {
      toaster.dispatchToast('Escribe qué necesitas.', { intent: 'error' })
      return
    }
    setGenerando(true)
    try {
      const contenido = `${prompt.trim()}${contexto ? `\n\nCONTEXTO:\n${contexto}` : ''}`
      const out = await aiChat(
        [
          { role: 'system', content: buildSystemPrompt(modo, section, role ?? undefined) },
          { role: 'user', content: contenido },
        ],
        { temperature: 0.5 },
      )
      setSalida(out.trim())
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo generar.', { intent: 'error' })
    } finally {
      setGenerando(false)
    }
  }

  const onPdf = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await extractPdfText(file)
      setContexto((c) => (c ? `${c}\n\n${text}` : text))
      toaster.dispatchToast('Documento añadido como contexto.', { intent: 'success' })
    } catch {
      toaster.dispatchToast('No se pudo leer el PDF.', { intent: 'error' })
    } finally {
      if (pdfRef.current) pdfRef.current.value = ''
    }
  }

  const copiar = async () => {
    try { await navigator.clipboard?.writeText(salida) } catch { /* sin portapapeles */ }
    toaster.dispatchToast('Texto copiado.', { intent: 'success' })
  }

  const descargarPdf = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Asistente IA</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:18mm;color:#111;font-size:11pt;line-height:1.5}h1{font-size:16pt}pre{white-space:pre-wrap;font-family:inherit}</style>
      </head><body><h1>Asistente IA · ${escapeHtml(section)}</h1><pre>${escapeHtml(salida)}</pre></body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <>
      <Button className={styles.fab} appearance="primary" size="large" icon={<SparkleRegular />} onClick={() => setOpen(true)} title="Asistente IA">
        Asistente IA
      </Button>

      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title="Asistente IA"
        subtitle={`Sección: ${section}${aiReady ? '' : ' · IA no configurada'}`}
        width={760}
        actions={
          <>
            <Button appearance="secondary" icon={<CloudArrowUpRegular />} onClick={() => pdfRef.current?.click()} disabled={generando}>Adjuntar PDF</Button>
            <Button appearance="secondary" onClick={() => { setPrompt(''); setContexto(''); setSalida('') }} disabled={generando}>Limpiar</Button>
            <Button appearance="primary" icon={generando ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generar()} disabled={generando || !aiReady}>
              {generando ? 'Generando…' : 'Generar'}
            </Button>
          </>
        }
      >
        <div>
          <TabList selectedValue={modo} onTabSelect={(_, d) => setModo(d.value as Modo)} style={{ marginBottom: '10px' }}>
            {MODOS.map((m) => <Tab key={m.value} value={m.value}>{m.label} con IA</Tab>)}
          </TabList>
          {hint && <div className={styles.hint}>{hint}</div>}
          <FormField label="¿Qué necesitas?" required>
            <Textarea value={prompt} onChange={(_, d) => setPrompt(d.value)} resize="vertical" rows={4} placeholder="Ej. Crea una evaluación de 10 preguntas sobre fracciones para 5to grado…" />
          </FormField>
          <FormField label="Contexto (opcional)" hint="Pega información o adjunta un PDF para dar contexto a la IA.">
            <Textarea value={contexto} onChange={(_, d) => setContexto(d.value)} resize="vertical" rows={3} />
          </FormField>
          <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void onPdf(e.target.files?.[0])} />

          {salida && (
            <>
              <FormField label="Resultado (editable)">
                <Textarea value={salida} onChange={(_, d) => setSalida(d.value)} resize="vertical" rows={12} />
              </FormField>
              <div className={styles.actions}>
                <Button size="small" icon={<CopyRegular />} onClick={() => void copiar()}>Copiar</Button>
                <Button size="small" icon={<DocumentPdfRegular />} onClick={descargarPdf}>Descargar PDF</Button>
              </div>
            </>
          )}
        </div>
      </ModalForm>
    </>
  )
}
