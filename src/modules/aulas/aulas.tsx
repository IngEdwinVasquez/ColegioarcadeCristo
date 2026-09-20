import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Input, Select, Spinner, Text, Textarea, useToastController, makeStyles, tokens,
} from '@fluentui/react-components'
import {
  VideoRegular, ArrowRightRegular, ImageRegular, AddRegular, DeleteRegular, BookOpenRegular, ArrowUploadRegular, SparkleRegular,
} from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { cursoNombre, nivelShort, ordenarCursos, asignaturaDe, isRealSubject, gradoDe, seccionDe } from '../../utils/academic'
import { createClassTeam, listTenantTeams, resolveTeamUrl, createClassModule, addModuleFileResource } from '../../services/teamsEdu'
import { graphErrorMessage } from '../../services/graph'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl } from '../../services/onedrive'
import { renderPdfFirstPageToBlob, extractPdfText } from '../../services/pdf'
import { aiChat } from '../../services/ai'
import { genId } from '../../utils/helpers'
import type { Enrollment, GradeRegister, GradeSection, RegistroStudent, SubjectPlan, TeacherAssignment } from '../../types'

export const AULA_IMAGENES = [
  '/aulas/aula1.svg', '/aulas/aula2.svg', '/aulas/aula3.svg',
  '/aulas/aula4.svg', '/aulas/aula5.svg', '/aulas/aula6.svg',
]

export interface Aula {
  curso: string
  level: string
  nivel: string
  grado: string
  section: string
  imageUrl?: string
  imageRef?: string
  records: GradeSection[]
}

const hash = (s: string) => [...s].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7)
export const aulaImage = (aula: Aula) => aula.imageUrl || AULA_IMAGENES[hash(aula.curso) % AULA_IMAGENES.length]

// Caché en memoria: id de imagen en OneDrive → data URL (para renderizar en <img>).
const imgCache = new Map<string, string>()

/** Componente que resuelve y muestra la imagen del aula (subida o preset). */
export function AulaImg({ aula, className, style, alt }: { aula: Aula; className?: string; style?: CSSProperties; alt?: string }) {
  const [src, setSrc] = useState<string>(() => aula.imageUrl || (aula.imageRef ? imgCache.get(aula.imageRef) : '') || aulaImage(aula))
  useEffect(() => {
    if (aula.imageUrl) { setSrc(aula.imageUrl); return }
    const ref = aula.imageRef
    if (!ref) { setSrc(aulaImage(aula)); return }
    const cached = imgCache.get(ref)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(ref).then((data) => { imgCache.set(ref, data); if (alive) setSrc(data) }).catch(() => { if (alive) setSrc(aulaImage(aula)) })
    return () => { alive = false }
  }, [aula])
  return <img className={className} style={style} src={src} alt={alt ?? aula.curso} />
}

/** Agrupa los registros de Gestión académica en aulas (un aula por curso). */
export function aulasFromGrades(grades: GradeSection[]): Aula[] {
  const map = new Map<string, Aula>()
  for (const g of grades) {
    if (!isRealSubject(asignaturaDe(g))) continue
    const curso = cursoNombre(g)
    if (!curso) continue
    let a = map.get(curso)
    if (!a) {
      a = { curso, level: g.level, nivel: nivelShort(g.level), grado: gradoDe(g), section: seccionDe(g), records: [], imageUrl: undefined }
      map.set(curso, a)
    }
    a.records.push(g)
    if (!a.imageUrl && g.imageUrl) a.imageUrl = g.imageUrl
    if (!a.imageRef && g.imageRef) a.imageRef = g.imageRef
  }
  return ordenarCursos([...map.values()].map((a) => a.records[0])).map((g) => map.get(cursoNombre(g))!).filter(Boolean)
}

/** Id del catálogo de asignaturas correspondiente a un registro del curso. */
export const subjectIdOf = (record: GradeSection, subjects: { id: string; name: string }[]): string => {
  const name = asignaturaDe(record).trim().toLowerCase()
  return subjects.find((s) => s.name.trim().toLowerCase() === name)?.id ?? asignaturaDe(record)
}

/** Guarda la imagen en todos los registros del curso (url o referencia de OneDrive). */
async function guardarImagenCurso(records: GradeSection[], patch: { imageUrl?: string; imageRef?: string }) {
  for (const r of records) {
    const next: GradeSection = { ...r, ...patch }
    if (patch.imageUrl) next.imageRef = undefined
    if (patch.imageRef) next.imageUrl = undefined
    await dataService.saveGrade(next)
  }
}

const PREVIEW_STYLE: CSSProperties = { width: '100%', height: '360px', border: '1px solid var(--borde)', borderRadius: '10px', background: '#fff' }

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '18px' },
  card: { padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'transform .2s ease, box-shadow .2s ease', ':hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,130,173,0.18)' } },
  img: { width: '100%', height: '140px', objectFit: 'cover', display: 'block', background: tokens.colorNeutralBackground3 },
  body: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  imgWrap: { position: 'relative' },
  imgBtn: { position: 'absolute', top: '8px', right: '8px' },
  chips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chip: { padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontSize: '12px', fontWeight: 600 },
  link: { display: 'flex', alignItems: 'center', gap: '6px', color: '#0082AD', fontWeight: 700, fontSize: '13px' },
  subjGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '14px' },
  subjCard: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  preset: { border: '2px solid transparent', borderRadius: '10px', padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'none' },
})

/** Selector de imagen del aula (presets + URL). */
function AulaImagenModal({ aula, open, onClose, onSaved }: { aula: Aula | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const styles = useStyles()
  const toaster = useToastController()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!aula) return null
  const aplicar = async (patch: { imageUrl?: string; imageRef?: string }, mensaje: string) => {
    setBusy(true)
    try {
      await guardarImagenCurso(aula.records, patch)
      onSaved()
      toaster.dispatchToast(mensaje, { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const subir = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const ref = await uploadFile('Aulas', file.name, file)
      try { imgCache.set(ref.id, await downloadFileAsDataUrl(ref.id)) } catch { /* se resolverá al mostrar */ }
      await guardarImagenCurso(aula.records, { imageRef: ref.id })
      onSaved()
      toaster.dispatchToast('Imagen subida y asignada al aula.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>Imagen del aula · {aula.curso}</DialogTitle>
          <DialogContent>
            <div style={{ marginBottom: '14px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <AulaImg aula={aula} style={{ width: '150px', height: '84px', objectFit: 'cover', borderRadius: '10px' }} />
              <div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void subir(e.target.files?.[0])} />
                <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? 'Subiendo…' : 'Subir imagen desde mi equipo'}
                </Button>
                <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '6px' }}>Se guarda en OneDrive (carpeta «Aulas»).</Text>
              </div>
            </div>
            <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>O elige una imagen predeterminada:</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {AULA_IMAGENES.map((src) => (
                <button key={src} className={styles.preset} onClick={() => void aplicar({ imageUrl: src }, 'Imagen del aula actualizada.')} disabled={busy} title="Usar esta imagen">
                  <img src={src} alt="Imagen de aula" style={{ width: '100%', height: '92px', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
            <FormField label="O pega la URL de una imagen">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="dx-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/imagen.jpg" style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--borde)' }} />
                <Button appearance="primary" disabled={!url.trim() || busy} onClick={() => void aplicar({ imageUrl: url.trim() }, 'Imagen del aula actualizada.')}>Usar</Button>
              </div>
            </FormField>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>Cerrar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** Relaciona una asignatura con un aula de Teams existente. */
function TeamModal({ record, open, onClose, onSaved }: { record: GradeSection | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toaster = useToastController()
  const [teams, setTeams] = useState<Array<{ id: string; displayName: string }> | null>(null)
  const [teamId, setTeamId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) { setTeams(null); setTeamId(''); return }
    let alive = true
    void (async () => {
      setBusy(true)
      try {
        const list = await listTenantTeams()
        if (alive) setTeams(list)
      } catch (e) {
        if (alive) toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => { alive = false }
  }, [open, toaster])
  if (!record) return null
  const guardar = async () => {
    const team = teams?.find((t) => t.id === teamId)
    if (!team) return
    setBusy(true)
    try {
      const webUrl = await resolveTeamUrl(team.id)
      await dataService.saveGrade({ ...record, teamId: team.id, teamUrl: webUrl })
      onSaved()
      toaster.dispatchToast('Asignatura relacionada con el aula de Teams.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle>Relacionar con un aula de Teams · {asignaturaDe(record)}</DialogTitle>
          <DialogContent>
            {busy && !teams ? <Spinner label="Buscando aulas de Teams…" /> : (
              <FormField label="Aula de Teams">
                <Select value={teamId} onChange={(_, d) => setTeamId(d.value)}>
                  <option value="">— Selecciona un aula —</option>
                  {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                </Select>
              </FormField>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button appearance="primary" disabled={!teamId || busy} onClick={() => void guardar()}>Relacionar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

/** Panel de asignaturas de un aula, con acceso y gestión del aula de Teams. */
export function AulaSubjectsPanel({ subjects, canManage, onOpenSubject, onPlanificarIA, onChanged }: {
  subjects: GradeSection[]
  canManage: boolean
  onOpenSubject?: (g: GradeSection) => void
  onPlanificarIA?: (g: GradeSection) => void
  onChanged: () => void
}) {
  const styles = useStyles()
  const toaster = useToastController()
  const [teamRecord, setTeamRecord] = useState<GradeSection | null>(null)
  const [teamOpen, setTeamOpen] = useState(false)
  const [creando, setCreando] = useState<string | null>(null)

  const quitar = async (g: GradeSection) => {
    try {
      await dataService.saveGrade({ ...g, teamId: undefined, teamUrl: undefined })
      onChanged()
      toaster.dispatchToast('Relación con Teams eliminada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    }
  }
  const crear = async (g: GradeSection) => {
    setCreando(g.id)
    try {
      const team = await createClassTeam(g)
      await dataService.saveGrade({ ...g, teamId: team.teamId, teamUrl: team.webUrl })
      onChanged()
      toaster.dispatchToast('Aula de Teams creada y relacionada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setCreando(null)
    }
  }

  return (
    <>
      <div className={styles.subjGrid}>
        {subjects.map((g) => (
          <Card key={g.id} className={styles.subjCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg,#0082AD,#2AA9D8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpenRegular /></span>
              <Text weight="semibold" size={400}>{asignaturaDe(g)}</Text>
            </div>
            <div className={styles.actions}>
              {g.teamUrl ? (
                <>
                  <Button size="small" appearance="primary" icon={<VideoRegular />} as="a" href={g.teamUrl} target="_blank" rel="noopener noreferrer">Abrir Teams</Button>
                  {canManage && <Button size="small" appearance="secondary" icon={<DeleteRegular />} onClick={() => void quitar(g)}>Quitar relación</Button>}
                </>
              ) : canManage ? (
                <>
                  <Button size="small" appearance="secondary" icon={<AddRegular />} onClick={() => { setTeamRecord(g); setTeamOpen(true) }}>Relacionar Teams</Button>
                  <Button size="small" appearance="secondary" icon={<VideoRegular />} disabled={creando === g.id} onClick={() => void crear(g)}>
                    {creando === g.id ? 'Creando…' : 'Crear en Teams'}
                  </Button>
                </>
              ) : (
                <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin aula de Teams relacionada.</Text>
              )}
              {onPlanificarIA && <Button size="small" appearance="secondary" icon={<SparkleRegular />} onClick={() => onPlanificarIA(g)}>{g.classPlans?.length ? 'Editar planificación' : 'Planificación IA'}</Button>}
              {onOpenSubject && <Button size="small" appearance="outline" icon={<ArrowRightRegular />} onClick={() => onOpenSubject(g)}>Abrir</Button>}
            </div>
          </Card>
        ))}
      </div>
      <TeamModal record={teamRecord} open={teamOpen} onClose={() => setTeamOpen(false)} onSaved={onChanged} />
    </>
  )
}

/** Normaliza el nivel a Inicial | Primaria | Secundaria. */
const normNivel = (v?: string): string => {
  const s = (v ?? '').toLowerCase()
  if (s.includes('inicial')) return 'Inicial'
  if (s.includes('primar')) return 'Primaria'
  if (s.includes('secund')) return 'Secundaria'
  return ''
}

export type AulaScope =
  | { kind: 'todos'; level?: string }
  | { kind: 'docente'; teacherId: string }
  | { kind: 'estudiante'; studentId: string }

/**
 * Vista de aulas (un aula por curso) con imagen y sus asignaturas.
 * - `todos`: todas las aulas (opcionalmente filtradas por nivel).
 * - `docente`: solo las aulas/asignaturas asignadas al docente.
 * - `estudiante`: solo las aulas de los cursos en que está matriculado.
 */
export function AulasView({ scope, subtitle, pageTitle = 'Aulas', onOpenSubject }: {
  scope: AulaScope
  subtitle?: string
  pageTitle?: string
  onOpenSubject?: (g: GradeSection) => void
}) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, studentById, gradeById, students, periods } = useApp()
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const registrosCol = useCollection<GradeRegister>(dataService.getGradeRegisters, dataService.saveGradeRegister)
  const [selected, setSelected] = useState<string | null>(null)
  const [imgAula, setImgAula] = useState<Aula | null>(null)
  const [subiendoReg, setSubiendoReg] = useState(false)
  const regRef = useRef<HTMLInputElement>(null)
  const [subiendoPlan, setSubiendoPlan] = useState(false)
  const planRef = useRef<HTMLInputElement>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [planResult, setPlanResult] = useState<string | null>(null)
  const [planEditId, setPlanEditId] = useState<string | null>(null)
  const [planEditUrl, setPlanEditUrl] = useState<string | null>(null)
  const [planEditing, setPlanEditing] = useState(false)
  const [planPreview, setPlanPreview] = useState('')
  const [planPreviewUrl, setPlanPreviewUrl] = useState('')
  const [planForm, setPlanForm] = useState({ asignatura: '', modulo: '', tema: '', tiempo: '45 minutos', proposito: '', contenidos: '', indicadores: '', actividades: '', recursos: '', evaluacion: '' })

  const notas: GradeSection[] = gradesCol.items.length ? gradesCol.items : grades

  const aulas = useMemo(() => {
    const todas = aulasFromGrades(notas)
    if (scope.kind === 'todos') return scope.level ? todas.filter((a) => normNivel(a.level) === scope.level || normNivel(a.nivel) === scope.level) : todas
    if (scope.kind === 'docente') {
      const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
      return todas
        .map((a) => ({ ...a, records: a.records.filter((r) => ids.has(r.id)) }))
        .filter((a) => a.records.length > 0)
    }
    const cursos = new Set<string>()
    const st = studentById(scope.studentId)
    if (st?.gradeId) { const g = gradeById(st.gradeId) ?? notas.find((x) => x.id === st.gradeId); if (g) cursos.add(cursoNombre(g)) }
    for (const e of enrollmentsCol.items.filter((e) => e.studentId === scope.studentId)) {
      const g = gradeById(e.gradeId) ?? notas.find((x) => x.id === e.gradeId)
      if (g) cursos.add(cursoNombre(g))
    }
    return todas.filter((a) => cursos.has(a.curso))
  }, [notas, scope, assignmentsCol.items, enrollmentsCol.items, studentById, gradeById])

  const canManage = scope.kind !== 'estudiante'
  const seleccion = aulas.find((a) => a.curso === selected) ?? null

  const registroDe = (curso?: string) => (curso ? registrosCol.items.find((r) => r.curso === curso) : undefined)

  /** Sube el PDF del registro de grado del aula y lo crea en la plataforma. */
  const subirRegistro = async (file: File | undefined) => {
    if (!file || !seleccion) return
    setSubiendoReg(true)
    try {
      const activePeriod = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''
      const gradeIds = new Set(seleccion.records.map((r) => r.id))
      const enrolledIds = new Set(enrollmentsCol.items.filter((e) => gradeIds.has(e.gradeId)).map((e) => e.studentId))
      const roster = students.filter((s) => gradeIds.has(s.gradeId) || enrolledIds.has(s.id))
      const existing = registroDe(seleccion.curso)
      const estudiantes: RegistroStudent[] = roster.map((s, i) => ({
        studentId: s.id,
        number: i + 1,
        apellidos: s.fullName.split(' ').slice(1).join(' ') || s.fullName,
        nombres: s.fullName.split(' ')[0] ?? '',
        nacimiento: s.birthDate,
      }))
      let portadaRef: string | undefined
      try {
        const blob = await renderPdfFirstPageToBlob(file)
        if (blob) portadaRef = (await uploadFile('Registro de Grado/Portadas', `${seleccion.curso.replace(/[^\w.-]+/g, '_')}.jpg`, blob)).id
      } catch { /* sin portada */ }
      let plantillaUrl: string | undefined
      try { plantillaUrl = (await uploadAndShare('Registro de Grado', file)).webUrl } catch { /* sin plantilla */ }
      const reg: GradeRegister = {
        id: existing?.id ?? genId('rg'),
        level: seleccion.level,
        nivel: seleccion.nivel,
        ciclo: seleccion.records[0]?.ciclo ?? '',
        curso: seleccion.curso,
        gradeId: seleccion.records[0]?.id ?? '',
        periodId: activePeriod,
        plantillaNombre: file.name,
        plantillaUrl,
        portadaRef: portadaRef ?? existing?.portadaRef,
        centro: existing?.centro ?? {},
        estudiantes: estudiantes.length ? estudiantes : (existing?.estudiantes ?? []),
        asistencia: existing?.asistencia ?? {},
        especificaciones: existing?.especificaciones ?? {},
        calificaciones: existing?.calificaciones ?? {},
        promocion: existing?.promocion ?? {},
        inicial: existing?.inicial,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await registrosCol.save(reg)
      toaster.dispatchToast(existing ? 'Registro de grado actualizado.' : 'Registro de grado creado.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setSubiendoReg(false)
      if (regRef.current) regRef.current.value = ''
    }
  }

  /** Sube el documento modelo (ejemplo) para planificación de clase del curso. */
  const subirPlantillaPlan = async (file: File | undefined) => {
    if (!file || !seleccion) return
    setSubiendoPlan(true)
    try {
      const ref = await uploadFile('Planificaciones/Modelos', file.name, file)
      let texto = ''
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        try { texto = (await extractPdfText(file)).replace(/\s+/g, ' ').trim().slice(0, 15000) } catch { /* sin texto extraíble */ }
      }
      for (const g of seleccion.records) {
        await dataService.saveGrade({ ...g, planTemplateRef: ref.id, planTemplateName: file.name, planTemplateText: texto || g.planTemplateText })
      }
      await gradesCol.refresh()
      toaster.dispatchToast('Documento ejemplo de planificación guardado.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setSubiendoPlan(false)
      if (planRef.current) planRef.current.value = ''
    }
  }

  // Habilitado solo cuando el curso tiene registro de grado y documento ejemplo cargados.
  const registroCurso = seleccion ? registrosCol.items.find((r) => r.curso === seleccion.curso) : undefined
  const modeloPlan = seleccion?.records.find((r) => r.planTemplateName)
  const puedePlanificarIA = !!registroCurso && !!modeloPlan

  /** Crea la planificación de clase con IA: busca en el registro de grado y usa el documento ejemplo como diseño. */
  const planificarIA = async () => {
    if (!seleccion || !registroCurso || !modeloPlan) return
    if (!planForm.modulo.trim()) { toaster.dispatchToast('Indica el nombre del módulo.', { intent: 'error' }); return }
    setPlanBusy(true)
    try {
      const subjRecord = seleccion.records.find((r) => asignaturaDe(r) === planForm.asignatura) ?? modeloPlan
      const template = (modeloPlan.planTemplateText ?? '').slice(0, 12000)
      const reg = registroCurso
      const regInfo = `Centro: ${reg.centro?.nombre ?? ''} | Nivel: ${reg.nivel} | Curso: ${reg.curso} | Estudiantes: ${reg.estudiantes.length}`
      const prompt = `Eres un docente de República Dominicana (MINERD). Crea la PLANIFICACIÓN DE CLASE en HTML para el módulo "${planForm.modulo}" de la asignatura ${planForm.asignatura || asignaturaDe(subjRecord)} del curso ${seleccion.curso}.
Busca en el registro de grado la información relacionada con el módulo "${planForm.modulo}" y úsala como contexto.
Datos del formulario:
- Tema: ${planForm.tema}
- Tiempo: ${planForm.tiempo}
- Propósito: ${planForm.proposito}
- Contenidos: ${planForm.contenidos}
- Indicadores de logro: ${planForm.indicadores}
- Actividades/estrategias: ${planForm.actividades}
- Recursos: ${planForm.recursos}
- Evaluación: ${planForm.evaluacion}
Registro de grado: ${regInfo}
Usa EXACTAMENTE la estructura, secciones y encabezados del siguiente documento modelo:
"""${template || 'Estructura estándar: Encabezado, Tema, Propósito, Contenidos, Indicadores, Actividades (inicio, desarrollo, cierre), Recursos, Evaluación.'}"""
Devuelve ÚNICAMENTE el HTML completo del documento.`
      const html = (await aiChat([
        { role: 'system', content: 'Asistente de planificación docente MINERD. Devuelve HTML.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.4, maxTokens: 3200 })).replace(/```html?/gi, '').replace(/```/g, '').trim()
      const file = new File([new Blob([html], { type: 'text/html' })], `${planForm.modulo.replace(/[^\w.-]+/g, '_')}.html`, { type: 'text/html' })
      const ref = await uploadAndShare('Planificaciones', file)
      let teamMsg = ''
      const teamId = subjRecord?.teamId
      if (teamId) {
        try {
          const mod = await createClassModule(teamId, planForm.modulo, planForm.tema)
          try { await addModuleFileResource(teamId, mod.id, ref.webUrl) } catch { /* recurso opcional */ }
          teamMsg = ' Módulo creado en el aula de Teams.'
        } catch (e) {
          teamMsg = ` No se pudo crear el módulo en Teams: ${graphErrorMessage(e)}`
        }
      } else {
        teamMsg = ' La asignatura no tiene aula de Teams relacionada.'
      }
      const planRec: SubjectPlan = {
        id: planEditId ?? genId('plan'),
        titulo: planForm.modulo,
        tema: planForm.tema,
        url: ref.webUrl,
        ref: ref.id,
        source: 'ia',
        fecha: new Date().toISOString(),
      }
      const previos = subjRecord.classPlans ?? []
      await dataService.saveGrade({ ...subjRecord, classPlans: [planRec, ...previos.filter((p) => p.id !== planRec.id)] })
      setPlanEditId(planRec.id)
      setPlanEditUrl(ref.webUrl)
      setPlanEditing(true)
      setPlanPreview(html)
      setPlanPreviewUrl('')
      await gradesCol.refresh()
      setPlanResult(`Planificación guardada.${teamMsg}`)
      toaster.dispatchToast('Planificación generada con IA.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(graphErrorMessage(error), { intent: 'error' })
    } finally {
      setPlanBusy(false)
    }
  }

  /** Abre el formulario de planificación con los datos disponibles en la plataforma. */
  const abrirPlanIA = (subject?: GradeSection) => {
    if (!seleccion) return
    if (!registroCurso || !modeloPlan) {
      toaster.dispatchToast('Sube el registro de grado y el documento ejemplo del curso para usar la planificación con IA.', { intent: 'error' })
      return
    }
    const asignatura = subject ? asignaturaDe(subject) : asignaturaDe(seleccion.records[0])
    const record = subject ?? seleccion.records.find((r) => asignaturaDe(r) === asignatura)
    const existente = (record?.classPlans ?? [])[0]
    const esp = registroCurso?.especificaciones?.[asignatura]
    const contenidos = esp ? [esp.p1, esp.p2, esp.p3, esp.p4].filter(Boolean).join('\n') : ''
    const tema = (contenidos.split('\n')[0] ?? '').slice(0, 140) || asignatura
    setPlanForm({
      asignatura,
      modulo: existente?.titulo ?? asignatura,
      tema: existente?.tema ?? tema,
      tiempo: '45 minutos',
      proposito: `Desarrollar las competencias de ${asignatura} en los estudiantes de ${seleccion.curso}.`,
      contenidos,
      indicadores: `Reconoce y aplica los conceptos y procedimientos de ${asignatura} en situaciones de su entorno.`,
      actividades: 'Inicio: motivación y saberes previos. Desarrollo: explicación, modelado y práctica guiada. Cierre: síntesis, preguntas de metacognición y evaluación.',
      recursos: 'Pizarra, cuaderno, recursos del aula virtual, proyector.',
      evaluacion: 'Observación directa, participación, ejercicios y la actividad asignada en el módulo.',
    })
    setPlanEditId(existente?.id ?? null)
    setPlanEditUrl(existente?.url ?? null)
    setPlanEditing(!!existente)
    setPlanPreview('')
    setPlanPreviewUrl('')
    setPlanResult(existente ? 'Esta asignatura ya tiene una planificación. Puedes verla o regenerarla.' : null)
    if (existente?.ref) downloadFileAsDataUrl(existente.ref).then(setPlanPreviewUrl).catch(() => { /* sin vista previa */ })
    setPlanOpen(true)
  }

  return (
    <div>
      <PageHeader title={pageTitle} subtitle={subtitle ?? 'Aulas del colegio. Entre a un aula para ver y gestionar sus asignaturas.'} />
      {aulas.length === 0 ? (
        <EmptyStateView title="Sin aulas" message="No hay aulas disponibles para este usuario." icon={<VideoRegular />} />
      ) : (
        <div className={styles.grid}>
          {aulas.map((a) => (
            <Card key={a.curso} className={styles.card} onClick={() => setSelected(a.curso)}>
              <div className={styles.imgWrap}>
                <AulaImg aula={a} className={styles.img} />
                {canManage && (
                  <Button className={styles.imgBtn} size="small" appearance="secondary" icon={<ImageRegular />} onClick={(e) => { e.stopPropagation(); setImgAula(a) }} aria-label="Cambiar imagen" />
                )}
              </div>
              <div className={styles.body}>
                <Text weight="semibold" size={400}>{a.curso}</Text>
                <div className={styles.chips}>
                  <span className={styles.chip}>{a.nivel}</span>
                  <span className={styles.chip}>{a.records.length} asignatura(s)</span>
                </div>
                <span className={styles.link}>Abrir aula <ArrowRightRegular /></span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!seleccion} onOpenChange={(_, d) => { if (!d.open) setSelected(null) }}>
        <DialogSurface style={{ maxWidth: 960 }}>
          <DialogBody>
            <DialogTitle>Aula · {seleccion?.curso ?? ''}</DialogTitle>
            <DialogContent>
              {seleccion && (
                <>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <AulaImg aula={seleccion} style={{ width: '180px', height: '100px', objectFit: 'cover', borderRadius: '12px' }} />
                    <div>
                      <Text weight="semibold" size={500} block>{seleccion.curso}</Text>
                      <Text size={200} style={{ color: 'var(--texto-suave)' }}>{seleccion.nivel} · {seleccion.records.length} asignatura(s)</Text>
                    </div>
                    {canManage && <Button appearance="secondary" icon={<ImageRegular />} onClick={() => setImgAula(seleccion)}>Cambiar imagen</Button>}
                  </div>
                  <AulaSubjectsPanel
                    subjects={seleccion.records}
                    canManage={canManage}
                    onOpenSubject={onOpenSubject}
                    onPlanificarIA={(g) => abrirPlanIA(g)}
                    onChanged={() => { void gradesCol.refresh() }}
                  />

                  <div style={{ marginTop: '18px' }}>
                    <input ref={regRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void subirRegistro(e.target.files?.[0])} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <Text weight="semibold" size={400}>Registro de Grado</Text>
                      {canManage && (
                        <Button appearance="primary" icon={subiendoReg ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={subiendoReg} onClick={() => regRef.current?.click()}>
                          {subiendoReg ? 'Subiendo…' : registroDe(seleccion.curso) ? 'Actualizar registro (PDF)' : 'Subir registro del grado (PDF)'}
                        </Button>
                      )}
                    </div>
                    {(() => {
                      const reg = registroDe(seleccion.curso)
                      if (!reg) return <Text size={200} style={{ color: 'var(--texto-suave)' }}>Aún no hay registro de grado para este curso.</Text>
                      return (
                        <div style={{ border: '1px solid var(--borde)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Text size={200}><strong>Curso:</strong> {reg.curso}</Text>
                          <Text size={200}><strong>Nivel:</strong> {reg.nivel}{reg.ciclo ? ` · ${reg.ciclo}` : ''}</Text>
                          <Text size={200}><strong>Estudiantes:</strong> {reg.estudiantes.length}</Text>
                          {reg.plantillaNombre && <Text size={200}><strong>PDF:</strong> {reg.plantillaNombre}</Text>}
                          <Text size={200}><strong>Actualizado:</strong> {reg.updatedAt.slice(0, 10)}</Text>
                          {reg.plantillaUrl && (
                            <div className={styles.actions}>
                              <Button size="small" appearance="secondary" as="a" href={reg.plantillaUrl} target="_blank" rel="noopener noreferrer">Ver PDF</Button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  <div style={{ marginTop: '18px' }}>
                    <input ref={planRef} type="file" accept="application/pdf,.doc,.docx" style={{ display: 'none' }} onChange={(e) => void subirPlantillaPlan(e.target.files?.[0])} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <Text weight="semibold" size={400}>Documento ejemplo de planificación de clase</Text>
                      {canManage && (
                        <Button appearance="secondary" icon={subiendoPlan ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={subiendoPlan} onClick={() => planRef.current?.click()}>
                          {subiendoPlan ? 'Subiendo…' : seleccion.records[0]?.planTemplateName ? 'Cambiar documento ejemplo' : 'Subir documento ejemplo'}
                        </Button>
                      )}
                    </div>
                    <Text size={200} style={{ color: 'var(--texto-suave)' }}>
                      {seleccion.records[0]?.planTemplateName ? `Modelo actual: ${seleccion.records[0].planTemplateName}` : 'Aún no hay documento modelo para este curso.'}
                    </Text>
                  </div>

                  {!puedePlanificarIA && (
                    <div style={{ background: '#FDE7E9', border: '1px solid #B42318', borderRadius: '8px', padding: '10px 12px', marginTop: '10px' }}>
                      <Text weight="semibold" size={300} block style={{ color: '#B42318' }}>Falta información para la planificación IA</Text>
                      <Text size={200} block style={{ color: '#B42318' }}>
                        Sube el <strong>Registro de Grado</strong> y el <strong>Documento ejemplo de planificación</strong> de este curso para habilitar la planificación con IA en cada asignatura.
                      </Text>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setSelected(null)}>Cerrar</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <AulaImagenModal aula={imgAula} open={!!imgAula} onClose={() => setImgAula(null)} onSaved={() => { void gradesCol.refresh() }} />

      <ModalForm
        open={planOpen}
        onOpenChange={(o) => { if (!o) setPlanOpen(false) }}
        title={planEditing ? 'Editar planificación' : 'Crear planificación con IA'}
        subtitle="Completa las informaciones del módulo. La IA buscará en el registro de grado y usará el diseño del documento ejemplo."
        width={760}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlanOpen(false)} disabled={planBusy}>Cerrar</Button>
            {planEditUrl && <Button appearance="secondary" as="a" href={planEditUrl} target="_blank" rel="noopener noreferrer" disabled={planBusy}>Abrir planificación</Button>}
            <Button appearance="primary" icon={planBusy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={planBusy} onClick={() => void planificarIA()}>
              {planBusy ? 'Generando…' : (planPreview || planPreviewUrl || planEditUrl) ? 'Regenerar con IA' : 'Planificar con IA'}
            </Button>
          </>
        }
      >
        {seleccion && (
          <>
            <FieldRow>
              <FormField label="Asignatura">
                <Select value={planForm.asignatura} onChange={(_, d) => setPlanForm({ ...planForm, asignatura: d.value })}>
                  {seleccion.records.map((r) => <option key={r.id} value={asignaturaDe(r)}>{asignaturaDe(r)}</option>)}
                </Select>
              </FormField>
              <FormField label="Nombre del módulo" required>
                <Input value={planForm.modulo} onChange={(_, d) => setPlanForm({ ...planForm, modulo: d.value })} />
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Tema"><Input value={planForm.tema} onChange={(_, d) => setPlanForm({ ...planForm, tema: d.value })} /></FormField>
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
                  ? <iframe title="Planificación" sandbox="" src={planPreviewUrl} style={PREVIEW_STYLE} />
                  : <iframe title="Planificación" sandbox="" srcDoc={planPreview} style={PREVIEW_STYLE} />}
              </div>
            )}
            {planResult && <Text size={200} block style={{ color: 'var(--texto-suave)' }}>{planResult}</Text>}
          </>
        )}
      </ModalForm>
    </div>
  )
}

/** Vista de aulas para el portal de estudiantes: sus cursos y asignaturas matriculadas. */
export function StudentAulasView({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const { subjects } = useApp()
  return (
    <AulasView
      scope={{ kind: 'estudiante', studentId }}
      pageTitle="Aulas por curso"
      subtitle="Cursos y asignaturas en los que estás matriculado."
      onOpenSubject={(g) => navigate(`/estudiantes/aulas/${g.id}/${encodeURIComponent(seccionDe(g))}/${subjectIdOf(g, subjects)}`)}
    />
  )
}
