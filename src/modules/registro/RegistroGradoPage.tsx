import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell,
  TableRow, Text, Textarea, useToastController, makeStyles,
} from '@fluentui/react-components'
import { AddRegular, DeleteRegular, DocumentPdfRegular, SaveRegular, BookRegular, PeopleRegular, SparkleRegular, ArrowUploadRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { NivelSelector } from '../coordinacion/NivelSelector'
import { useCoordinationLevel } from '../coordinacion/useCoordinationLevel'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadFile, uploadAndShare, downloadFileAsDataUrl } from '../../services/onedrive'
import { extractPdfFirstPageText, renderPdfFirstPageToBlob } from '../../services/pdf'
import { aiChat } from '../../services/ai'
import { graphErrorMessage } from '../../services/graph'
import { appConfig } from '../../config/appConfig'
import { genId } from '../../utils/helpers'
import { cursoNombre, nivelShort, asignaturaDe, isRealSubject, ordenarCursos, GRADOS } from '../../utils/academic'
import type {
  Activity, AttendanceRecord, Enrollment, Grade, GradeRegister, Persona, RegistroCalificacion,
  RegistroCentro, RegistroPeriodos, RegistroStudent, SigerdReport, StudentGuardian, TeacherAssignment,
} from '../../types'

const PERIODOS: Array<{ key: keyof RegistroPeriodos; label: string }> = [
  { key: 'p1', label: 'I' }, { key: 'p2', label: 'II' }, { key: 'p3', label: 'III' }, { key: 'p4', label: 'IV' },
]

const CAL_COLS: Array<{ key: keyof RegistroCalificacion; label: string; grupo: string; editable: boolean }> = [
  { key: 'cf', label: 'C.F.', grupo: 'C.F.', editable: true },
  { key: 'comp50', label: '50% C.F.', grupo: 'COMPLETIVA', editable: false },
  { key: 'compCec', label: 'C.E.C.', grupo: 'COMPLETIVA', editable: true },
  { key: 'comp30', label: '30% C.E.C.', grupo: 'COMPLETIVA', editable: false },
  { key: 'compCcf', label: 'C.C.F.', grupo: 'COMPLETIVA', editable: false },
  { key: 'ext30', label: '30% C.F.', grupo: 'EXTRAORDINARIA', editable: false },
  { key: 'extCex', label: 'C.EX.', grupo: 'EXTRAORDINARIA', editable: true },
  { key: 'ext70', label: '70% C.EX.', grupo: 'EXTRAORDINARIA', editable: false },
  { key: 'extCexf', label: 'C.EX.F.', grupo: 'EXTRAORDINARIA', editable: false },
  { key: 'espCf', label: 'C.F.', grupo: 'ESPECIALES', editable: true },
  { key: 'espCe', label: 'C.E.', grupo: 'ESPECIALES', editable: true },
  { key: 'situacion', label: 'A/R', grupo: 'SITUACIÓN FINAL', editable: false },
]

/** Dominios de desarrollo del Nivel Inicial. */
const DOMINIOS = ['Socioemocional', 'Cognitivo', 'Lenguaje', 'Físico y motor', 'Artístico']
const ESCALA_INICIAL = ['', 'I', 'EP', 'L', 'N/E']

const num = (v?: string): number | null => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Calcula las ponderaciones y la situación final a partir de C.F., C.E.C. y C.EX. */
function deriveCal(c: RegistroCalificacion): RegistroCalificacion {
  const cf = num(c.cf), cec = num(c.compCec), cex = num(c.extCex)
  const comp50 = cf != null ? Math.round(cf * 0.5) : undefined
  const comp30 = cec != null ? Math.round(cec * 0.3) : undefined
  const compCcf = comp50 != null && comp30 != null ? comp50 + comp30 : (comp50 ?? comp30)
  const ext30 = cf != null ? Math.round(cf * 0.3) : undefined
  const ext70 = cex != null ? Math.round(cex * 0.7) : undefined
  const extCexf = ext30 != null && ext70 != null ? ext30 + ext70 : (ext30 ?? ext70)
  const ref = extCexf ?? compCcf
  const situacion = ref == null ? (c.situacion ?? '') : ref >= 65 ? 'A' : 'R'
  const s = (v?: number) => (v == null ? undefined : String(v))
  return { ...c, comp50: s(comp50), comp30: s(comp30), compCcf: s(compCcf), ext30: s(ext30), ext70: s(ext70), extCexf: s(extCexf), situacion }
}

const portadaCache = new Map<string, string>()

/** Portada del registro (primera página del PDF) con respaldo degradado. */
function RegistroPortada({ reg, height = 160 }: { reg: GradeRegister; height?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const ref = reg.portadaRef
    if (!ref) { setSrc(''); return }
    const cached = portadaCache.get(ref)
    if (cached) { setSrc(cached); return }
    let alive = true
    downloadFileAsDataUrl(ref).then((d) => { portadaCache.set(ref, d); if (alive) setSrc(d) }).catch(() => { /* sin portada */ })
    return () => { alive = false }
  }, [reg.portadaRef])
  if (!src) {
    return (
      <div style={{ height, borderRadius: '10px', background: 'linear-gradient(135deg,#0A6E4E,#7FB069)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <BookRegular />
        <Text size={200}>{reg.nivel}</Text>
      </div>
    )
  }
  return <img src={src} alt={reg.curso} style={{ width: '100%', height, objectFit: 'cover', objectPosition: 'top', borderRadius: '10px', border: '1px solid var(--borde)' }} />
}

interface RegistroMeta { gradoNum?: number; level?: string; nivel?: string; ciclo?: string; seccion?: string; year?: string }

/** Extrae grado, nivel, ciclo, sección y año del texto de la primera página del PDF. */
function parseRegistroMeta(text: string): RegistroMeta {
  const t = text.replace(/\s+/g, ' ').trim()
  const up = t.toUpperCase()
  let level = ''
  if (/NIVEL\s+INICIAL|EDUCACI[OÓ]N\s+INICIAL|PREPRIMARI|PREESCOLAR/.test(up)) level = 'Nivel Inicial'
  else if (/NIVEL\s+SECUNDARI|EDUCACI[OÓ]N\s+SECUNDARIA/.test(up)) level = 'Nivel Secundario'
  else if (/NIVEL\s+PRIMARI|EDUCACI[OÓ]N\s+PRIMARIA/.test(up)) level = 'Nivel Primario'
  const gm = t.match(/\b([1-6])\s*(?:ER|DO|RO|TO|MO|NO|VO|°|º)?\s*GRADO/i) || t.match(/GRADO\s*([1-6])/i)
  const gradoNum = gm ? Number(gm[1]) : undefined
  let ciclo = ''
  if (/PRIMER\s+CICLO/.test(up)) ciclo = 'Primer ciclo'
  else if (/SEGUNDO\s+CICLO/.test(up)) ciclo = 'Segundo ciclo'
  else if (gradoNum && (level === 'Nivel Primario' || level === 'Nivel Secundario')) ciclo = gradoNum <= 3 ? 'Primer ciclo' : 'Segundo ciclo'
  const sm = t.match(/SECCI[OÓ]N\s*:?\s*([A-G])\b/i)
  const ym = t.match(/20\s*_?\s*(\d{2})\s*[-–]?\s*20\s*_?\s*(\d{2})/)
  return { gradoNum, level: level || undefined, nivel: level ? nivelShort(level) : undefined, ciclo, seccion: sm ? sm[1].toUpperCase() : undefined, year: ym ? `20${ym[1]}-20${ym[2]}` : undefined }
}

const useStyles = makeStyles({
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  scroll: { overflowX: 'auto' },
  mini: { width: '62px' },
  th: { fontSize: '11px', whiteSpace: 'nowrap' },
})

export type RegistroScope = { kind: 'coordinacion' } | { kind: 'todos' } | { kind: 'docente'; teacherId: string }

/** Registro de Grado para el docente: solo sus cursos/asignaturas. */
export function MiRegistroGradoPage() {
  const { user } = useApp()
  return (
    <RegistroGradoPage
      scope={{ kind: 'docente', teacherId: user?.teacherId ?? '' }}
      title="Mi Registro de Grado"
      subtitle="Complete las hojas del registro de grado de las asignaturas que imparte. Solo puede digitar sus asignaturas."
    />
  )
}

interface Props {
  scope: RegistroScope
  title?: string
  subtitle?: string
}

/**
 * Registro de Grado (MINERD). Permite crear el registro por curso y llenar las hojas:
 * datos del centro, estudiantes (numerados), asistencia, especificaciones, calificaciones
 * por asignatura (con restricción al docente de cada asignatura) y promoción.
 */
export function RegistroGradoPage({ scope, title = 'Registro de Grado', subtitle }: Props) {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, periods, students, studentById, subjects, teacherById } = useApp()
  const registrosCol = useCollection<GradeRegister>(dataService.getGradeRegisters, dataService.saveGradeRegister, dataService.deleteGradeRegister)
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports)
  const personasCol = useCollection<Persona>(dataService.getPersonas)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians)
  const attendanceCol = useCollection<AttendanceRecord>(dataService.getAttendance)
  const activitiesCol = useCollection<Activity>(dataService.getActivities)
  const scoresCol = useCollection<Grade>(dataService.getScores)
  const coord = useCoordinationLevel()

  const esCoord = scope.kind === 'coordinacion'
  const esDocente = scope.kind === 'docente'
  const nivelFiltro = esCoord ? coord.level : ''
  const [ciclo, setCiclo] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [detalle, setDetalle] = useState<GradeRegister | null>(null)
  const [draft, setDraft] = useState<GradeRegister | null>(null)
  const [tab, setTab] = useState('centro')
  const [periodoInicial, setPeriodoInicial] = useState('p1')
  const [busy, setBusy] = useState(false)
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null)
  const [nuevoPeriodo, setNuevoPeriodo] = useState(periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '')
  const pdfRef = useRef<HTMLInputElement>(null)

  const cursosCatalogo = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => ({ nombre: cursoNombre(g), grade: g })),
    [grades],
  )

  // Cursos que puede ver el usuario según el alcance.
  const cursosPermitidos = useMemo(() => {
    if (esDocente) {
      const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
      const cursos = new Set(grades.filter((g) => ids.has(g.id)).map((g) => cursoNombre(g)))
      return cursosCatalogo.filter((c) => cursos.has(c.nombre))
    }
    return cursosCatalogo.filter((c) => {
      if (nivelFiltro && nivelShort(c.grade.level) !== nivelFiltro) return false
      if (ciclo && (c.grade.ciclo || '') !== ciclo) return false
      return true
    })
  }, [esDocente, scope, assignmentsCol.items, grades, cursosCatalogo, nivelFiltro, ciclo])

  const registros = useMemo(() => {
    const nombres = new Set(cursosPermitidos.map((c) => c.nombre))
    return registrosCol.items.filter((r) => nombres.has(r.curso)).sort((a, b) => a.curso.localeCompare(b.curso))
  }, [registrosCol.items, cursosPermitidos])

  // Asignaturas del docente en un curso (para restringir la edición).
  const asignaturasDocente = useMemo(() => {
    if (!esDocente || !draft) return null
    const ids = new Set(assignmentsCol.items.filter((a) => a.teacherId === scope.teacherId).map((a) => a.gradeId))
    const set = new Set(grades.filter((g) => ids.has(g.id) && cursoNombre(g) === draft.curso).map((g) => asignaturaDe(g)))
    return set
  }, [esDocente, scope, assignmentsCol.items, grades, draft])

  useEffect(() => {
    if (detalle) { setDraft(structuredClone(detalle)); setTab('centro') }
  }, [detalle])

  const asignaturasCurso = useMemo(() => {
    const curso = draft?.curso
    if (!curso) return []
    return [...new Set(grades.filter((g) => cursoNombre(g) === curso && isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b))
  }, [grades, draft])

  const esInicial = draft?.nivel === 'Inicial'
  const areasCurso = esInicial ? DOMINIOS : asignaturasCurso

  const estudiantesCurso = (curso: string) => {
    const ids = new Set(grades.filter((g) => cursoNombre(g) === curso).map((g) => g.id))
    const byEnr = enrollmentsCol.items.filter((e) => ids.has(e.gradeId)).map((e) => e.studentId)
    const direct = students.filter((s) => ids.has(s.gradeId)).map((s) => s.id)
    return [...new Set([...byEnr, ...direct])].map((id) => studentById(id)).filter((s): s is NonNullable<typeof s> => !!s)
  }

  /** Prellena el registro con la información existente en la plataforma. */
  const preencher = async (reg: GradeRegister): Promise<GradeRegister> => {
    const centro: RegistroCentro = { ...(reg.centro ?? {}) }
    centro.nombre ||= appConfig.institution
    centro.direccion ||= appConfig.contact.address
    centro.correo ||= appConfig.contact.email
    centro.telefono ||= appConfig.contact.phone
    try {
      const reports = reportsCol.items.length ? reportsCol.items : await dataService.getSigerdReports()
      const h = [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]?.header
      if (!centro.nombre && h?.centroEducativo) centro.nombre = h.centroEducativo
      if (!centro.regional && h?.direccionRegional) centro.regional = h.direccionRegional
      if (!centro.distrito && h?.distritoEducativo) centro.distrito = h.distritoEducativo
      if (!centro.sector && h?.sector) centro.sector = h.sector
      if (!centro.jornada && h?.tandaServicio) centro.jornada = h.tandaServicio
    } catch { /* sin reportes SIGERD */ }
    try {
      const personas = personasCol.items.length ? personasCol.items : await dataService.getPersonas()
      const dir = personas.find((p) => p.tipo === 'director')
      if (!centro.director && dir) centro.director = dir.fullName
    } catch { /* sin personas */ }
    const lead = grades.find((g) => cursoNombre(g) === reg.curso)?.leadTeacherId
    if (!centro.docenteEncargado && lead) centro.docenteEncargado = teacherById(lead)?.fullName

    let guardians: StudentGuardian[] = guardiansCol.items
    if (!guardians.length) { try { guardians = await dataService.getGuardians() } catch { guardians = [] } }

    const lista = estudiantesCurso(reg.curso)
    const estudiantes: RegistroStudent[] = lista.map((s, i) => {
      const prev = reg.estudiantes.find((e) => e.studentId === s.id)
      const sg = s.sigerd
      const apellidos = sg ? `${sg.primerApellido ?? ''} ${sg.segundoApellido ?? ''}`.trim() : (s.fullName.split(' ').slice(1).join(' ') || s.fullName)
      const nombres = (sg?.nombres || s.fullName.split(' ')[0] || '').trim()
      const fam = guardians.filter((g) => g.studentId === s.id)
      return {
        studentId: s.id,
        number: i + 1,
        apellidos: prev?.apellidos || apellidos,
        nombres: prev?.nombres || nombres,
        nacimiento: prev?.nacimiento || s.birthDate || sg?.nacimiento,
        emergenciaNombre: prev?.emergenciaNombre || fam[0]?.fullName || s.parentName,
        emergenciaParentesco: prev?.emergenciaParentesco || fam[0]?.parentesco,
        emergenciaTelefono: prev?.emergenciaTelefono || fam[0]?.phone,
        familiares: prev?.familiares?.length ? prev.familiares : fam.map((f) => ({ nombre: f.fullName, parentesco: f.parentesco, telefono: f.phone })),
      }
    })

    // Calificaciones: C.F. = promedio de las calificaciones existentes por asignatura.
    const calificaciones: Record<string, Record<string, RegistroCalificacion>> = { ...(reg.calificaciones ?? {}) }
    try {
      const activities = activitiesCol.items.length ? activitiesCol.items : await dataService.getActivities()
      const scores = scoresCol.items.length ? scoresCol.items : await dataService.getScores()
      const gradeIds = new Set(grades.filter((g) => cursoNombre(g) === reg.curso).map((g) => g.id))
      const asignaturas = reg.nivel === 'Inicial'
        ? DOMINIOS
        : [...new Set(grades.filter((g) => cursoNombre(g) === reg.curso && isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b))
      const subjName = new Map(subjects.map((s) => [s.id, s.name.trim().toLowerCase()]))
      const porAsig = new Map<string, Activity[]>()
      for (const a of activities) {
        if (!gradeIds.has(a.gradeId)) continue
        const asig = asignaturas.find((x) => x.trim().toLowerCase() === subjName.get(a.subjectId))
        if (!asig) continue
        porAsig.set(asig, [...(porAsig.get(asig) ?? []), a])
      }
      for (const [asig, acts] of porAsig) {
        const actIds = new Set(acts.map((a) => a.id))
        const points = new Map(acts.map((a) => [a.id, a.points || 0]))
        calificaciones[asig] = { ...(calificaciones[asig] ?? {}) }
        for (const e of estudiantes) {
          if (!e.studentId) continue
          const key = String(e.number)
          if (calificaciones[asig][key]?.cf) continue
          let got = 0
          let total = 0
          for (const sc of scores) {
            if (sc.studentId !== e.studentId || !actIds.has(sc.activityId)) continue
            got += sc.score
            total += points.get(sc.activityId) ?? 0
          }
          if (total > 0) calificaciones[asig][key] = { ...(calificaciones[asig][key] ?? {}), cf: String(Math.round((got / total) * 100)) }
        }
      }
    } catch { /* sin calificaciones */ }

    // Asistencia: conteo por periodo a partir de los registros de asistencia.
    const asistencia: Record<string, RegistroPeriodos> = { ...(reg.asistencia ?? {}) }
    try {
      const att = attendanceCol.items.length ? attendanceCol.items : await dataService.getAttendance()
      const gradeIds = new Set(grades.filter((g) => cursoNombre(g) === reg.curso).map((g) => g.id))
      const periodoDe = (fecha: string) => { const m = Number((fecha ?? '').slice(5, 7)); return m <= 3 ? 'p1' : m <= 6 ? 'p2' : m <= 9 ? 'p3' : 'p4' }
      const counts = new Map<string, Record<string, { p: number; a: number; t: number; j: number }>>()
      for (const rec of att) {
        if (!gradeIds.has(rec.gradeId)) continue
        const pk = periodoDe(rec.date)
        for (const en of rec.entries) {
          const byP = counts.get(en.studentId) ?? {}
          const c = byP[pk] ?? { p: 0, a: 0, t: 0, j: 0 }
          if (en.status === 'presente') c.p += 1
          else if (en.status === 'ausente') c.a += 1
          else if (en.status === 'tarde') c.t += 1
          else c.j += 1
          byP[pk] = c
          counts.set(en.studentId, byP)
        }
      }
      for (const e of estudiantes) {
        if (!e.studentId) continue
        const byP = counts.get(e.studentId)
        if (!byP) continue
        const key = String(e.number)
        const val = { ...(asistencia[key] ?? {}) }
        for (const p of PERIODOS) {
          const c = byP[p.key]
          if (c && !val[p.key]) val[p.key] = `P:${c.p} A:${c.a} T:${c.t} J:${c.j}`
        }
        asistencia[key] = val
      }
    } catch { /* sin asistencia */ }

    return { ...reg, centro, estudiantes, calificaciones, asistencia }
  }

  const abrirNuevo = () => {
    setArchivoPdf(null)
    setOpenNew(true)
  }

  const crear = async () => {
    if (!archivoPdf) { toaster.dispatchToast('Selecciona el PDF del registro de grado.', { intent: 'error' }); return }
    setBusy(true)
    try {
      const meta = parseRegistroMeta(await extractPdfFirstPageText(archivoPdf))
      const seccion = meta.seccion || 'A'
      const gradoNombre = meta.gradoNum ? GRADOS[meta.gradoNum - 1] : ''
      const nivel = meta.level || (nivelFiltro ? `Nivel ${nivelFiltro}` : 'Nivel Primario')
      const curso = gradoNombre ? `${gradoNombre}.${seccion} · ${nivelShort(nivel)}` : `${seccion} · ${nivelShort(nivel)}`

      let portadaRef: string | undefined
      try {
        const blob = await renderPdfFirstPageToBlob(archivoPdf)
        if (blob) {
          const ref = await uploadFile('Registro de Grado/Portadas', `${curso.replace(/[^\w.-]+/g, '_')}.jpg`, blob)
          portadaRef = ref.id
          portadaCache.set(ref.id, URL.createObjectURL(blob))
        }
      } catch { /* sin portada */ }
      let plantillaUrl: string | undefined
      try { plantillaUrl = (await uploadAndShare('Registro de Grado', archivoPdf)).webUrl } catch { /* sin plantilla */ }

      const existing = grades.filter((g) => cursoNombre(g) === curso)
      const students = estudiantesCurso(curso)
      const base: GradeRegister = {
        id: genId('rg'),
        level: existing[0]?.level ?? nivel,
        nivel: nivelShort(existing[0]?.level ?? nivel),
        ciclo: existing[0]?.ciclo || meta.ciclo || ciclo || '',
        curso,
        gradeId: existing[0]?.id ?? '',
        periodId: nuevoPeriodo,
        plantillaNombre: archivoPdf.name,
        plantillaUrl,
        portadaRef,
        centro: {},
        estudiantes: students.map((s, i) => ({ studentId: s.id, number: i + 1, apellidos: s.fullName.split(' ').slice(1).join(' ') || s.fullName, nombres: s.fullName.split(' ')[0] ?? '' })),
        asistencia: {},
        especificaciones: {},
        calificaciones: {},
        promocion: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const full = await preencher(base)
      await registrosCol.save(full)
      toaster.dispatchToast(
        existing.length ? 'Registro de grado creado y prellenado.' : `Registro creado. El curso "${curso}" no existe en Gestión académica: créelo para cargar estudiantes.`,
        { intent: existing.length ? 'success' : 'warning' },
      )
      setOpenNew(false)
      setDetalle(full)
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const guardar = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const calDerivada: Record<string, Record<string, RegistroCalificacion>> = {}
      for (const [a, porEst] of Object.entries(draft.calificaciones ?? {})) {
        calDerivada[a] = {}
        for (const [k, c] of Object.entries(porEst)) calDerivada[a][k] = deriveCal(c)
      }
      const next = { ...draft, calificaciones: calDerivada, updatedAt: new Date().toISOString() }
      await registrosCol.save(next)
      toaster.dispatchToast('Registro guardado.', { intent: 'success' })
      setDraft(null)
      setDetalle(null)
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Genera con IA las especificaciones curriculares por asignatura/área y periodo. */
  const llenarConIA = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const prompt = `Eres un docente del nivel ${draft.nivel} en República Dominicana (currículo MINERD). Para el curso ${draft.curso}${draft.ciclo ? ` (${draft.ciclo})` : ''}, redacta las especificaciones curriculares aplicadas por período (I, II, III y IV) por área/asignatura.
Para cada área/asignatura y cada período, escribe exactamente estas tres partes en el texto:
"Competencias Específicas (CE): <...>"
"Indicadores de Logro (IL): <...>"
"Contenidos Claves: <...>"
Devuelve un JSON válido con la forma {"Area 1":{"p1":"Competencias Específicas (CE): ...\\nIndicadores de Logro (IL): ...\\nContenidos Claves: ...","p2":"...","p3":"...","p4":"..."}, ...}, usando EXACTAMENTE estas áreas: ${areasCurso.join(', ')}.
Responde ÚNICAMENTE el JSON.`
      const res = await aiChat(
        [{ role: 'system', content: 'Asistente curricular MINERD. Responde solo JSON válido.' }, { role: 'user', content: prompt }],
        { temperature: 0.3, jsonMode: true, maxTokens: 2600 },
      )
      const json = res.match(/\{[\s\S]*\}/)?.[0] ?? res
      const parsed = JSON.parse(json) as Record<string, RegistroPeriodos>
      const next = { ...(draft.especificaciones ?? {}) }
      for (const [area, val] of Object.entries(parsed)) {
        const match = areasCurso.find((a) => a.trim().toLowerCase() === area.trim().toLowerCase())
        if (match) next[match] = { ...(next[match] ?? {}), ...val }
      }
      setDraft({ ...draft, especificaciones: next })
      toaster.dispatchToast('Especificaciones generadas con IA. Revísalas y guarda.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const cargarMatriculados = () => {
    if (!draft) return
    const lista = estudiantesCurso(draft.curso)
    setDraft({
      ...draft,
      estudiantes: lista.map((s, i) => {
        const prev = draft.estudiantes.find((e) => e.studentId === s.id)
        return prev ? { ...prev, number: i + 1 } : { studentId: s.id, number: i + 1, apellidos: s.fullName.split(' ').slice(1).join(' ') || s.fullName, nombres: s.fullName.split(' ')[0] ?? '' }
      }),
    })
  }

  const setCal = (asignatura: string, numero: number, key: keyof RegistroCalificacion, value: string) => {
    if (!draft) return
    const cal = { ...(draft.calificaciones ?? {}) }
    const porAsig = { ...(cal[asignatura] ?? {}) }
    porAsig[String(numero)] = { ...(porAsig[String(numero)] ?? {}), [key]: value }
    cal[asignatura] = porAsig
    setDraft({ ...draft, calificaciones: cal })
  }

  const puedeEditarAsignatura = (asignatura: string) => esInicial || !esDocente || !asignaturasDocente || asignaturasDocente.has(asignatura)

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle ?? 'Registro de grado por curso (MINERD): datos del centro, estudiantes, asistencia, especificaciones, calificaciones y promoción.'} />

      <Card className={styles.card}>
        <div className={styles.actions}>
          {esCoord && <NivelSelector value={coord.level} onChange={coord.setLevel} levels={coord.levels} />}
          {!esDocente && (
            <FormField label="Ciclo">
              <Select value={ciclo} onChange={(_, d) => setCiclo(d.value)}>
                <option value="">Todos los ciclos</option>
                <option value="Primer ciclo">Primer ciclo</option>
                <option value="Segundo ciclo">Segundo ciclo</option>
              </Select>
            </FormField>
          )}
          {!esDocente && <Button appearance="primary" icon={<ArrowUploadRegular />} onClick={abrirNuevo}>Subir registro de grado (PDF)</Button>}
        </div>
      </Card>

      {registrosCol.loading ? (
        <Spinner label="Cargando registros…" />
      ) : registros.length === 0 ? (
        <EmptyStateView title="Sin registros de grado" message={esDocente ? 'Aún no hay registros de grado para sus cursos asignados.' : 'Cree un registro de grado para un curso.'} icon={<BookRegular />} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
          {registros.map((r) => (
            <Card key={r.id} style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <RegistroPortada reg={r} />
              <Text weight="semibold" size={400}>{r.curso}</Text>
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>{r.nivel}{r.ciclo ? ` · ${r.ciclo}` : ''} · {r.estudiantes.length} estudiante(s)</Text>
              {r.plantillaNombre && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Plantilla: {r.plantillaNombre}</Text>}
              <div className={styles.actions}>
                <Button appearance="primary" icon={<BookRegular />} onClick={() => setDetalle(r)}>Abrir registro</Button>
                {!esDocente && <Button appearance="secondary" icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar este registro de grado?')) void registrosCol.remove(r.id) }} aria-label="Eliminar" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Crear registro */}
      <Dialog open={openNew} onOpenChange={(_, d) => { if (!d.open) setOpenNew(false) }}>
        <DialogSurface style={{ maxWidth: 560 }}>
          <DialogBody>
            <DialogTitle>Subir registro de grado (PDF)</DialogTitle>
            <DialogContent>
              <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '10px' }}>
                Se extraen el <strong>grado</strong> y el <strong>nivel</strong> del PDF, y el <strong>ciclo</strong> se determina por el primer número del grado (1-3 primer ciclo, 4-6 segundo ciclo; no aplica a Inicial). Se usa la primera página como portada.
              </Text>
              <FormField label="PDF del registro del curso" required>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => setArchivoPdf(e.target.files?.[0] ?? null)} />
                  <Button icon={<ArrowUploadRegular />} disabled={busy} onClick={() => pdfRef.current?.click()}>Seleccionar PDF</Button>
                  {archivoPdf && <Text size={200}>{archivoPdf.name}</Text>}
                </div>
              </FormField>
              <FormField label="Año escolar / período" required>
                <Select value={nuevoPeriodo} onChange={(_, d) => setNuevoPeriodo(d.value)}>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
                </Select>
              </FormField>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOpenNew(false)} disabled={busy}>Cancelar</Button>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <ArrowUploadRegular />} onClick={() => void crear()} disabled={busy || !archivoPdf}>Subir y crear</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Detalle */}
      <Dialog open={!!draft} onOpenChange={(_, d) => { if (!d.open) setDraft(null) }}>
        <DialogSurface style={{ maxWidth: 1200, width: '96vw' }}>
          <DialogBody>
            <DialogTitle>Registro de Grado · {draft?.curso}</DialogTitle>
            <DialogContent>
              {draft && (
                <>
                  <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '14px', flexWrap: 'wrap' }}>
                    <Tab value="centro">Datos del centro</Tab>
                    <Tab value="estudiantes">Datos generales del estudiante</Tab>
                    <Tab value="asistencia">Asistencia y puntualidad</Tab>
                    <Tab value="especificaciones">Especificaciones curriculares</Tab>
                    {esInicial ? (
                      <Tab value="aprendizajes">¿Qué están aprendiendo?</Tab>
                    ) : (
                      <>
                        <Tab value="calificaciones">Calificaciones y rendimientos</Tab>
                        <Tab value="promocion">Promoción de grado</Tab>
                      </>
                    )}
                  </TabList>

                  {tab === 'centro' && (
                    <FieldRow>
                      {([['nombre', 'Nombre del centro'], ['codigo', 'Código de gestión'], ['sigerd', 'SIGERD'], ['regional', 'Dirección regional'], ['distrito', 'Distrito'], ['director', 'Director del centro'], ['docenteEncargado', 'Docente encargado'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['jornada', 'Jornada'], ['sector', 'Sector'], ['zona', 'Zona']] as Array<[keyof NonNullable<GradeRegister['centro']>, string]>).map(([k, label]) => (
                        <FormField key={k} label={label}>
                          <Input value={(draft.centro?.[k] as string) ?? ''} onChange={(_, d) => setDraft({ ...draft, centro: { ...(draft.centro ?? {}), [k]: d.value } })} />
                        </FormField>
                      ))}
                    </FieldRow>
                  )}

                  {tab === 'estudiantes' && (
                    <>
                      <div className={styles.actions}>
                        <Button appearance="secondary" icon={<PeopleRegular />} onClick={cargarMatriculados}>Cargar estudiantes matriculados</Button>
                        <Button appearance="secondary" icon={<AddRegular />} onClick={() => setDraft({ ...draft, estudiantes: [...draft.estudiantes, { number: draft.estudiantes.length + 1, apellidos: '', nombres: '' }] })}>Agregar estudiante</Button>
                      </div>
                      <div className={styles.scroll}>
                        <Table size="small">
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Apellidos</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Nombres</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Emergencia (nombre / parentesco / teléfono)</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Familiar o tutor (nombre / parentesco / teléfono)</TableHeaderCell>
                              <TableHeaderCell className={styles.th}></TableHeaderCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.estudiantes.map((e, i) => (
                              <TableRow key={i}>
                                <TableCell>{e.number}</TableCell>
                                <TableCell><Input value={e.apellidos} onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, apellidos: d.value }; setDraft({ ...draft, estudiantes: arr }) }} /></TableCell>
                                <TableCell><Input value={e.nombres} onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, nombres: d.value }; setDraft({ ...draft, estudiantes: arr }) }} /></TableCell>
                                <TableCell>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <Input value={e.emergenciaNombre ?? ''} placeholder="Nombre" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaNombre: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.emergenciaParentesco ?? ''} placeholder="Parentesco" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaParentesco: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.emergenciaTelefono ?? ''} placeholder="Teléfono" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, emergenciaTelefono: d.value }; setDraft({ ...draft, estudiantes: arr }) }} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <Input value={e.familiares?.[0]?.nombre ?? ''} placeholder="Nombre" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), nombre: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.familiares?.[0]?.parentesco ?? ''} placeholder="Parentesco" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), parentesco: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                    <Input value={e.familiares?.[0]?.telefono ?? ''} placeholder="Teléfono" onChange={(_, d) => { const arr = [...draft.estudiantes]; arr[i] = { ...e, familiares: [{ ...(e.familiares?.[0] ?? {}), telefono: d.value }] }; setDraft({ ...draft, estudiantes: arr }) }} />
                                  </div>
                                </TableCell>
                                <TableCell><Button appearance="subtle" icon={<DeleteRegular />} onClick={() => setDraft({ ...draft, estudiantes: draft.estudiantes.filter((_, j) => j !== i).map((x, j) => ({ ...x, number: j + 1 })) })} aria-label="Eliminar" /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}

                  {tab === 'asistencia' && (
                    <div className={styles.scroll}>
                      <Table size="small">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                            <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                            {PERIODOS.map((p) => <TableHeaderCell key={p.key} className={styles.th}>Periodo {p.label}</TableHeaderCell>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draft.estudiantes.map((e) => {
                            const key = String(e.number)
                            const val = draft.asistencia?.[key] ?? {}
                            return (
                              <TableRow key={key}>
                                <TableCell>{e.number}</TableCell>
                                <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                {PERIODOS.map((p) => (
                                  <TableCell key={p.key}>
                                    <Input className={styles.mini} value={val[p.key] ?? ''} placeholder="—" onChange={(_, d) => setDraft({ ...draft, asistencia: { ...(draft.asistencia ?? {}), [key]: { ...val, [p.key]: d.value } } })} />
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {tab === 'especificaciones' && (
                    <div className={styles.scroll}>
                      <div className={styles.actions} style={{ marginBottom: '10px' }}>
                        <Button appearance="secondary" icon={busy ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={busy || areasCurso.length === 0} onClick={() => void llenarConIA()}>Llenar con IA</Button>
                        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Genera las especificaciones curriculares por asignatura/área y periodo.</Text>
                      </div>
                      <Table size="small">
                        <TableHeader>
                          <TableRow>
                            <TableHeaderCell className={styles.th}>Asignatura / área</TableHeaderCell>
                            {PERIODOS.map((p) => <TableHeaderCell key={p.key} className={styles.th}>Periodo {p.label}</TableHeaderCell>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {areasCurso.map((a) => {
                            const val = draft.especificaciones?.[a] ?? {}
                            const editable = puedeEditarAsignatura(a)
                            return (
                              <TableRow key={a}>
                                <TableCell>{a}</TableCell>
                                {PERIODOS.map((p) => (
                                  <TableCell key={p.key}>
                                    <Textarea disabled={!editable} value={val[p.key] ?? ''} resize="vertical" onChange={(_, d) => setDraft({ ...draft, especificaciones: { ...(draft.especificaciones ?? {}), [a]: { ...val, [p.key]: d.value } } })} />
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {tab === 'calificaciones' && (
                    <>
                      <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '10px' }}>
                        Ingrese <strong>C.F.</strong>, <strong>C.E.C.</strong> y <strong>C.EX.</strong>: las ponderaciones (50%, 30%, 70%) y la situación final (A/R) se calculan automáticamente.
                      </Text>
                      {asignaturasCurso.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>El curso no tiene asignaturas registradas.</Text>}
                      {asignaturasCurso.map((a) => {
                        const editable = puedeEditarAsignatura(a)
                        const porEst = draft.calificaciones?.[a] ?? {}
                        return (
                          <Card key={a} style={{ padding: '14px', marginBottom: '14px' }}>
                            <Text weight="semibold" size={400}>{a}{!editable ? ' · (solo lectura: no es su asignatura)' : ''}</Text>
                            <div className={styles.scroll}>
                              <Table size="small">
                                <TableHeader>
                                  <TableRow>
                                    <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                                    <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                                    {CAL_COLS.map((c, i) => <TableHeaderCell key={`${c.grupo}-${c.key}-${i}`} className={styles.th}>{c.grupo === 'C.F.' ? 'C.F.' : `${c.grupo}: ${c.label}`}</TableHeaderCell>)}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draft.estudiantes.map((e) => {
                                    const cal = deriveCal(porEst[String(e.number)] ?? {})
                                    return (
                                      <TableRow key={e.number}>
                                        <TableCell>{e.number}</TableCell>
                                        <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                        {CAL_COLS.map((c, i) => (
                                          <TableCell key={`${c.key}-${i}`}>
                                            {c.editable ? (
                                              <Input className={styles.mini} disabled={!editable} value={(porEst[String(e.number)]?.[c.key] as string) ?? ''} onChange={(_, d) => setCal(a, e.number, c.key, d.value)} />
                                            ) : (
                                              <Text size={200} weight={c.key === 'situacion' ? 'semibold' : 'regular'}>{(cal[c.key] as string) || '—'}</Text>
                                            )}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </Card>
                        )
                      })}
                    </>
                  )}

                  {tab === 'promocion' && (
                    <>
                      <div className={styles.actions} style={{ marginBottom: '10px' }}>
                        <Button appearance="secondary" onClick={() => {
                          const promo: Record<string, Record<string, string>> = { ...(draft.promocion ?? {}) }
                          for (const a of asignaturasCurso) {
                            promo[a] = { ...(promo[a] ?? {}) }
                            for (const e of draft.estudiantes) {
                              const cal = deriveCal(draft.calificaciones?.[a]?.[String(e.number)] ?? {})
                              if (cal.situacion) promo[a][String(e.number)] = cal.situacion
                            }
                          }
                          setDraft({ ...draft, promocion: promo })
                        }}>Tomar situación de calificaciones</Button>
                        <Text size={200} style={{ color: 'var(--texto-suave)' }}>La situación final en grado es A si aprueba todas las asignaturas.</Text>
                      </div>
                      <div className={styles.scroll}>
                        <Table size="small">
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                              {asignaturasCurso.map((a) => <TableHeaderCell key={a} className={styles.th}>{a}</TableHeaderCell>)}
                              <TableHeaderCell className={styles.th}>Situación final en grado</TableHeaderCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.estudiantes.map((e) => {
                              const key = String(e.number)
                              const valores = asignaturasCurso.map((a) => draft.promocion?.[a]?.[key] ?? '')
                              const llenos = valores.filter(Boolean)
                              const final = llenos.length === 0 ? '' : llenos.every((v) => v === 'A') ? 'A' : 'R'
                              return (
                                <TableRow key={key}>
                                  <TableCell>{e.number}</TableCell>
                                  <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                  {asignaturasCurso.map((a) => (
                                    <TableCell key={a}>
                                      <Select value={draft.promocion?.[a]?.[key] ?? ''} onChange={(_, d) => setDraft({ ...draft, promocion: { ...(draft.promocion ?? {}), [a]: { ...(draft.promocion?.[a] ?? {}), [key]: d.value } } })}>
                                        <option value="">—</option>
                                        <option value="A">A</option>
                                        <option value="R">R</option>
                                      </Select>
                                    </TableCell>
                                  ))}
                                  <TableCell><Text weight="semibold">{final || '—'}</Text></TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}

                  {tab === 'aprendizajes' && (
                    <>
                      <div className={styles.actions} style={{ marginBottom: '10px' }}>
                        <Text weight="semibold">Periodo:</Text>
                        <Select value={periodoInicial} onChange={(_, d) => setPeriodoInicial(d.value)} style={{ maxWidth: '130px' }}>
                          {PERIODOS.map((p) => <option key={p.key} value={p.key}>Periodo {p.label}</option>)}
                        </Select>
                        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Escala: I (Iniciando), EP (en proceso), L (logrado), N/E (no evaluado).</Text>
                      </div>
                      <div className={styles.scroll}>
                        <Table size="small">
                          <TableHeader>
                            <TableRow>
                              <TableHeaderCell className={styles.th}>No.</TableHeaderCell>
                              <TableHeaderCell className={styles.th}>Estudiante</TableHeaderCell>
                              {DOMINIOS.map((d) => <TableHeaderCell key={d} className={styles.th}>Dominio {d}</TableHeaderCell>)}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.estudiantes.map((e) => {
                              const key = String(e.number)
                              const val = draft.inicial?.[periodoInicial]?.[key] ?? {}
                              return (
                                <TableRow key={key}>
                                  <TableCell>{e.number}</TableCell>
                                  <TableCell>{e.apellidos}, {e.nombres}</TableCell>
                                  {DOMINIOS.map((dom) => (
                                    <TableCell key={dom}>
                                      <Select value={val[dom] ?? ''} onChange={(_, d) => setDraft({ ...draft, inicial: { ...(draft.inicial ?? {}), [periodoInicial]: { ...(draft.inicial?.[periodoInicial] ?? {}), [key]: { ...val, [dom]: d.value } } } })}>
                                        {ESCALA_INICIAL.map((op) => <option key={op} value={op}>{op || '—'}</option>)}
                                      </Select>
                                    </TableCell>
                                  ))}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              {draft?.plantillaUrl && <Button appearance="secondary" as="a" href={draft.plantillaUrl} target="_blank" rel="noopener noreferrer" icon={<DocumentPdfRegular />}>Ver plantilla</Button>}
              <Button appearance="secondary" icon={<PeopleRegular />} disabled={busy} onClick={() => { if (draft) void preencher(draft).then(setDraft) }}>Prellenar con la plataforma</Button>
              <Button appearance="secondary" onClick={() => setDraft(null)}>Cerrar</Button>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <SaveRegular />} disabled={busy} onClick={() => void guardar()}>Guardar</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
