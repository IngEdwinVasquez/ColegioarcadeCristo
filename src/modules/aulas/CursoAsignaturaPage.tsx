import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Textarea, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, ImageRegular, ArrowUploadRegular, SaveRegular, BookOpenRegular, SparkleRegular, ArrowDownloadRegular, ArrowRightRegular, EditRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl, getFileDownloadUrl, listFilesInFolder } from '../../services/onedrive'
import { htmlToPdfBlob, downloadPlanPdf } from '../../services/planPdf'
import { aiChat } from '../../services/ai'
import { createClassModule, addModuleFileResource } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { cursoNombre, asignaturaDe } from '../../utils/academic'
import type { CoursePage, CursoActividad, CursoEntrega, CursoLabel, CursoRecurso, CursoRecursoTipo, CursoUnidad, Enrollment, GradeRegister, GradeSection, SubjectPlan } from '../../types'

const RECURSO_TIPOS: Array<{ value: CursoRecursoTipo; label: string }> = [
  { value: 'texto', label: 'Texto / página' },
  { value: 'enlace', label: 'Enlace (sitio web)' },
  { value: 'documento', label: 'Documento' },
  { value: 'audio', label: 'Audio' },
  { value: 'imagen', label: 'Imagen' },
  { value: 'video', label: 'Video' },
]
const TIPOS_ARCHIVO: CursoRecursoTipo[] = ['documento', 'audio', 'imagen', 'video']

/** Busca el archivo de una planificación antigua por su nombre en la carpeta. */
async function resolverRefPlan(titulo: string): Promise<string | null> {
  try {
    const base = titulo.replace(/[^\w.-]+/g, '_').toLowerCase()
    const files = await listFilesInFolder('Planificaciones')
    const f = files.find((x) => x.name.toLowerCase() === `${base}.html`) ?? files.find((x) => x.name.toLowerCase().replace(/\.[^.]+$/, '') === base)
    return f?.id ?? null
  } catch {
    return null
  }
}

const fileCache = new Map<string, string>()
function RefImage({ fileRef, style, className, alt }: { fileRef?: string; style?: React.CSSProperties; className?: string; alt?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!fileRef) { setSrc(''); return }
    const cached = fileCache.get(fileRef)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(fileRef).then((d) => { fileCache.set(fileRef, d); if (alive) setSrc(d) }).catch(() => { /* sin imagen */ })
    return () => { alive = false }
  }, [fileRef])
  if (!src) return <div className={className} style={{ ...style, background: 'linear-gradient(135deg,#0082AD,#0A1F2B)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpenRegular /></div>
  return <img className={className} src={src} alt={alt ?? ''} style={style} />
}

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  head: { width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', display: 'block' },
  label: { border: '1px solid var(--borde)', borderRadius: '10px', padding: '12px' },
  unit: { border: '1px solid var(--borde)', borderRadius: '12px', padding: '14px', marginBottom: '14px' },
  unitImgWrap: { position: 'relative', borderRadius: '12px', overflow: 'hidden' },
  unitImg: { width: '100%', height: '170px', objectFit: 'cover', display: 'block' },
  imgBtn: { position: 'absolute', top: '8px', right: '8px' },
  actThumb: { width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '10px', display: 'block', marginTop: '6px' },
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
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade)
  const [planOpen, setPlanOpen] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [planDoc, setPlanDoc] = useState<{ url: string; modulo: string } | null>(null)
  const [planEditId, setPlanEditId] = useState<string | null>(null)
  const [planEditUrl, setPlanEditUrl] = useState<string | null>(null)
  const [planEditing, setPlanEditing] = useState(false)
  const [planPreview, setPlanPreview] = useState('')
  const [planPreviewUrl, setPlanPreviewUrl] = useState('')
  const [creandoModulo, setCreandoModulo] = useState(false)
  const [planesUnidad, setPlanesUnidad] = useState<Record<string, string>>({})
  const [planUnidadId, setPlanUnidadId] = useState<string | null>(null)
  const [datosUnidad, setDatosUnidad] = useState<{ unidadId: string; tema: string; descripcion: string } | null>(null)
  const [unidadBusy, setUnidadBusy] = useState(false)
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
  const guiaActFileRef = useRef<HTMLInputElement>(null)
  const unidadImgRef = useRef<HTMLInputElement>(null)
  const actImgRef = useRef<HTMLInputElement>(null)
  const [unidadImgTarget, setUnidadImgTarget] = useState<string | null>(null)
  const studentFileRef = useRef<HTMLInputElement>(null)
  const [studentActividad, setStudentActividad] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const savedRef = useRef('')
  const [nuevoLabel, setNuevoLabel] = useState<CursoLabel | null>(null)
  const [nuevoRecurso, setNuevoRecurso] = useState<{ unidadId: string; recurso: CursoRecurso } | null>(null)
  const [nuevaActividad, setNuevaActividad] = useState<{ unidadId: string; act: CursoActividad } | null>(null)
  const [entregaTarget, setEntregaTarget] = useState<{ unidadId: string; actividadId: string } | null>(null)
  const [entregaEstudiante, setEntregaEstudiante] = useState('')

  const grade = gradeById(gradeId)
  const subject = subjectById(subjectId)
  const gradeRec: GradeSection | undefined = grade
  const allGrades = gradesCol.items.length ? gradesCol.items : grades
  const subjectRecord = allGrades.find((g) => g.id === gradeId) ?? gradeRec
  const planesClase = subjectRecord?.classPlans ?? []

  // Crear/cargar la página del curso (solo una vez).
  useEffect(() => {
    if (pagesCol.loading || loadedRef.current) return
    loadedRef.current = true
    const existing = pagesCol.items.find((p) => p.id === pageId)
    if (existing) { setDraft(existing); savedRef.current = JSON.stringify({ ...existing, updatedAt: '' }); return }
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
    savedRef.current = JSON.stringify({ ...nuevo, updatedAt: '' })
    setDraft(nuevo)
    void pagesCol.save(nuevo)
  }, [pagesCol.loading, pagesCol.items, pageId, gradeId, section, subjectId, gradeRec])

  const estudiantesCurso = useMemo(() => {
    const ids = new Set(enrollmentsCol.items.filter((e) => e.gradeId === gradeId).map((e) => e.studentId))
    const list = allStudents.filter((s) => s.gradeId === gradeId || ids.has(s.id))
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [allStudents, enrollmentsCol.items, gradeId])

  const editable = user?.roles.some((r) => ['docente', 'admin', 'tecnologia', 'coordinacion'].includes(r)) ?? false
  const studentId = user?.studentId ?? ''
  const isStudent = !!studentId && !editable

  // Autoguardado: persiste los cambios (recursos, actividades, etiquetas, etc.) poco después de editarlos.
  useEffect(() => {
    if (!draft || !editable || !loadedRef.current) return
    const key = JSON.stringify({ ...draft, updatedAt: '' })
    if (key === savedRef.current) return
    const t = setTimeout(() => {
      savedRef.current = key
      void pagesCol.save({ ...draft, updatedAt: new Date().toISOString() })
    }, 1200)
    return () => clearTimeout(t)
  }, [draft, editable, pagesCol])

  const guardar = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const next = { ...draft, updatedAt: new Date().toISOString() }
      await pagesCol.save(next)
      savedRef.current = JSON.stringify({ ...next, updatedAt: '' })
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

  /** Sube la imagen del tema de una unidad de aprendizaje. */
  const subirImagenUnidad = async (file: File | undefined) => {
    if (!file || !unidadImgTarget) return
    const uid = unidadImgTarget
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Unidades', file.name, file)
      fileCache.set(ref.id, await downloadFileAsDataUrl(ref.id).catch(() => ''))
      setUnidad(uid, { imageRef: ref.id })
      toaster.dispatchToast('Imagen de la unidad subida. Recuerda guardar.', { intent: 'success' })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (unidadImgRef.current) unidadImgRef.current.value = ''; setUnidadImgTarget(null) }
  }

  /** Sube la imagen relacionada con la actividad que se está creando/editando. */
  const subirImagenActividad = async (file: File | undefined) => {
    if (!file || !nuevaActividad) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Actividades', file.name, file)
      fileCache.set(ref.id, await downloadFileAsDataUrl(ref.id).catch(() => ''))
      setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, imageRef: ref.id } })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (actImgRef.current) actImgRef.current.value = '' }
  }

  /** Sube el documento guía de la actividad que se está creando/editando. */
  const subirGuia = async (file: File | undefined) => {
    if (!file || !nuevaActividad) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Guias', file.name, file)
      setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, guiaRef: ref.id, guiaNombre: file.name } })
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (guiaActFileRef.current) guiaActFileRef.current.value = '' }
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
      setEntregaTarget(null)
    } catch (e) { toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' }) } finally { setBusy(false); if (entregaFileRef.current) entregaFileRef.current.value = '' }
  }

  /** El estudiante entrega su propia actividad (se asigna automáticamente a su cuenta). */
  const subirEntregaEstudiante = async (file: File | undefined, actividadId: string) => {
    if (!file || !draft || !studentId) return
    setBusy(true)
    try {
      const ref = await uploadFile('AulasVirtuales/Entregas', file.name, file)
      const entrega: CursoEntrega = {
        id: genId('ent'),
        actividadId,
        studentId,
        archivos: [{ name: file.name, url: ref.webUrl }],
        fecha: new Date().toISOString(),
      }
      const next = { ...draft, entregas: [...draft.entregas, entrega] }
      setDraft(next)
      savedRef.current = JSON.stringify({ ...next, updatedAt: '' })
      await pagesCol.save(next)
      toaster.dispatchToast('Actividad entregada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
      if (studentFileRef.current) studentFileRef.current.value = ''
    }
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
    const existe = u.recursos.some((r) => r.id === nuevoRecurso.recurso.id)
    const recursos = existe
      ? u.recursos.map((r) => (r.id === nuevoRecurso.recurso.id ? nuevoRecurso.recurso : r))
      : [...u.recursos, { ...nuevoRecurso.recurso, id: genId('rec') }]
    setUnidad(u.id, { recursos })
    setNuevoRecurso(null)
  }

  /** Abre un recurso: enlace en el navegador, o archivo desde OneDrive. */
  const abrirRecurso = async (r: CursoRecurso) => {
    try {
      if (r.tipo === 'enlace' && r.url) {
        const bad = /ejemplo|example\.|dominio/i.test(r.url)
        window.open(bad ? `https://www.google.com/search?q=${encodeURIComponent(r.titulo || '')}` : r.url, '_blank')
        return
      }
      if (r.ref) { const url = await getFileDownloadUrl(r.ref); window.open(url, '_blank'); return }
      if (r.url) { window.open(r.url, '_blank'); return }
      const q = encodeURIComponent(r.titulo || 'recurso')
      window.open(r.tipo === 'video' ? `https://www.youtube.com/results?search_query=${q}` : `https://www.google.com/search?q=${q}`, '_blank')
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    }
  }
  /** Abre el documento guía de una actividad. */
  const abrirGuia = async (ref: string) => {
    try { const url = await getFileDownloadUrl(ref); window.open(url, '_blank') }
    catch (error) { toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' }) }
  }

  const addActividad = () => {
    if (!draft || !nuevaActividad || !nuevaActividad.act.titulo.trim()) return
    const u = draft.units.find((x) => x.id === nuevaActividad.unidadId)
    if (!u) return
    const act = nuevaActividad.act
    const existe = u.actividades.some((x) => x.id === act.id)
    const actividades = existe
      ? u.actividades.map((x) => (x.id === act.id ? act : x))
      : [...u.actividades, { ...act, id: genId('act') }]
    setUnidad(u.id, { actividades })
    setNuevaActividad(null)
  }

  const setEntregaCal = (id: string, patch: Partial<CursoEntrega>) => draft && setDraft({ ...draft, entregas: draft.entregas.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  const actividadesTodas = draft ? draft.units.flatMap((u) => u.actividades.map((a) => ({ ...a, unidad: u.titulo }))) : []
  const entregaDe = (actividadId: string, studentId: string) => draft?.entregas.find((e) => e.actividadId === actividadId && e.studentId === studentId)
  const estudiantesVista = filtroEstudiante ? estudiantesCurso.filter((s) => s.id === filtroEstudiante) : estudiantesCurso

  if (pagesCol.loading || !draft) return <Spinner label="Cargando aula virtual…" />

  const courseRecs = grades.filter((g) => cursoNombre(g) === draft.curso)
  const subjectName = subject?.name ?? (gradeRec ? asignaturaDe(gradeRec) : 'Asignatura')
  const teamId = gradeById(gradeId)?.teamId

  /** Abre el formulario de planificación, precargando la planificación existente si la hay. */
  const abrirPlanClase = () => {
    const existente = planesClase[0]
    const legacy = !!existente?.url && /\.html?(\?|$)/i.test(existente.url) && !existente.html
    setPlanDoc(null)
    setPlanEditId(existente?.id ?? null)
    setPlanEditUrl(legacy ? null : (existente?.url ?? null))
    setPlanEditing(!!existente)
    setPlanPreview(existente?.html ?? '')
    setPlanPreviewUrl('')
    if (existente) setPlanForm((f) => ({ ...f, titulo: existente.titulo, tema: existente.tema ?? f.tema }))
    if (legacy && existente?.ref) void migrarPlanLegacy(existente)
    else if (!existente?.html && existente?.ref) downloadFileAsDataUrl(existente.ref).then(setPlanPreviewUrl).catch(() => { /* sin vista previa */ })
    setPlanOpen(true)
  }

  /** Convierte una planificación antigua (HTML) a PDF y actualiza el registro. */
  const migrarPlanLegacy = async (p: SubjectPlan) => {
    setPlanBusy(true)
    try {
      const refId = p.ref ?? await resolverRefPlan(p.titulo)
      if (!refId) { toaster.dispatchToast('No se encontró el archivo anterior. Pulsa Regenerar con IA.', { intent: 'error' }); return }
      const dataUrl = await downloadFileAsDataUrl(refId)
      const text = await (await fetch(dataUrl)).text()
      if (!text.trim().startsWith('<')) return
      const file = new File([await htmlToPdfBlob(text, p.titulo)], `${p.titulo.replace(/[^\w.-]+/g, '_')}.pdf`, { type: 'application/pdf' })
      const ref2 = await uploadAndShare('Planificaciones', file)
      if (subjectRecord) {
        const plans = (subjectRecord.classPlans ?? []).map((x) => (x.id === p.id ? { ...x, url: ref2.webUrl, ref: ref2.id, html: text } : x))
        await dataService.saveGrade({ ...subjectRecord, classPlans: plans })
        await gradesCol.refresh()
      }
      setPlanPreview(text)
      setPlanEditUrl(ref2.webUrl)
      setPlanDoc({ url: ref2.webUrl, modulo: 'Planificación actualizada al nuevo formato (PDF).' })
    } catch {
      toaster.dispatchToast('No se pudo convertir la planificación anterior. Pulsa Regenerar con IA.', { intent: 'error' })
    } finally {
      setPlanBusy(false)
    }
  }

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
      const file = new File([await htmlToPdfBlob(limpio, planForm.titulo)], `${planForm.titulo.replace(/[^\w.-]+/g, '_')}.pdf`, { type: 'application/pdf' })
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
      const planRec: SubjectPlan = {
        id: planEditId ?? genId('plan'),
        titulo: planForm.titulo,
        tema: planForm.tema,
        url: ref.webUrl,
        ref: ref.id,
        html: limpio,
        source: 'ia',
        fecha: new Date().toISOString(),
      }
      if (subjectRecord) {
        const previos = subjectRecord.classPlans ?? []
        await dataService.saveGrade({ ...subjectRecord, classPlans: [planRec, ...previos.filter((p) => p.id !== planRec.id)] })
        await gradesCol.refresh()
      }
      setPlanEditId(planRec.id)
      setPlanEditUrl(ref.webUrl)
      setPlanEditing(true)
      setPlanPreview(limpio)
      setPlanPreviewUrl('')
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

  /** Valida los datos necesarios (tema, descripción, registro de grado y modelo). */
  const requisitosUnidad = (u: CursoUnidad): string[] => {
    const faltan: string[] = []
    if (!u.tema?.trim()) faltan.push('el tema de la unidad')
    if (!draft?.descripcion?.trim()) faltan.push('la descripción del curso')
    if (!registrosCol.items.some((r) => r.curso === draft?.curso)) faltan.push('el registro de grado del curso')
    if (!courseRecs.some((g) => g.planTemplateName)) faltan.push('el documento modelo de planificación del curso')
    return faltan
  }

  /** Abre el formulario para completar los datos necesarios antes de generar la planificación. */
  const abrirPlanUnidad = (u: CursoUnidad) => {
    if (!draft) return
    setDatosUnidad({ unidadId: u.id, tema: u.tema ?? '', descripcion: draft.descripcion ?? '' })
  }

  /** Genera la planificación de la unidad (Inicio, Desarrollo con recursos/evaluación/reflexión, Cierre). */
  const generarPlanificacion = async (u: CursoUnidad, tema: string, descripcion: string) => {
    if (!draft) return
    setUnidadBusy(true)
    try {
      const reg = registrosCol.items.find((r) => r.curso === draft.curso)
      const modelo = courseRecs.find((g) => g.planTemplateName)
      const template = (modelo?.planTemplateText ?? '').slice(0, 12000)
      const regInfo = `Centro: ${reg?.centro?.nombre ?? ''} | Nivel: ${reg?.nivel} | Curso: ${reg?.curso} | Estudiantes: ${reg?.estudiantes.length}`
      const esp = reg?.especificaciones?.[subjectName]
      const areas = esp ? [esp.p1, esp.p2, esp.p3, esp.p4].filter(Boolean).join(' | ') : ''
      const areasInfo = `Áreas/especificaciones de ${subjectName} en el registro de grado: ${areas || '(sin registrar)'}`
      const prompt = `Eres un docente de República Dominicana (MINERD). Redacta la PLANIFICACIÓN DE LA UNIDAD DE APRENDIZAJE en HTML.
- Unidad: ${u.titulo}
- Tema de la unidad: ${tema}
- Curso: ${draft.curso}
- Asignatura: ${subjectName}
- Descripción del curso: ${descripcion}
- Registro de grado: ${regInfo}
- ${areasInfo}
Usa la información de la asignatura ${subjectName} del registro de grado como referencia.
Estructura obligatoria con estos encabezados: <h2>Inicio</h2>, <h2>Desarrollo</h2> y <h2>Cierre</h2>. Dentro de Desarrollo incluye obligatoriamente las subsecciones <h3>Recursos</h3>, <h3>Evaluación</h3> y <h3>Reflexión</h3>.
Usa como modelo la estructura del siguiente documento:
"""${template}"""
Basa el contenido en el tema de la unidad. Devuelve ÚNICAMENTE el HTML del documento.`
      const html = (await aiChat([
        { role: 'system', content: 'Asistente de planificación docente MINERD. Devuelve HTML.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.4, maxTokens: 3200 })).replace(/```html?/gi, '').replace(/```/g, '').trim()
      if (!html) throw new Error('La IA no devolvió contenido. Revisa la configuración de IA.')
      setPlanesUnidad((p) => ({ ...p, [u.id]: html }))
      setPlanUnidadId(u.id)
      toaster.dispatchToast('Planificación de la unidad generada.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setUnidadBusy(false)
    }
  }

  /** Descarga/Imprime como PDF el HTML generado. */
  const descargarPdf = (html: string, titulo: string) => {
    const win = window.open('', '_blank')
    if (!win) { toaster.dispatchToast('Permite las ventanas emergentes para descargar el PDF.', { intent: 'error' }); return }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title><style>body{font-family:Segoe UI,Arial,sans-serif;padding:28px;color:#161616;line-height:1.5} h1,h2,h3{color:#0A1F2B} h2{margin-top:22px;border-bottom:1px solid #ccc} h3{margin-top:14px}</style></head><body>${html}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  /** Crea con IA la unidad completa: introducción, recursos variados y al menos una actividad. */
  const crearUnidadIA = async (u: CursoUnidad) => {
    if (!draft) return
    const faltan = requisitosUnidad(u)
    if (faltan.length) { toaster.dispatchToast(`Antes de crear la unidad, completa: ${faltan.join(', ')}.`, { intent: 'error' }); return }
    setUnidadBusy(true)
    try {
      const reg = registrosCol.items.find((r) => r.curso === draft.curso)
      const prompt = `Genera en JSON la estructura de la unidad de aprendizaje "${u.titulo}" (tema: ${u.tema}) para el curso ${draft.curso} (${draft.descripcion}). Nivel/contexto: ${reg?.nivel ?? ''}.
Devuelve EXACTAMENTE este JSON:
{"introduccion":"texto de introducción a la unidad","recursos":[{"tipo":"texto|enlace|documento|audio|imagen|video","titulo":"...","texto":"...","url":"..."}],"actividades":[{"titulo":"...","tema":"...","instrucciones":"..."}]}
Incluye una introducción, al menos 3 recursos variando el tipo según la necesidad de aprendizaje, y al menos 1 actividad. NO inventes dominios ni enlaces ficticios; para los recursos de tipo "enlace" usa una búsqueda real, por ejemplo "https://www.google.com/search?q=<consulta>" o "https://www.youtube.com/results?search_query=<consulta>". Responde SOLO el JSON.`
      const res = await aiChat([
        { role: 'system', content: 'Asistente educativo MINERD. Responde solo JSON válido.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.5, jsonMode: true, maxTokens: 3000 })
      const json = res.match(/\{[\s\S]*\}/)?.[0] ?? res
      const parsed = JSON.parse(json) as { introduccion?: string; recursos?: Array<Partial<CursoRecurso>>; actividades?: Array<Partial<CursoActividad>> }
      const recursos: CursoRecurso[] = (parsed.recursos ?? []).map((r) => {
        const tipo = (r.tipo as CursoRecursoTipo) ?? 'texto'
        let url = r.url
        if (tipo !== 'texto' && (!url || /ejemplo|example\.|dominio|\.edu\//i.test(url))) {
          const q = encodeURIComponent(`${r.titulo ?? ''} ${u.tema ?? ''}`.trim())
          url = tipo === 'video' ? `https://www.youtube.com/results?search_query=${q}` : `https://www.google.com/search?q=${q}`
        }
        return { id: genId('rec'), tipo, titulo: r.titulo ?? 'Recurso', texto: r.texto, url }
      })
      const actividades: CursoActividad[] = (parsed.actividades ?? []).map((a) => ({ id: genId('act'), titulo: a.titulo ?? 'Actividad', tema: a.tema, instrucciones: a.instrucciones }))
      setUnidad(u.id, { introduccion: parsed.introduccion ?? u.introduccion, recursos, actividades, aiCreated: true })
      toaster.dispatchToast('Unidad creada con IA. Puedes editar recursos y actividades.', { intent: 'success' })
      setPlanUnidadId(null)
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setUnidadBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={subjectName}
        subtitle={`Aula virtual · ${draft.curso} · recursos, actividades, entregas y calificaciones.`}
        actions={editable ? (
          <>
            <Button appearance="secondary" icon={<SparkleRegular />} onClick={abrirPlanClase}>{planesClase.length ? 'Editar planificación' : 'Crear planificación'}</Button>
            <Button appearance="secondary" icon={creandoModulo ? <Spinner size="tiny" /> : <AddRegular />} disabled={creandoModulo} onClick={() => void crearModuloAsignatura()}>{creandoModulo ? 'Creando…' : 'Crear módulo en Teams'}</Button>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <SaveRegular />} disabled={busy} onClick={() => void guardar()}>Guardar</Button>
          </>
        ) : undefined}
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '14px' }}>
        <Tab value="curso">Contenido del curso</Tab>
        {!isStudent && <Tab value="calificaciones">Registro de calificaciones</Tab>}
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
            <Text weight="semibold" size={500}>Etiquetas del curso</Text>
            {draft.labels.length === 0 && (
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>Agrega etiquetas con texto e imágenes para dar formato y contenido visual al curso (como en Moodle).</Text>
            )}
            {draft.labels.map((l) => (
              <div key={l.id} style={{ border: '1px solid var(--borde)', borderRadius: '12px', overflow: 'hidden' }}>
                {(l.imageRef || l.imageUrl) && (
                  l.imageUrl
                    ? <img src={l.imageUrl} alt="" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                    : <RefImage fileRef={l.imageRef} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '16px 18px' }}>
                  <Text size={400} block style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, textAlign: (l.imageRef || l.imageUrl) ? 'center' : 'left' }}>{l.texto}</Text>
                  {editable && <div className={styles.actions} style={{ marginTop: '10px' }}><Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, labels: draft.labels.filter((x) => x.id !== l.id) })}>Eliminar</Button></div>}
                </div>
              </div>
            ))}
            {editable && (nuevoLabel ? (
              <div style={{ border: '1px dashed var(--borde)', borderRadius: '12px', padding: '14px' }}>
                <FormField label="Texto de la etiqueta"><Textarea value={nuevoLabel.texto} resize="vertical" onChange={(_, d) => setNuevoLabel({ ...nuevoLabel, texto: d.value })} /></FormField>
                <FieldRow>
                  <FormField label="Imagen (opcional)">
                    <div className={styles.actions}>
                      <input ref={labelImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subirLabelImg(e.target.files?.[0])} />
                      <Button size="small" icon={<ImageRegular />} onClick={() => labelImgRef.current?.click()}>Subir imagen</Button>
                      {nuevoLabel.imageRef && <Text size={200}>Imagen cargada</Text>}
                    </div>
                  </FormField>
                  <FormField label="o URL de la imagen"><Input value={nuevoLabel.imageUrl ?? ''} onChange={(_, d) => setNuevoLabel({ ...nuevoLabel, imageUrl: d.value })} /></FormField>
                </FieldRow>
                <div className={styles.actions} style={{ marginTop: '8px' }}>
                  <Button size="small" appearance="primary" onClick={addLabel}>Agregar etiqueta</Button>
                  <Button size="small" appearance="secondary" onClick={() => setNuevoLabel(null)}>Cancelar</Button>
                </div>
              </div>
            ) : <Button icon={<AddRegular />} onClick={() => setNuevoLabel({ id: '', texto: '' })}>Agregar etiqueta</Button>)}
          </Card>

          {/* Unidades */}
          <div className={styles.actions} style={{ marginBottom: '10px' }}>
            {editable && <Button appearance="secondary" icon={<AddRegular />} onClick={addUnidad}>Agregar unidad de aprendizaje</Button>}
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>{draft.units.length} unidad(es)</Text>
          </div>

          {draft.units.map((u) => (
            <Card key={u.id} className={styles.card}>
              {(editable || u.imageRef) && (
                <div className={styles.unitImgWrap}>
                  <RefImage fileRef={u.imageRef} className={styles.unitImg} alt={u.tema || u.titulo} />
                  {editable && (
                    <Button className={styles.imgBtn} size="small" appearance="secondary" icon={<ImageRegular />} onClick={() => { setUnidadImgTarget(u.id); unidadImgRef.current?.click() }} disabled={busy}>
                      {u.imageRef ? 'Cambiar imagen del tema' : 'Subir imagen del tema'}
                    </Button>
                  )}
                </div>
              )}
              <FieldRow>
                <FormField label="Unidad"><Input value={u.titulo} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { titulo: d.value })} /></FormField>
                <FormField label="Desde"><Input type="date" value={u.desde ?? ''} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { desde: d.value })} /></FormField>
                <FormField label="Hasta"><Input type="date" value={u.hasta ?? ''} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { hasta: d.value })} /></FormField>
                {editable && <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => delUnidad(u.id)}>Eliminar unidad</Button>}
              </FieldRow>

              <FieldRow>
                <FormField label="Tema de la unidad" hint="Tema que se tratará en esta unidad de aprendizaje.">
                  <Input value={u.tema ?? ''} disabled={!editable} onChange={(_, d) => setUnidad(u.id, { tema: d.value })} />
                </FormField>
              </FieldRow>
              {editable && (
                <div className={styles.actions}>
                  <Button appearance="secondary" icon={unidadBusy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={unidadBusy} onClick={() => abrirPlanUnidad(u)}>
                    {planesUnidad[u.id] ? 'Regenerar planificación de unidad con IA' : 'Crear planificación de unidad con IA'}
                  </Button>
                  {planesUnidad[u.id] && (
                    <Button appearance="secondary" icon={<BookOpenRegular />} onClick={() => setPlanUnidadId(u.id)}>Ver planificación</Button>
                  )}
                  <Button appearance="primary" icon={unidadBusy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={unidadBusy || !planesUnidad[u.id]} onClick={() => void crearUnidadIA(u)}>
                    {u.aiCreated ? 'Modificar unidad de aprendizaje con IA' : 'Crear unidad con IA'}
                  </Button>
                </div>
              )}
              {u.introduccion !== undefined && (
                <FormField label="Introducción de la unidad">
                  <Textarea value={u.introduccion} disabled={!editable} resize="vertical" onChange={(_, d) => setUnidad(u.id, { introduccion: d.value })} />
                </FormField>
              )}

              <Text weight="semibold" size={300}>Recursos ({u.recursos.length})</Text>
              {u.recursos.map((r) => (
                <div key={r.id} className={styles.label}>
                  <Text size={200} weight="semibold">{r.tipo.toUpperCase()} · {r.titulo}</Text>
                  {r.tipo === 'texto' && <Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{r.texto}</Text>}
                  {r.tipo === 'enlace' && r.url && <a href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a>}
                  {TIPOS_ARCHIVO.includes(r.tipo) && r.ref && <RefImage fileRef={r.tipo === 'imagen' ? r.ref : undefined} className={r.tipo === 'imagen' ? styles.actThumb : undefined} alt={r.titulo} />}
                  {TIPOS_ARCHIVO.includes(r.tipo) && <Text size={200} block>{r.nombre ?? 'Archivo'}</Text>}
                  <div className={styles.actions} style={{ marginTop: '6px' }}>
                    <Button size="small" appearance="secondary" icon={<ArrowRightRegular />} onClick={() => void abrirRecurso(r)}>Abrir</Button>
                    {editable && <Button size="small" appearance="secondary" icon={<EditRegular />} onClick={() => setNuevoRecurso({ unidadId: u.id, recurso: r })}>Modificar</Button>}
                    {editable && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setUnidad(u.id, { recursos: u.recursos.filter((x) => x.id !== r.id) })}>Eliminar</Button>}
                  </div>
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
                  {a.imageRef && <RefImage fileRef={a.imageRef} className={styles.actThumb} alt={a.titulo} />}
                  {a.tema && <Text size={200} block><strong>Tema:</strong> {a.tema}</Text>}
                  {a.instrucciones && <Text size={200} block style={{ whiteSpace: 'pre-wrap' }}><strong>Instrucciones:</strong> {a.instrucciones}</Text>}
                  {a.hasta && <Text size={200} block><strong>Entrega hasta:</strong> {a.hasta}</Text>}
                  {(a.enlace || a.guiaRef) && (
                    <div className={styles.actions} style={{ marginTop: '6px' }}>
                      {a.enlace && <Button size="small" appearance="secondary" icon={<ArrowRightRegular />} onClick={() => window.open(a.enlace, '_blank')}>Abrir enlace de la actividad</Button>}
                      {a.guiaRef && <Button size="small" appearance="secondary" icon={<ArrowRightRegular />} onClick={() => void abrirGuia(a.guiaRef!)}>Ver documento guía{a.guiaNombre ? `: ${a.guiaNombre}` : ''}</Button>}
                    </div>
                  )}
                  <div className={styles.actions} style={{ marginTop: '6px' }}>
                    {editable && <Button size="small" appearance="secondary" onClick={() => { setEntregaTarget({ unidadId: u.id, actividadId: a.id }); setEntregaEstudiante(estudiantesCurso[0]?.id ?? '') }}>Subir entrega</Button>}
                    {editable && <Button size="small" appearance="secondary" icon={<EditRegular />} onClick={() => setNuevaActividad({ unidadId: u.id, act: a })}>Editar actividad</Button>}
                    {editable && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setUnidad(u.id, { actividades: u.actividades.filter((x) => x.id !== a.id) })}>Eliminar actividad</Button>}
                    {isStudent && <Button size="small" appearance="primary" icon={busy ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={busy} onClick={() => { setStudentActividad(a.id); studentFileRef.current?.click() }}>Subir y entregar actividad</Button>}
                  </div>
                  {/* Entregas y calificación */}
                  {isStudent ? (
                    draft.entregas.filter((e) => e.actividadId === a.id && e.studentId === studentId).map((e) => (
                      <div key={e.id} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--borde)' }}>
                        <Text size={200} block><strong>Mi entrega:</strong> {e.archivos.map((f) => f.name).join(', ')}</Text>
                        <Text size={200} block><strong>Nota:</strong> {e.calificacion || 'pendiente'}{e.comentario ? ` · ${e.comentario}` : ''}</Text>
                      </div>
                    ))
                  ) : (
                    draft.entregas.filter((e) => e.actividadId === a.id).map((e) => (
                      <div key={e.id} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--borde)' }}>
                        <Text size={200} block><strong>{students.find((s) => s.id === e.studentId)?.fullName ?? e.studentId}</strong> · {e.archivos.map((f) => f.name).join(', ')}</Text>
                        <div className={styles.actions} style={{ marginTop: '4px' }}>
                          <Input placeholder="Calificación" value={e.calificacion ?? ''} disabled={!editable} onChange={(_, d) => setEntregaCal(e.id, { calificacion: d.value })} style={{ maxWidth: '120px' }} />
                          <Input placeholder="Comentario" value={e.comentario ?? ''} disabled={!editable} onChange={(_, d) => setEntregaCal(e.id, { comentario: d.value })} />
                          {editable && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, entregas: draft.entregas.filter((x) => x.id !== e.id) })}>Eliminar</Button>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
              {editable && (nuevaActividad?.unidadId === u.id ? (
                <Card style={{ padding: '12px' }}>
                  <FormField label="Título de la actividad" required><Input value={nuevaActividad.act.titulo} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, titulo: d.value } })} /></FormField>
                  <FormField label="Tema de la actividad"><Input value={nuevaActividad.act.tema ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, tema: d.value } })} /></FormField>
                  <FormField label="Instrucciones de la actividad"><Textarea value={nuevaActividad.act.instrucciones ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, instrucciones: d.value } })} /></FormField>
                  <FormField label="Enlace del sitio web de la actividad" hint="Dirección web donde el estudiante realiza la actividad."><Input value={nuevaActividad.act.enlace ?? ''} placeholder="https://…" onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, enlace: d.value } })} /></FormField>
                  <FormField label="Documento guía de la actividad" hint="Material de apoyo para realizar la actividad.">
                    <div className={styles.actions}>
                      <input ref={guiaActFileRef} type="file" style={{ display: 'none' }} onChange={(e) => void subirGuia(e.target.files?.[0])} />
                      <Button size="small" icon={<ArrowUploadRegular />} onClick={() => guiaActFileRef.current?.click()}>Subir documento guía</Button>
                      {nuevaActividad.act.guiaNombre && <Text size={200}>{nuevaActividad.act.guiaNombre}</Text>}
                    </div>
                  </FormField>
                  <FormField label="Imagen de la actividad" hint="Imagen relacionada con la actividad.">
                    <div className={styles.actions}>
                      <input ref={actImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subirImagenActividad(e.target.files?.[0])} />
                      <Button size="small" icon={<ImageRegular />} onClick={() => actImgRef.current?.click()} disabled={busy}>Subir imagen</Button>
                      {nuevaActividad.act.imageRef && <Text size={200}>Imagen cargada</Text>}
                    </div>
                  </FormField>
                  <FieldRow>
                    <FormField label="Puntos"><Input value={String(nuevaActividad.act.puntos ?? '')} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, puntos: Number(d.value) || undefined } })} /></FormField>
                    <FormField label="Entrega hasta"><Input type="date" value={nuevaActividad.act.hasta ?? ''} onChange={(_, d) => setNuevaActividad({ ...nuevaActividad, act: { ...nuevaActividad.act, hasta: d.value } })} /></FormField>
                  </FieldRow>
                  <div className={styles.actions}>
                    <Button appearance="primary" onClick={addActividad}>{nuevaActividad.act.id ? 'Guardar actividad' : 'Agregar actividad'}</Button>
                    <Button appearance="secondary" onClick={() => setNuevaActividad(null)}>Cancelar</Button>
                  </div>
                </Card>
              ) : <Button icon={<AddRegular />} onClick={() => setNuevaActividad({ unidadId: u.id, act: { id: '', titulo: '' } })}>Asignar actividad</Button>)}
            </Card>
          ))}
          <input ref={studentFileRef} type="file" style={{ display: 'none' }} onChange={(e) => { const id = studentActividad; if (id) void subirEntregaEstudiante(e.target.files?.[0], id) }} />
          <input ref={unidadImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subirImagenUnidad(e.target.files?.[0])} />
        </>
      )}

      {!isStudent && tab === 'calificaciones' && (
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
        title={planEditing ? 'Editar planificación de clase' : 'Crear planificación de clase'}
        subtitle="Completa las opciones y usa la IA (se basa en el tema, el registro de grado del curso y el documento modelo)."
        width={760}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlanOpen(false)} disabled={planBusy}>Cerrar</Button>
            {planPreview && <Button appearance="secondary" icon={<ArrowDownloadRegular />} disabled={planBusy} onClick={() => void downloadPlanPdf(planPreview, planForm.titulo)}>Descargar PDF</Button>}
            {planEditUrl && <Button appearance="secondary" as="a" href={planEditUrl} target="_blank" rel="noopener noreferrer" disabled={planBusy}>Abrir en OneDrive</Button>}
            <Button appearance="primary" icon={planBusy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={planBusy} onClick={() => void planificarConIA()}>
              {planBusy ? 'Generando…' : (planPreview || planPreviewUrl || planEditUrl) ? 'Regenerar con IA' : 'Planificar con IA'}
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
        {(planPreview || planPreviewUrl) && (
          <div>
            <Text weight="semibold" size={300} block style={{ marginBottom: '6px' }}>Planificación creada</Text>
            {planPreviewUrl
              ? <iframe title="Planificación" sandbox="" src={planPreviewUrl} style={{ width: '100%', height: '360px', border: '1px solid var(--borde)', borderRadius: '10px', background: '#fff' }} />
              : <iframe title="Planificación" sandbox="" srcDoc={planPreview} style={{ width: '100%', height: '360px', border: '1px solid var(--borde)', borderRadius: '10px', background: '#fff' }} />}
          </div>
        )}
        {planEditUrl && (
          <Card style={{ padding: '12px' }}>
            <Text size={200} block><strong>Planificación actual:</strong> guardada en OneDrive.</Text>
            <div className={styles.actions}>
              <Button size="small" appearance="secondary" as="a" href={planEditUrl} target="_blank" rel="noopener noreferrer">Abrir planificación actual</Button>
            </div>
          </Card>
        )}
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

      <ModalForm
        open={!!datosUnidad}
        onOpenChange={(o) => { if (!o) setDatosUnidad(null) }}
        title="Datos para la planificación de la unidad"
        subtitle="Completa la información necesaria. La IA usará el tema, la descripción, el registro de grado y el documento modelo del curso."
        width={640}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setDatosUnidad(null)} disabled={unidadBusy}>Cancelar</Button>
            <Button
              appearance="primary"
              icon={unidadBusy ? <Spinner size="tiny" /> : <SparkleRegular />}
              disabled={unidadBusy}
              onClick={() => {
                if (!datosUnidad || !draft) return
                const u = draft.units.find((x) => x.id === datosUnidad.unidadId)
                if (!u) return
                const tema = datosUnidad.tema.trim()
                if (!tema) { toaster.dispatchToast('Indica el tema de la unidad.', { intent: 'error' }); return }
                const faltan: string[] = []
                if (!registrosCol.items.some((r) => r.curso === draft.curso)) faltan.push('el registro de grado')
                if (!courseRecs.some((g) => g.planTemplateName)) faltan.push('el documento modelo de planificación')
                if (faltan.length) { toaster.dispatchToast(`Falta subir ${faltan.join(' y ')} del curso.`, { intent: 'error' }); return }
                setUnidad(u.id, { tema })
                setDraft({ ...draft, descripcion: datosUnidad.descripcion })
                setDatosUnidad(null)
                void generarPlanificacion({ ...u, tema }, tema, datosUnidad.descripcion)
              }}
            >
              {unidadBusy ? 'Generando…' : 'Generar planificación'}
            </Button>
          </>
        }
      >
        {datosUnidad && (
          <>
            <FormField label="Tema de la unidad" required>
              <Input value={datosUnidad.tema} onChange={(_, d) => setDatosUnidad({ ...datosUnidad, tema: d.value })} />
            </FormField>
            <FormField label="Descripción del curso">
              <Textarea value={datosUnidad.descripcion} resize="vertical" onChange={(_, d) => setDatosUnidad({ ...datosUnidad, descripcion: d.value })} />
            </FormField>
            {(() => {
              const faltan: string[] = []
              if (!registrosCol.items.some((r) => r.curso === draft.curso)) faltan.push('el registro de grado')
              if (!courseRecs.some((g) => g.planTemplateName)) faltan.push('el documento modelo de planificación')
              return faltan.length ? (
                <div style={{ background: '#FDE7E9', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px' }}>
                  <Text weight="semibold" size={300} block style={{ color: '#B42318' }}>Falta información para generar</Text>
                  <Text size={200} block style={{ color: '#B42318' }}>
                    Sube {faltan.join(' y ')} del curso (en el aula del curso, antes de abrir la asignatura) para poder generar la planificación.
                  </Text>
                </div>
              ) : null
            })()}
          </>
        )}
      </ModalForm>

      <ModalForm
        open={!!planUnidadId}
        onOpenChange={(o) => { if (!o) setPlanUnidadId(null) }}
        title="Planificación de la unidad de aprendizaje"
        subtitle="Inicio · Desarrollo (Recursos, Evaluación, Reflexión) · Cierre."
        width={900}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlanUnidadId(null)} disabled={unidadBusy}>Cerrar</Button>
            <Button
              appearance="secondary"
              icon={<ArrowDownloadRegular />}
              onClick={() => {
                const el = document.getElementById('plan-unidad-html')
                const u = draft.units.find((x) => x.id === planUnidadId)
                if (el) descargarPdf(el.innerHTML, u?.titulo ?? 'Unidad de aprendizaje')
              }}
            >
              Descargar PDF
            </Button>
            <Button
              appearance="primary"
              icon={unidadBusy ? <Spinner size="tiny" /> : <SparkleRegular />}
              disabled={unidadBusy || !planUnidadId || !planesUnidad[planUnidadId]}
              onClick={() => { const u = draft.units.find((x) => x.id === planUnidadId); if (u) void crearUnidadIA(u) }}
            >
              {unidadBusy ? 'Creando…' : 'Crear unidad con IA'}
            </Button>
          </>
        }
      >
        <div id="plan-unidad-html" style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid var(--borde)', borderRadius: '8px', padding: '16px' }} dangerouslySetInnerHTML={{ __html: (planUnidadId && planesUnidad[planUnidadId]) || '<p>Sin contenido.</p>' }} />
      </ModalForm>

      <ModalForm
        open={!!entregaTarget}
        onOpenChange={(o) => { if (!o) setEntregaTarget(null) }}
        title="Registrar entrega de la actividad"
        subtitle="Selecciona el estudiante y el archivo entregado."
        width={560}
        actions={<Button appearance="secondary" onClick={() => setEntregaTarget(null)} disabled={busy}>Cerrar</Button>}
      >
        <input ref={entregaFileRef} type="file" style={{ display: 'none' }} onChange={(e) => void subirEntrega(e.target.files?.[0])} />
        <FormField label="Estudiante" required>
          <Select value={entregaEstudiante} onChange={(_, d) => setEntregaEstudiante(d.value)}>
            <option value="">— Selecciona un estudiante —</option>
            {estudiantesCurso.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </Select>
        </FormField>
        <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={busy || !entregaEstudiante} onClick={() => entregaFileRef.current?.click()}>
          {busy ? 'Subiendo…' : 'Seleccionar archivo y registrar'}
        </Button>
      </ModalForm>
    </div>
  )
}
