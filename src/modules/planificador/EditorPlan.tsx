import { useEffect, useRef, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Text, Textarea, makeStyles, tokens } from '@fluentui/react-components'
import { CopyRegular, DocumentPdfRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import type { PlanAlcance, PlanEstado, PlanificacionDinamica } from '../../types'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '14px' },
  momento: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  momentoHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: tokens.colorNeutralForeground2, fontSize: '12.5px' },
})

const arrToLines = (a: string[]) => a.join('\n')
const linesToArr = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

const ALCANCES: PlanAlcance[] = ['anual', 'mensual', 'semanal', 'actividad']
const ESTADOS: PlanEstado[] = ['borrador', 'activa', 'archivada']

interface Props {
  plan: PlanificacionDinamica | null
  onClose: () => void
  onSave: (plan: PlanificacionDinamica) => Promise<void> | void
  onShare: (plan: PlanificacionDinamica) => void
  onDownload: (plan: PlanificacionDinamica) => void
}

/** Editor de doble panel con autoguardado en segundo plano. */
export function EditorPlan({ plan, onClose, onSave, onShare, onDownload }: Props) {
  const styles = useStyles()
  const [draft, setDraft] = useState<PlanificacionDinamica | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedRef = useRef('')
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (!plan) {
      setDraft(null)
      return
    }
    const copy = structuredClone(plan)
    setDraft(copy)
    savedRef.current = JSON.stringify(copy)
    setStatus('idle')
  }, [plan])

  // Autoguardado (debounce 800 ms) cuando el texto cambia.
  useEffect(() => {
    if (!draft) return
    const json = JSON.stringify(draft)
    if (json === savedRef.current) return
    setStatus('saving')
    const t = setTimeout(() => {
      void Promise.resolve(onSaveRef.current({ ...draft, updatedAt: new Date().toISOString() }))
        .then(() => { savedRef.current = json; setStatus('saved') })
        .catch(() => setStatus('idle'))
    }, 800)
    return () => clearTimeout(t)
  }, [draft])

  const patch = (p: Partial<PlanificacionDinamica>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const setMomento = (i: number, p: Partial<PlanificacionDinamica['momentos'][number]>) =>
    setDraft((d) => (d ? { ...d, momentos: d.momentos.map((m, x) => (x === i ? { ...m, ...p } : m)) } : d))

  return (
    <ModalForm
      open={!!plan}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Editor de planificación"
      subtitle={draft ? `${draft.tema}` : undefined}
      width={980}
      actions={
        <>
          <span className={styles.status}>
            {status === 'saving' ? <><Spinner size="tiny" /> Guardando…</> : status === 'saved' ? <><CheckmarkCircleRegular /> Guardado</> : 'Autoguardado activo'}
          </span>
          <span style={{ flex: 1 }} />
          <Button appearance="secondary" icon={<CopyRegular />} onClick={() => draft && onShare(draft)}>Compartir</Button>
          <Button appearance="secondary" icon={<DocumentPdfRegular />} onClick={() => draft && onDownload(draft)}>Descargar PDF</Button>
          <Button appearance="primary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {draft && (
        <div>
          <FieldRow>
            <FormField label="Tema" required>
              <Input value={draft.tema} onChange={(_, d) => patch({ tema: d.value })} />
            </FormField>
            <FormField label="Objetivo">
              <Input value={draft.objetivo ?? ''} onChange={(_, d) => patch({ objetivo: d.value })} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField label="Alcance">
              <Select value={draft.alcance} onChange={(_, d) => patch({ alcance: d.value as PlanAlcance })}>
                {ALCANCES.map((a) => <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>)}
              </Select>
            </FormField>
            <FormField label="Estado">
              <Select value={draft.estado} onChange={(_, d) => patch({ estado: d.value as PlanEstado })}>
                {ESTADOS.map((e) => <option key={e} value={e}>{e[0].toUpperCase() + e.slice(1)}</option>)}
              </Select>
            </FormField>
          </FieldRow>

          <div className={styles.grid}>
            <FormField label="Competencias (una por línea)">
              <Textarea value={arrToLines(draft.competencias)} onChange={(_, d) => patch({ competencias: linesToArr(d.value) })} resize="vertical" rows={3} />
            </FormField>
            <FormField label="Indicadores de logro (uno por línea)">
              <Textarea value={arrToLines(draft.indicadores)} onChange={(_, d) => patch({ indicadores: linesToArr(d.value) })} resize="vertical" rows={3} />
            </FormField>
          </div>

          <Text weight="semibold" size={300} block style={{ margin: '6px 0' }}>Momentos de la clase</Text>
          <div className={styles.grid}>
            {draft.momentos.map((m, i) => (
              <Card key={m.momento} className={styles.momento}>
                <div className={styles.momentoHead}>
                  <Text weight="semibold">{m.momento[0].toUpperCase() + m.momento.slice(1)}</Text>
                  <Input size="small" style={{ maxWidth: '120px' }} value={m.duracion} onChange={(_, d) => setMomento(i, { duracion: d.value })} placeholder="15 min" />
                </div>
                <Textarea value={m.descripcion} onChange={(_, d) => setMomento(i, { descripcion: d.value })} resize="vertical" rows={2} placeholder="Qué hace el docente y qué hacen los estudiantes" />
                <Textarea value={arrToLines(m.actividades)} onChange={(_, d) => setMomento(i, { actividades: linesToArr(d.value) })} resize="vertical" rows={2} placeholder="Actividades (una por línea)" />
              </Card>
            ))}
          </div>

          <div className={styles.grid} style={{ marginTop: '12px' }}>
            <FormField label="Recursos (uno por línea)">
              <Textarea value={arrToLines(draft.recursos)} onChange={(_, d) => patch({ recursos: linesToArr(d.value) })} resize="vertical" rows={3} />
            </FormField>
            <FormField label="Herramientas tecnológicas (una por línea)">
              <Textarea value={arrToLines(draft.herramientasTec)} onChange={(_, d) => patch({ herramientasTec: linesToArr(d.value) })} resize="vertical" rows={3} />
            </FormField>
          </div>
          <FormField label="Evaluación">
            <Textarea value={draft.evaluacion ?? ''} onChange={(_, d) => patch({ evaluacion: d.value })} resize="vertical" rows={2} />
          </FormField>
        </div>
      )}
    </ModalForm>
  )
}
