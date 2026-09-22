import { useEffect, useRef, useState } from 'react'
import { Button, Card, Spinner, Text, Textarea, useToastController, makeStyles } from '@fluentui/react-components'
import { ArrowUploadRegular, DeleteRegular, ArrowRightRegular, DocumentPdfRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl } from '../../services/onedrive'
import { renderPdfFirstPageToBlob } from '../../services/pdf'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import type { CargaHorariaRegistro } from '../../types'

const NIVELES = ['Inicial', 'Primaria', 'Secundaria']

const portadaCache = new Map<string, string>()

function CargaImg({ fileRef, className }: { fileRef?: string; className?: string }) {
  const [src, setSrc] = useState(() => (fileRef ? portadaCache.get(fileRef) ?? '' : ''))
  useEffect(() => {
    if (!fileRef) { setSrc(''); return }
    const cached = portadaCache.get(fileRef)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(fileRef)
      .then((d) => { portadaCache.set(fileRef, d); if (alive) setSrc(d) })
      .catch(() => { /* sin portada */ })
    return () => { alive = false }
  }, [fileRef])
  if (!src) return <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocumentPdfRegular /></div>
  return <img src={src} alt="Portada de la distribución de la carga horaria" className={className} />
}

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '18px' },
  card: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  img: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
  placeholder: { width: '100%', height: '180px', background: 'linear-gradient(135deg,#0082AD,#0A1F2B)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
})

/**
 * Distribución de la carga horaria por nivel: permite subir el PDF de cada nivel
 * (Inicial, Primaria, Secundaria), creando un registro en la plataforma.
 */
export function CargaHorariaPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const col = useCollection<CargaHorariaRegistro>(dataService.getCargaHoraria, dataService.saveCargaHoraria, dataService.deleteCargaHoraria)
  const [busy, setBusy] = useState<string | null>(null)
  const [notas, setNotas] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<string | null>(null)

  const registroDe = (nivel: string) => col.items.find((r) => r.nivel === nivel)

  const elegirArchivo = (nivel: string) => {
    setTarget(nivel)
    setNotas(registroDe(nivel)?.notas ?? '')
    fileRef.current?.click()
  }

  const subir = async (file: File | undefined) => {
    if (!file || !target) return
    if (file.type !== 'application/pdf') {
      toaster.dispatchToast('El archivo debe ser un PDF.', { intent: 'error' })
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const nivel = target
    setBusy(nivel)
    try {
      const ref = await uploadAndShare('Carga horaria', file)
      let portadaRef: string | undefined
      try {
        const blob = await renderPdfFirstPageToBlob(file, 600)
        if (blob) portadaRef = (await uploadFile('Carga horaria/Portadas', `${nivel}.jpg`, blob)).id
      } catch { /* sin portada */ }
      const prev = registroDe(nivel)
      const ahora = new Date().toISOString()
      const reg: CargaHorariaRegistro = {
        id: prev?.id ?? genId('ch'),
        nivel,
        titulo: `Distribución de la carga horaria · Nivel ${nivel}`,
        archivoNombre: file.name,
        archivoRef: ref.id,
        archivoUrl: ref.webUrl,
        portadaRef: portadaRef ?? prev?.portadaRef,
        notas: notas.trim() || undefined,
        createdAt: prev?.createdAt ?? ahora,
        updatedAt: ahora,
      }
      await col.save(reg)
      toaster.dispatchToast(`PDF del Nivel ${nivel} ${prev ? 'actualizado' : 'registrado'} en la plataforma.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const eliminar = async (nivel: string) => {
    const reg = registroDe(nivel)
    if (!reg) return
    setBusy(nivel)
    try {
      await col.remove(reg.id)
      toaster.dispatchToast(`Registro del Nivel ${nivel} eliminado.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Carga horaria"
        subtitle="Distribución de la carga horaria por nivel (Inicial, Primaria y Secundaria). Sube el PDF de cada nivel para registrarlo en la plataforma."
      />

      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void subir(e.target.files?.[0])} />

      {col.loading ? <Spinner label="Cargando…" /> : (
        <div className={styles.grid}>
          {NIVELES.map((nivel) => {
            const reg = registroDe(nivel)
            return (
              <Card key={nivel} className={styles.card}>
                {reg?.portadaRef
                  ? <CargaImg fileRef={reg.portadaRef} className={styles.img} />
                  : <div className={styles.placeholder}><DocumentPdfRegular /></div>}
                <div className={styles.body}>
                  <Text weight="semibold" size={400}>Nivel {nivel}</Text>
                  {reg ? (
                    <>
                      <Text size={200} style={{ color: 'var(--texto-suave)' }}>{reg.archivoNombre}</Text>
                      <Text size={200} style={{ color: 'var(--texto-suave)' }}>Actualizado: {reg.updatedAt.slice(0, 10)}</Text>
                      {reg.notas && <Text size={200}>Notas: {reg.notas}</Text>}
                    </>
                  ) : (
                    <Text size={200} style={{ color: 'var(--texto-suave)' }}>Aún no hay PDF registrado para este nivel.</Text>
                  )}
                  <div className={styles.actions}>
                    <Button
                      appearance={reg ? 'secondary' : 'primary'}
                      icon={busy === nivel ? <Spinner size="tiny" /> : <ArrowUploadRegular />}
                      disabled={busy === nivel}
                      onClick={() => elegirArchivo(nivel)}
                    >
                      {busy === nivel ? 'Subiendo…' : reg ? 'Reemplazar PDF' : 'Subir PDF'}
                    </Button>
                    {reg?.archivoUrl && (
                      <Button size="small" appearance="secondary" icon={<ArrowRightRegular />} as="a" href={reg.archivoUrl} target="_blank" rel="noopener noreferrer">Ver / Descargar</Button>
                    )}
                    {reg && <Button size="small" appearance="subtle" icon={<DeleteRegular />} disabled={busy === nivel} onClick={() => void eliminar(nivel)}>Eliminar</Button>}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {target && (
        <Card style={{ marginTop: '16px', padding: '16px' }}>
          <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Nota para el Nivel {target} (opcional)</Text>
          <FormField label="Notas">
            <Textarea value={notas} resize="vertical" onChange={(_, d) => setNotas(d.value)} placeholder="Observaciones sobre la carga horaria de este nivel…" />
          </FormField>
          <Text size={200} style={{ color: 'var(--texto-suave)' }}>Se guardará junto al registro cuando subas el PDF.</Text>
        </Card>
      )}
    </div>
  )
}
