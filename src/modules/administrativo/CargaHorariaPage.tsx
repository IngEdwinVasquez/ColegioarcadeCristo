import { useEffect, useRef, useState } from 'react'
import { Button, Card, Spinner, Text, Textarea, useToastController, makeStyles } from '@fluentui/react-components'
import { ArrowUploadRegular, DeleteRegular, ArrowRightRegular, DocumentPdfRegular, PeopleTeamRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { FormField } from '../../components/shared/form'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl } from '../../services/onedrive'
import { renderPdfFirstPageToBlob, extractPdfText } from '../../services/pdf'
import { extraerCargaHoraria, construirPlan, aplicarPlan, type PlanCarga } from '../../services/cargaHorariaAssign'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import type { CargaHorariaRegistro, CargaResultado } from '../../types'

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
 * (Inicial, Primaria, Secundaria), crear el registro y asignar docentes/asignaturas.
 */
export function CargaHorariaPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, subjects, teachers, periods, refreshCatalogs } = useApp()
  const col = useCollection<CargaHorariaRegistro>(dataService.getCargaHoraria, dataService.saveCargaHoraria, dataService.deleteCargaHoraria)
  const [busy, setBusy] = useState<string | null>(null)
  const [notas, setNotas] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanCarga | null>(null)
  const [planNivel, setPlanNivel] = useState('')
  const [aplicando, setAplicando] = useState(false)

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
        resultado: undefined,
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

  /** Analiza el PDF del nivel y construye un plan de asignación (sin aplicar). */
  const procesar = async (nivel: string) => {
    const reg = registroDe(nivel)
    if (!reg?.archivoRef) { toaster.dispatchToast(`Sube primero el PDF del Nivel ${nivel}.`, { intent: 'error' }); return }
    setProcesando(nivel)
    try {
      const dataUrl = await downloadFileAsDataUrl(reg.archivoRef)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], reg.archivoNombre ?? `${nivel}.pdf`, { type: 'application/pdf' })
      const texto = await extractPdfText(file)
      const filas = await extraerCargaHoraria(texto, nivel)
      if (filas.length === 0) { toaster.dispatchToast('No se detectaron docentes en el PDF.', { intent: 'error' }); return }
      const nuevoPlan = construirPlan(nivel, filas, { grades, subjects, teachers, periods })
      setPlan(nuevoPlan)
      setPlanNivel(nivel)
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setProcesando(null)
    }
  }

  /** Aplica el plan: crea cursos/asignaturas y reasigna docentes. */
  const aplicar = async () => {
    if (!plan) return
    setAplicando(true)
    try {
      const r = await aplicarPlan(plan, { grades, subjects, teachers, periods })
      const resultado: CargaResultado = {
        aplicadoEn: new Date().toISOString(),
        docentesEmparejados: plan.docentes.filter((d) => d.docenteId).length,
        asignacionesCreadas: r.asignacionesCreadas,
        asignacionesEliminadas: r.asignacionesEliminadas,
        cursosCreados: r.cursosCreados,
        asignaturasCreadas: r.asignaturasCreadas,
        titularesAsignados: r.titularesAsignados,
        detalle: plan.docentes.map((d) => ({
          docente: d.nombreCarga,
          docenteNombre: d.docenteNombre,
          grado: d.gradoTexto,
          items: d.items.map((it) => ({ asignatura: it.asignatura, cursos: it.cursos })),
        })),
      }
      const reg = registroDe(plan.nivel)
      if (reg) await col.save({ ...reg, resultado, updatedAt: new Date().toISOString() })
      await Promise.all([refreshCatalogs(), col.refresh()])
      toaster.dispatchToast(
        `Carga horaria aplicada: ${r.cursosCreados} Curso/Aula nuevo(s), ${r.asignaturasCreadas} asignatura(s) nueva(s), ${r.asignacionesCreadas} asignación(es) creada(s), ${r.asignacionesEliminadas} retirada(s), ${r.titularesAsignados} titular(es) de aula.`,
        { intent: 'success' },
      )
      setPlan(null)
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Carga horaria"
        subtitle="Distribución de la carga horaria por nivel (Inicial, Primaria y Secundaria). Sube el PDF de cada nivel y asígnalo a los docentes y aulas correspondientes."
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
                    {reg && !reg.resultado && (
                      <Button
                        size="small"
                        appearance="primary"
                        icon={procesando === nivel ? <Spinner size="tiny" /> : <PeopleTeamRegular />}
                        disabled={procesando === nivel}
                        onClick={() => void procesar(nivel)}
                      >
                        {procesando === nivel ? 'Analizando…' : 'Asignar docentes y asignaturas'}
                      </Button>
                    )}
                    {reg && <Button size="small" appearance="subtle" icon={<DeleteRegular />} disabled={busy === nivel} onClick={() => void eliminar(nivel)}>Eliminar</Button>}
                  </div>

                  {reg?.resultado && (
                    <div style={{ borderTop: '1px solid var(--borde)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Text weight="semibold" size={300} block>Información generada</Text>
                      <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
                        Aplicado: {reg.resultado.aplicadoEn.slice(0, 10)} · {reg.resultado.docentesEmparejados} docente(s) · {reg.resultado.cursosCreados} Curso/Aula nuevo(s) · {reg.resultado.asignacionesCreadas} asignación(es) creada(s) · {reg.resultado.asignacionesEliminadas} retirada(s) · {reg.resultado.titularesAsignados} titular(es) de aula · {reg.resultado.asignaturasCreadas} asignatura(s) nueva(s)
                      </Text>
                      <Text size={200} block style={{ color: '#B45309' }}>Asignación aplicada. Para volver a procesar, reemplaza el PDF.</Text>
                      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        {reg.resultado.detalle.map((d, i) => (
                          <div key={i} style={{ marginBottom: '6px' }}>
                            <Text size={200} block><strong>{d.docenteNombre ?? d.docente}</strong>{d.grado ? ` — ${d.grado}` : ''}</Text>
                            {d.items.length === 0
                              ? <Text size={200} block style={{ color: 'var(--texto-suave)' }}>Docente de aula (sin asignaturas).</Text>
                              : d.items.map((it, j) => <Text key={j} size={200} block>• {it.asignatura}: {it.cursos.join(', ') || '—'}</Text>)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      <ModalForm
        open={!!plan}
        onOpenChange={(o) => { if (!o && !aplicando) setPlan(null) }}
        title={`Asignar docentes y asignaturas · Nivel ${planNivel}`}
        subtitle="Revisa el resultado antes de aplicarlo. Se crearán los cursos/asignaturas que falten en Aulas por curso y cada docente quedará con las asignaturas de la carga horaria."
        width={860}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlan(null)} disabled={aplicando}>Cancelar</Button>
            <Button appearance="primary" icon={aplicando ? <Spinner size="tiny" /> : <PeopleTeamRegular />} disabled={aplicando} onClick={() => void aplicar()}>
              {aplicando ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </>
        }
      >
        {plan && (
          <>
            <Text size={300} block>
              <strong>{plan.docentes.filter((d) => d.docenteId).length}</strong> docente(s) emparejado(s) ·{' '}
              <strong>{plan.cursosNuevos}</strong> Curso/Aula nuevo(s) ·{' '}
              <strong>{plan.totalAsignaciones}</strong> asignación(es) de asignatura ·{' '}
              <strong>{plan.totalTitulares}</strong> titular(es) de aula ·{' '}
              <strong>{plan.asignaturasNuevas.length}</strong> asignatura(s) nueva(s)
              {plan.asignaturasNuevas.length > 0 ? `: ${plan.asignaturasNuevas.join(', ')}` : ''}
            </Text>
            {plan.advertencias.length > 0 && (
              <div style={{ background: '#FFF4CE', border: '1px solid #B45309', borderRadius: '8px', padding: '10px 12px' }}>
                <Text weight="semibold" size={200} block>Advertencias</Text>
                {plan.advertencias.map((w, i) => <Text key={i} size={200} block>• {w}</Text>)}
              </div>
            )}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {plan.docentes.map((d, i) => (
                <div key={i} style={{ border: '1px solid var(--borde)', borderRadius: '10px', padding: '10px 12px' }}>
                  <Text weight="semibold" size={300} block>
                    {d.docenteNombre ?? d.nombreCarga}{d.docenteId ? '' : ' (no encontrado)'}{d.ambiguo ? ' · ambiguo' : ''}
                  </Text>
                  {!d.docenteId && <Text size={200} block style={{ color: '#B42318' }}>En la carga horaria: "{d.nombreCarga}" — no coincide con ningún docente.</Text>}
                  {d.items.map((it, j) => (
                    <Text key={j} size={200} block>• {it.asignatura}{it.nuevaAsignatura ? ' (nueva)' : ''}: {it.cursos.join(', ') || '—'}</Text>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </ModalForm>
    </div>
  )
}
