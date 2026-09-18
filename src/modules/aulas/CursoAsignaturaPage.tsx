import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Textarea, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, ImageRegular, ArrowUploadRegular, SaveRegular, BookOpenRegular, SparkleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl } from '../../services/onedrive'
import { aiChat } from '../../services/ai'
import { createClassModule, addModuleFileResource } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { cursoNombre } from '../../utils/academic'
import type { CoursePage, CursoActividad, CursoEntrega, CursoLabel, CursoRecurso, CursoRecursoTipo, CursoUnidad, Enrollment, GradeRegister, GradeSection } from '../../types'

const RECURSO_TIPOS: Array<{ value: CursoRecursoTipo; label: string }> = [
  { value: 'texto', label: 'Texto / página' },
  { value: 'enlace', label: 'Enlace (sitio web)' },
  { value: 'documento', label: 'Documento' },
  { value: 'audio', label: 'Audio' },
  { value: 'imagen', label: 'Imagen' },
  { value: 'video', label: 'Video' },
]
const TIPOS_ARCHIVO: CursoRecursoTipo[] = ['documento', 'audio', 'imagen', 'video']

const fileCache = new Map<string, string>()
function RefImage({ fileRef, style, alt }: { fileRef?: string; style?: React.CSSProperties; alt?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!fileRef) { setSrc(''); return }
    const cached = fileCache.get(fileRef)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(fileRef).then((d) => { fileCache.set(fileRef, d); if (alive) setSrc(d) }).catch(() => { /* sin imagen */ })
    return () => { alive = false }
  }, [fileRef])
  if (!src) return <div style={{ ...style, background: 'linear-gradient(135deg,#0082AD,#0A1F2B)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpenRegular /></div>
  return <img src={src} alt={alt ?? ''} style={style} />
}

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  head: { width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', display: 'block' },
  label: { border: '1px solid var(--borde)', borderRadius: '10px', padding: '12px' },
  unit: { border: '1px solid var(--borde)', borderRadius: '12px', padding: '14px', marginBottom: '14px' },
})

/**
 * Aula virtual de una asignatura (estilo Moodle): encabezado, etiquetas, unidades de
 * aprendizaje con recursos y actividades, entregas con calificación y registro de calificaciones.
 */
export function CursoAsignaturaPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const params = useParams()
  const { user, gradeById, subjectById, students, students: allStudents, grades } = useApp()
  const pagesCol = useCollection<CoursePage>(dataService.getCoursePages, dataService.saveCoursePage, dataService.deleteCoursePage)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const registrosCol = useCollection<GradeRegister>(dataService.getGradeRegisters)
  const [planOpen, setPlanOpen] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [planDoc, setPlanDoc] = useState<{ url: string; modulo: string } | null>(null)
  const [creandoModulo, setCreandoModulo] = useState(false)
  const [planForm, setPlanForm] = useState({ titulo: '', tema: '', tiempo: '45 minutos', proposito: '', contenidos: '', indicadores: '', actividades: '', recursos: '', evaluacion: '' })

  const gradeId = params.gradeId ?? ''
  const section = decodeURIComponent(params.section ?? '')
  const subjectId = params.subjectId ?? ''
  const pageId = `${subjectId}|${gradeId}|${section}`

  const [draft, setDraft] = useState<CoursePage | null>(null)
  const [tab, setTab] = useState('curso')
  const [busy, setBusy] = useState(false)
  const [filtroEstudiante, setFiltroEstudiante] = useState('')
  const headerRef = useRef<HTMLInputElement>(null)
  const labelImgRef = useRef<HTMLInputElement>(null)
  const recursoFileRef = useRef<HTMLInputElement>(null)
  const entregaFileRef = useRef<HTMLInputElement>(null)
  const [nuevoLabel, setNuevoLabel] = useState<CursoLabel | null>(null)
  const [nuevoRecurso, setNuevoRecurso] = useState<{ unidadId: string; recurso: CursoRecurso } | null>(null)
  const [nuevaActividad, setNuevaActividad] = useState<{ unidadId: string; act: CursoActividad } | null>(null)
  const [entregaTarget, setEntregaTarget] = useState<{ unidadId: string; actividadId: string } | null>(null)
  const [entregaEstudiante, setEntregaEstudiante] = useState('')

  const grade = gradeById(gradeId)
  const subject = subjectById(subjectId)
  const gradeRec: GradeSection | undefined = grade

  // Crear/cargar la página del curso.
  useEffect(() => {
    if (pagesCol.loading) return
    const existing = pagesCol.items.find((p) => p.id === pageId)
    if (existing) { setDraft(existing); return }
    const nuevo: CoursePage = {
      id: pageId,
      gradeId,
      section,
      subjectId,
      curso: gradeRec ? cursoNombre(gradeRec) : `${section}`,
      labels: [],
      units: [],
      entregas: [],
      updatedAt: new Date().toISOString(),
    }
    setDraft(nuevo)
  }, [pagesCol.loading, pagesCol.items, pageId, gradeId, section, subjectId, gradeRec])

  const estudiantesCurso = useMemo(() => {
    const ids = new Set(enrollmentsCol.items.filter((e) => e.gradeId === gradeId).map((e) => e.studentId))
    const list = allStudents.filter((s) => s.gradeId === gradeId || ids.has(s.id))
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [allStudents, enrollmentsCol.items, gradeId])

  const editable = user?.roles.some((r) => ['docente', 'admin', 'tecnologia', 'coordinacion'].includes(r)) ?? false

  const guardar = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const next = { ...draft, updatedAt: new Date().toISOString() }
      await pagesCol.save(next)
      setDraft(next)
      toaster.dispatchToast('Aula virtual guardada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const subirHeader = async (file: File | undefined) => {
    if (!file || !draft) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Portadas', file.name, file)
      try { fileCache.set(ref.id, await downloadFileAsDataUrl(ref.id)) } catch { /* se resolverá al mostrar */ }
      setDraft({ ...draft, headerRef: ref.id })
      toaster.dispatchToast('Imagen de encabezado subida. Recuerda guardar.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
      if (headerRef.current) headerRef.current.value = ''
    }
  }

  const subirLabelImg = async (file: File | undefined) => {
    if (!file || !nuevoLabel) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Etiquetas', file.name, file)
      setNuevoLabel({ ...nuevoLabel, imageRef: ref.id })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (labelImgRef.current) labelImgRef.current.value = '' }
  }

  const subirRecurso = async (file: File | undefined) => {
    if (!file || !nuevoRecurso) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Recursos', file.name, file)
      setNuevoRecurso({ ...nuevoRecurso, recurso: { ...nuevoRecurso.recurso, ref: ref.id, nombre: file.name } })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (recursoFileRef.current) recursoFileRef.current.value = '' }
  }

  const subirEntrega = async (file: File | undefined) => {
    if (!file || !draft || !entregaTarget || !entregaEstudiante) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Entregas', file.name, file)
      const entrega: CursoEntrega = {
        id: genId('ent'),
        actividadId: entregaTarget.actividadId,
        studentId: entregaEstudiante,
        archivos: [{ name: file.name, url: ref.webUrl }],
        fecha: new Date().toISOString(),
      }
      setDraft({ ...draft, entregas: [...draft.entregas, entrega] })
      toaster.dispatchToast('Entrega registrada. Recuerda guardar.', { intent: 'success' })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (entregaFileRef.current) entregaFileRef.current.value = '' }
  }

  const addLabel = () => {
    if (!draft || !nuevoLabel?.texto.trim()) return
    setDraft({ ...draft, labels: [...draft.labels, { ...nuevoLabel, id: genId('lbl') }] })
    setNuevoLabel(null)
  }
  const addUnidad = () => {
    if (!draft) return
    const u: CursoUnidad = { id: genId('uni'), titulo: `Unidad ${draft.units.length + 1}`, recursos: [], actividades: [] }
    setDraft({ ...draft, units: [...draft.units, u] })
  }
  const setUnidad = (uid: string, patch: Partial<CursoUnidad>) => {
    if (!draft) return
    setDraft({ ...draft, units: draft.units.map((u) => (u.id === uid ? { ...u, ...patch } : u)) })
  }
  const delUnidad = (uid: string) => draft && setDraft({ ...draft, units: draft.units.filter((u) => u.id !== uid) })

  const addRecurso = () => {
    if (!draft || !nuevoRecurso) return
    const u = draft.units.find((x) => x.id === nuevoRecurso.unidadId)
    if (!u) return
    setUnidad(u.id, { recursos: [...u.recursos, { ...nuevoRecurso.recurso, id: genId('rec') }] })
    setNuevoRecurso(null)
  }
  const addActividad = () => {
    if (!draft || !nuevaActividad || !nuevaActividad.act.titulo.trim()) return
    const u = draft.units.find((x) => x.id === nuevaActividad.unidadId)
    if (!u) return
    setUnidad(u.id, { actividades: [...u.actividades, { ...nuevaActividad.act, id: genId('act') }] })
    setNuevaActividad(null)
  }

  const setEntregaCal = (id: string, patch: Partial<CursoEntrega>) => draft && setDraft({ ...draft, entregas: draft.entregas.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  const actividadesTodas = draft ? draft.units.flatMap((u) => u.actividades.map((a) => ({ ...a, unidad: u.titulo }))) : []
  const entregaDe = (actividadId: string, studentId: string) => draft?.entregas.find((e) => e.actividadId === actividadId && e.studentId === studentId)
  const estudiantesVista = filtroEstudiante ? estudiantesCurso.filter((s) => s.id === filtroEstudiante) : estudiantesCurso

  if (pagesCol.loading || !draft) return <Spinner label="Cargando aula virtual…" />

  const courseRecs = grades.filter((g) => cursoNombre(g) === draft.curso)
  const teamId = gradeById(gradeId)?.teamId

  /** Genera la planificación con IA (según el formulario, el registro de grado y el documento modelo) y crea el módulo en Teams. */
  const planificarConIA = async () => {
    if (!planForm.titulo.trim() || !planForm.tema.trim()) {
      toaster.dispatchToast('Indica el título y el tema de la clase.', { intent: 'error' })
      return
    }
    setPlanBusy(true)
    try {
      const template = (courseRecs[0]?.planTemplateText ?? '').slice(0, 12000)
      const registro = registrosCol.items.find((r) => r.curso === draft.curso)
      const registroInfo = registro ? `Centro: ${registro.centro?.nombre ?? ''} | Nivel: ${registro.nivel} | Curso: ${registro.curso} | Estudiantes: ${registro.estudiantes.length}` : ''
      const prompt = `Eres un docente de República Dominicana (MINERD). Redacta una PLANIFICACIÓN DE CLASE en HTML para la asignatura ${subject?.name ?? ''} del curso ${draft.curso}.
Datos del formulario:
- Título: ${planForm.titulo}
- Tema: ${planForm.tema}
- Tiempo: ${planForm.tiempo}
- Propósito: ${planForm.proposito}
- Contenidos: ${planForm.contenidos}
- Indicadores de logro: ${planForm.indicadores}
- Actividades/estrategias: ${planForm.actividades}
- Recursos: ${planForm.recursos}
- Evaluación: ${planForm.evaluacion}
Contexto del registro de grado: ${registroInfo}
Usa EXACTAMENTE la estructura, secciones y encabezados del siguiente documento modelo (respétala):
"""${template || 'Estructura estándar: Encabezado (centro, nivel, curso, asignatura, docente, fecha), Tema, Propósito, Contenidos, Indicadores de logro, Actividades (inicio, desarrollo, cierre), Recursos, Evaluación.'}"""
Basa el contenido en el tema del formulario. Devuelve ÚNICAMENTE el HTML completo del documento.`
      const html = await aiChat([
        { role: 'system', content: 'Asistente de planificación docente MINERD. Devuelve HTML.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.4, maxTokens: 3200 })
      const limpio = html.replace(/```html?/gi, '').replace(/```/g, '').trim()
      const blob = new Blob([limpio], { type: 'text/html' })
      const file = new File([blob], `${planForm.titulo.replace(/[^\w.-]+/g, '_')}.html`, { type: 'text/html' })
      const ref = await uploadAndShare('Planificaciones', file)
      let modulo = ''
      if (teamId) {
        try {
          const mod = await createClassModule(teamId, `${subject?.name ?? 'Asignatura'} · ${draft.curso}`, `${planForm.titulo} — ${planForm.tema}`)
          try { await addModuleFileResource(teamId, mod.id, ref.webUrl) } catch { /* recurso opcional */ }
          modulo = `Módulo creado en el aula de Teams: ${subject?.name ?? ''} · ${draft.curso}.`
        } catch (e) {
          modulo = `No se pudo crear el módulo en Teams: ${graphErrorMessage(e)}`
        }
      } else {
        modulo = 'La asignatura no tiene un aula de Teams relacionada.'
      }
      setPlanDoc({ url: ref.webUrl, modulo })
      toaster.dispatchToast('Planificación generada con IA.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setPlanBusy(false)
    }
  }

  /** Crea un módulo en el aula de Teams de la asignatura, nombrado con la asignatura y el curso. */
  const crearModuloAsignatura = async () => {
    if (!teamId) {
      toaster.dispatchToast('La asignatura no tiene un aula de Teams relacionada. Asígnala en Mis Aulas → asignatura.', { intent: 'error' })
      return
    }
    setCreandoModulo(true)
    try {
      const nombre = `${subject?.name ?? 'Asignatura'} · ${draft.curso}`
      const mod = await createClassModule(teamId, nombre, `Módulo de ${subject?.name ?? ''} para el curso ${draft.curso}.`)
      toaster.dispatchToast(`Módulo creado en Teams: ${mod.displayName || nombre}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setCreandoModulo(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={`${subject?.name ?? 'Asignatura'} · ${draft.curso}`}
        subtitle="Aula virtual de la asignatura: recursos, actividades, entregas y calificaciones."
        actions={editable ? (
          <>
            <Button appearance="secondary" icon={<SparkleRegular />} onClick={() => { setPlanDoc(null); setPlanOpen(true) }}>Crear planificación</Button>
            <Button appearance="secondary" icon={creandoModulo ? <Spinner size="tiny" /> : <AddRegular />} disabled={creandoModulo} onClick={() => void crearModuloAsignatura()}>{creandoModulo ? 'Creando…' : 'Crear módulo en Teams'}</Button>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <SaveRegular />} disabled={busy} onClick={() => void guardar()}>Guardar</Button>
          </>
        ) : undefined}
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '14px' }}>
        <Tab value="curso">Contenido del curso</Tab>
        <Tab value="calificaciones">Registro de calificaciones</Tab>
      </TabList>

      {tab === 'curso' && (
        <>
          <Card className={styles.card}>
            <div className={styles.actions}>
              <input ref={headerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subirHeader(e.target.files?.[0])} />
              {editable && <Button icon={<ImageRegular />} onClick={() => headerRef.current?.click()} disabled={busy}>Imagen de encabezado</Button>}
            </div>
            <RefImage fileRef={draft.headerRef} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px' }} alt={draft.curso} />
            <FormField label="Descripción del curso">
              <Textarea value={draft.descripcion ?? ''} disabled={!editable} resize="vertical" onChange={(_, d) => setDraft({ ...draft, descripcion: d.value })} />
            </FormField>
          </Card>

          {/* Etiquetas */}
          <Card className={styles.card}>
            <Text weight="semibold" size={400}>Etiquetas</Text>
            {draft.labels.map((l) => (
              <div key={l.id} className={styles.label}>
                {l.imageRef && <RefImage fileRef={l.imageRef} style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />}
                <Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{l.texto}</Text>
                {editable && <div className={styles.actions} style={{ marginTop: '6px' }}><Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, labels: draft.labels.filter((x) => x.id !== l.id) })}>Eliminar</Button></div>}
              </div>
            ))}
            {editable && (nuevoLabel ? (
              <FieldRow>
                <FormField label="Texto de la etiqueta"><Textarea value={nuevoLabel.texto} onChange={(_, d) => setNuevoLabel({ ...nuevoLabel, texto: d.value })} /></FormField>
                <FormField label="Imagen (opcional)">
                  <div className={styles.actions}>
                    <input ref={labelImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subirLabelImg(e.target.files?.[0])} />
                    <Button size="small" icon={<ImageRegular />} onClick={() => labelImgRef.current?.click()}>Subir imagen</Button>
                    {nuevoLabel.imageRef && <Text size={200}>Imagen cargada</Text>}
                    <Button size="small" appearance="primary" onClick={addLabel}>Agregar etiqueta</Button>
                    <Button size="small" appearance="secondary" onClick={() => setNuevoLabel(null)}>Cancelar</Button>
                  </div>
                </FormField>
              </FieldRow>
            ) : <Button icon={<AddRegular />} onClick={() => setNuevoLabel({ id: '', texto: '' })}>Agregar etiqueta</Button>)}
          </Card>

          {/* Unidades */}
          <div className={styles.actions} style={{ marginBottom: '10px' }}>
            {editable && <Button appearance="secondary" icon={<AddRegular />} onClick={addUnidad}>Agregar unidad de aprendizaje</Button>}
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>{draft.units.length} unidad(es)</Text>
          </div>

          {draft.units.map((u) => (
            <Card key={u.id} className={styles.card}>
              <FieldRow>
                <FormField label="Unidad"><Input value={u.titulo} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { titulo: d.value })} /></FormField>
                <FormField label="Desde"><Input type="date" value={u.desde ?? ''} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { desde: d.value })} /></FormField>
                <FormField label="Hasta"><Input type="date" value={u.hasta ?? ''} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { hasta: d.value })} /></FormField>
                {editable && <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => delUnidad(u.id)}>Eliminar unidad</Button>}
              </FieldRow>

              <Text weight="semibold" size={300}>Recursos ({u.recursos.length})</Text>
              {u.recursos.map((r) => (
                <div key={r.id} className={styles.label}>
                  <Text size={200} weight="semibold">{r.tipo.toUpperCase()} · {r.titulo}</Text>
                  {r.tipo === 'texto' && <Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{r.texto}</Text>}
                  {r.tipo === 'enlace' && r.url && <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a>}
                  {TIPOS_ARCHIVO.includes(r.tipo) && r.ref && <RefImage fileRef={r.tipo === 'imagen' ? r.ref : undefined} />}
                  {TIPOS_ARCHIVO.includes(r.tipo) && <Text size={200} block>{r.nombre ?? 'Archivo'}</Text>}
                  {editable && <div className={styles.actions} style={{ marginTop: '4px' }}><Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setUnidad(u.id, { recursos: u.recursos.filter((x) => x.id !== r.id) })}>Eliminar</Button></div>}
                </div>
              ))}
              {editable && (nuevoRecurso?.unidadId === u.id ? (
                <Card style={{ padding: '12px' }}>
                  <FieldRow>
                    <FormField label="Tipo">
                      <Select value={nuevoRecurso.recurso.tipo} onChange={(_, d) => setNuevoRecurso({ ...nuevoRecurso, recurso: { ...nuevoRecurso.recurso, tipo: d.value as CursoRecursoTipo } })}>
                        {RECURSO_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Título"><Input value={nuevoRecurso.recurso.titulo} onChange={(_, d) => setNuevoRecurso({ ...nuevoRecurso, recurso: { ...nuevoRecurso.recurso, titulo: d.value } })} /></FormField>
                  </FieldRow>
                  {nuevoRecurso.recurso.tipo === 'texto' && <FormField label="Texto"><Textarea value={nuevoRecurso.recurso.texto ?? ''} onChange={(_, d) => setNuevoRecurso({ ...nuevoRecurso, recurso: { ...nuevoRecurso.recurso, texto: d.value } })} /></FormField>}
                  {nuevoRecurso.recurso.tipo === 'enlace' && <FormField label="URL"><Input value={nuevoRecurso.recurso.url ?? ''} onChange={(_, d) => setNuevoRecurso({ ...nuevoRecurso, recurso: { ...nuevoRecurso.recurso, url: d.value } })} /></FormField>}
                  {TIPOS_ARCHIVO.includes(nuevoRecurso.recurso.tipo) && (
                    <FormField label="Archivo">
                      <div className={styles.actions}>
                        <input ref={recursoFileRef} type="file" style={{ display: 'none' }} onChange={(e) => void subirRecurso(e.target.files?.[0])} />
                        <Button size="small" icon={<ArrowUploadRegular />} onClick={() => recursoFileRef.current?.click()}>Subir archivo</Button>
                        {nuevoRecurso.recurso.nombre && <Text size={200}>{nuevoRecurso.recurso.nombre}</Text>}
                      </div>
                    </FormField>
                  )}
                  <div className={styles.actions}>
                    <Button appearance="primary" onClick={addRecurso}>Agregar recurso</Button>
                    <Button appearance="secondary" onClick={() => setNuevoRecurso(null)}>Cancelar</Button>
                  </div>
                </Card>
              ) : <Button icon={<AddRegular />} onClick={() => setNuevoRecurso({ unidadId: u.id, recurso: { id: '', tipo: 'texto', titulo: '' } })}>Agregar recurso</Button>)}

              <Text weight="semibold" size={300}>Actividades ({u.actividades.length})</Text>
              {u.actividades.map((a) => (
                <div key={a.id} className={styles.label}>
                  <Text weight="semibold" size={300}>{a.titulo}</Text>
                  {a.tema && <Text size={200} block><strong>Tema:</strong> {a.tema}</Text>}
                  {a.instrucciones && <Text size={200} block style={{ whiteSpace: 'pre-wrap' }}><strong>Instrucciones:</strong> {a.instrucciones}</Text>}
                  {a.hasta && <Text size={200} block><strong>Entrega hasta:</strong> {a.hasta}</Text>}
                  <div className={styles.actions} style={{ marginTop: '6px' }}>
                    {editable && <Button size="small" appearance="secondary" onClick={() => { setEntregaTarget({ unidadId: u.id, actividadId: a.id }); setEntregaEstudiante(estudiantesCurso[0]?.id ?? '') }}>Subir entrega</Button>}
                    {editable && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setUnidad(u.id, { actividades: u.actividades.filter((x) => x.id !== a.id) })}>Eliminar actividad</Button>}
                  </div>
                  {/* Entregas y calificación */}
                  {draft.entregas.filter((e) => e.actividadId === a.id).map((e) => (
                    <div key={e.id} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--borde)' }}>
                      <Text size={200} block><strong>{students.find((s) => s.id === e.studentId)?.fullName ?? e.studentId}</strong> · {e.archivos.map((f) => f.name).join(', ')}</Text>
                      <div className={styles.actions} style={{ marginTop: '4px' }}>
                        <Input placeholder="Calificación" value={e.calificacion ?? ''} disabled={!editable} onChange={(_, d) => setEntregaCal(e.id, { calificacion: d.value })} style={{ maxWidth: '120px' }} />
                        <Input placeholder="Comentario" value={e.comentario ?? ''} disabled={!editable} onChange={(_, d) => setEntregaCal(e.id, { comentario: d.value })} />
                        {editable && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, entregas: draft.entregas.filter((x) => x.id !== e.id) })}>Eliminar</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {editable && (nuevaActividad?.unidadId === u.id ? (
                <Card style={{ padding: '12px' }}>
                  <FormField label="Título de la actividad" required><Input value={nuevaActividad.act.titulo} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, titulo: d.value } })} /></FormField>
                  <FormField label="Tema de la actividad"><Input value={nuevaActividad.act.tema ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, tema: d.value } })} /></FormField>
                  <FormField label="Instrucciones de la actividad"><Textarea value={nuevaActividad.act.instrucciones ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, instrucciones: d.value } })} /></FormField>
                  <FieldRow>
                    <FormField label="Puntos"><Input value={String(nuevaActividad.act.puntos ?? '')} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, puntos: Number(d.value) || undefined } })} /></FormField>
                    <FormField label="Entrega hasta"><Input type="date" value={nuevaActividad.act.hasta ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, hasta: d.value } })} /></FormField>
                  </FieldRow>
                  <div className={styles.actions}>
                    <Button appearance="primary" onClick={addActividad}>Agregar actividad</Button>
                    <Button appearance="secondary" onClick={() => setNuevaActividad(null)}>Cancelar</Button>
                  </div>
                </Card>
              ) : <Button icon={<AddRegular />} onClick={() => setNuevaActividad({ unidadId: u.id, act: { id: '', titulo: '' } })}>Asignar actividad</Button>)}
            </Card>
          ))}

          <input ref={entregaFileRef} type="file" style={{ display: 'none' }} onChange={(e) => void subirEntrega(e.target.files?.[0])} />
        </>
      )}

      {tab === 'calificaciones' && (
        <Card className={styles.card}>
          <div className={styles.actions}>
            <Text weight="semibold" size={400}>Registro de calificaciones</Text>
            <Select value={filtroEstudiante} onChange={(_, d) => setFiltroEstudiante(d.value)} style={{ maxWidth: '320px' }}>
              <option value="">Todos los estudiantes</option>
              {estudiantesCurso.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </Select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  {actividadesTodas.map((a) => <TableHeaderCell key={a.id}>{a.titulo}</TableHeaderCell>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estudiantesVista.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Text weight="semibold">{s.fullName}</Text></TableCell>
                    {actividadesTodas.map((a) => {
                      const e = entregaDe(a.id, s.id)
                      return (
                        <TableCell key={a.id}>
                          <Input
                            style={{ width: '90px' }}
                            value={e?.calificacion ?? ''}
                            disabled={!editable || !e}
                            title={e ? 'Calificación' : 'Sin entrega'}
                            onChange={(_, d) => { if (e) setEntregaCal(e.id, { calificacion: d.value }) }}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Text size={200} style={{ color: 'var(--texto-suave)' }}>Las columnas son las actividades y cada fila un estudiante. La calificación se edita cuando el estudiante tiene una entrega registrada.</Text>
        </Card>
      )}

      <ModalForm
        open={planOpen}
        onOpenChange={(o) => { if (!o) setPlanOpen(false) }}
        title="Crear planificación de clase"
        subtitle="Completa las opciones y usa la IA (se basa en el tema, el registro de grado del curso y el documento modelo)."
        width={760}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlanOpen(false)} disabled={planBusy}>Cerrar</Button>
            <Button appearance="primary" icon={planBusy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={planBusy} onClick={() => void planificarConIA()}>
              {planBusy ? 'Generando…' : 'Planificar con IA'}
            </Button>
          </>
        }
      >
        <FormField label="Título de la clase" required><Input value={planForm.titulo} onChange={(_, d) => setPlanForm({ ...planForm, titulo: d.value })} /></FormField>
        <FieldRow>
          <FormField label="Tema" required><Input value={planForm.tema} onChange={(_, d) => setPlanForm({ ...planForm, tema: d.value })} /></FormField>
          <FormField label="Tiempo"><Input value={planForm.tiempo} onChange={(_, d) => setPlanForm({ ...planForm, tiempo: d.value })} /></FormField>
        </FieldRow>
        <FormField label="Propósito"><Textarea value={planForm.proposito} onChange={(_, d) => setPlanForm({ ...planForm, proposito: d.value })} /></FormField>
        <FormField label="Contenidos"><Textarea value={planForm.contenidos} onChange={(_, d) => setPlanForm({ ...planForm, contenidos: d.value })} /></FormField>
        <FormField label="Indicadores de logro"><Textarea value={planForm.indicadores} onChange={(_, d) => setPlanForm({ ...planForm, indicadores: d.value })} /></FormField>
        <FormField label="Actividades / estrategias"><Textarea value={planForm.actividades} onChange={(_, d) => setPlanForm({ ...planForm, actividades: d.value })} /></FormField>
        <FieldRow>
          <FormField label="Recursos"><Input value={planForm.recursos} onChange={(_, d) => setPlanForm({ ...planForm, recursos: d.value })} /></FormField>
          <FormField label="Evaluación"><Input value={planForm.evaluacion} onChange={(_, d) => setPlanForm({ ...planForm, evaluacion: d.value })} /></FormField>
        </FieldRow>
        {planDoc && (
          <Card style={{ padding: '12px' }}>
            <Text size={200} block><strong>Planificación generada:</strong> guardada en OneDrive.</Text>
            <Text size={200} block>{planDoc.modulo}</Text>
            <div className={styles.actions}>
              <Button size="small" appearance="secondary" as="a" href={planDoc.url} target="_blank" rel="noopener noreferrer">Abrir planificación</Button>
            </div>
          </Card>
        )}
      </ModalForm>
    </div>
  )
}
