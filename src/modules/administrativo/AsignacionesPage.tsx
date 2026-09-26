import { useMemo, useRef, useState } from 'react'
import { Button, Card, Checkbox, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, CheckmarkCircleRegular, ArrowUploadRegular, ArrowDownloadRegular, EditRegular } from '@fluentui/react-icons'
import * as XLSX from 'xlsx'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId } from '../../utils/helpers'
import { asignaturaDe, cursoNombre, ordenarCursos, isRealSubject, nivelShort, gradoDe, seccionDe, cicloFromGrade, INICIAL_GRADOS, GRADOS, nivelDeTanda, gradoInicialDe } from '../../utils/academic'
import { expandPortalRoles } from '../../types/roles'
import type { Enrollment, GradeSection, SigerdReport, Student, TeacherAssignment } from '../../types'

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Valor especial del selector de curso: ver TODAS las asignaturas del docente. */
const TODOS_CURSOS = '__todas__'
/** Valor especial del selector de docente: ver TODOS los docentes. */
const TODOS_DOCENTES = '__todos__'

/** Número de grado tomando la PRIMERA mención (ej. "Quinto grado (3ro. Nivel Medio)" → 5). */
const numGradoSigerd = (g?: string): number | null => {
  const t = (g ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const re = /\b(1ro|1er|primero|primer|2do|2da|segundo|segunda|3ro|3er|tercero|tercera|4to|4ta|cuarto|cuarta|5to|5ta|quinto|quinta|6to|6ta|sexto|sexta)\b/
  const m = re.exec(t)
  if (!m) return null
  const x = m[1]
  if (/primero|primer|1ro|1er/.test(x)) return 1
  if (/segundo|segunda|2do|2da/.test(x)) return 2
  if (/tercero|tercera|3ro|3er/.test(x)) return 3
  if (/cuarto|cuarta|4to|4ta/.test(x)) return 4
  if (/quinto|quinta|5to|5ta/.test(x)) return 5
  if (/sexto|sexta|6to|6ta/.test(x)) return 6
  return null
}

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' },
  actions: { display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' },
  info: { display: 'flex', gap: '18px', flexWrap: 'wrap', background: tokens.colorNeutralBackground2, borderRadius: '10px', padding: '8px 12px' },
})

export function AsignacionesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, teachers, users, roleMeta, grades, subjects, periods, gradeById, subjectById, periodById, studentById, teacherById, userById, refreshCatalogs } = useApp()
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment, dataService.deleteEnrollment)
  const reportsCol = useCollection<SigerdReport>(dataService.getSigerdReports)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments, dataService.saveTeacherAssignment, dataService.deleteTeacherAssignment)
  const gradesCol = useCollection<GradeSection>(dataService.getGrades, dataService.saveGrade, dataService.deleteGrade)
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)

  const [tab, setTab] = useState('matriculas')
  const [busy, setBusy] = useState(false)

  const activePeriod = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''

  // Matrículas (filtro por Curso = Grado + Sección + Nivel, tal como en Gestión académica)
  const [mCurso, setMCurso] = useState('')
  const [mPeriod, setMPeriod] = useState(activePeriod)
  const [mStudents, setMStudents] = useState<string[]>([])
  const [importingExcel, setImportingExcel] = useState(false)
  const excelRef = useRef<HTMLInputElement>(null)
  const subjectExcelRef = useRef<HTMLInputElement>(null)
  const [importingSubjects, setImportingSubjects] = useState(false)
  const [sigNivel, setSigNivel] = useState('')
  const [manualCurso, setManualCurso] = useState('')
  const [manualAsig, setManualAsig] = useState<Record<string, boolean>>({})
  const [editEnr, setEditEnr] = useState<Enrollment | null>(null)
  const [editEnrCurso, setEditEnrCurso] = useState('')

  // Asignaciones docentes (filtros: Docente y Curso)
  const [dDocente, setDDocente] = useState(TODOS_DOCENTES)
  const [dCurso, setDCurso] = useState('')
  const [dAsignaturas, setDAsignaturas] = useState<string[]>([])

  // Docente encargado
  const [eCurso, setECurso] = useState('')
  const [eTeacher, setETeacher] = useState('')

  // Asignaturas del curso seleccionado (para Asignaciones docentes).
  const docenteCursoMaterias = useMemo(
    () => grades.filter((g) => isRealSubject(asignaturaDe(g)) && cursoNombre(g) === dCurso),
    [grades, dCurso],
  )
  const docenteCursoAsignaturas = useMemo(
    () => [...new Set(docenteCursoMaterias.map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b)),
    [docenteCursoMaterias],
  )
  // Asignaturas que el docente seleccionado imparte en cualquier curso (período activo),
  // ordenadas por curso y asignatura.
  const asignacionesDocente = useMemo(
    () => assignmentsCol.items
      .filter((a) => {
        if (dDocente !== TODOS_DOCENTES && a.teacherId !== dDocente) return false
        if (activePeriod && a.periodId !== activePeriod) return false
        return !!gradeById(a.gradeId)
      })
      .sort((a, b) => {
        const byCurso = cursoNombre(gradeById(a.gradeId) as GradeSection).localeCompare(cursoNombre(gradeById(b.gradeId) as GradeSection), 'es')
        if (byCurso !== 0) return byCurso
        return (subjectById(a.subjectId)?.name ?? a.subjectId).localeCompare(subjectById(b.subjectId)?.name ?? b.subjectId, 'es')
      }),
    [assignmentsCol.items, dDocente, activePeriod, gradeById, subjectById],
  )

  /** Asignaciones del docente, filtradas por el curso seleccionado (o todas si no hay curso). */
  const asignacionesDocenteFiltradas = useMemo(() => {
    if (!dCurso || dCurso === TODOS_CURSOS) return asignacionesDocente
    return asignacionesDocente.filter((a) => cursoNombre(gradeById(a.gradeId) as GradeSection) === dCurso)
  }, [asignacionesDocente, dCurso, gradeById])

  /** Todas las asignaturas que un docente tiene asignadas (sin importar el curso). */
  const asignaturasDeDocente = (teacherId: string) => {
    const set = new Set<string>()
    for (const a of assignmentsCol.items) {
      if (a.teacherId !== teacherId) continue
      if (activePeriod && a.periodId !== activePeriod) continue
      const g = gradeById(a.gradeId)
      if (g) set.add(asignaturaDe(g))
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }

  // Catálogo de cursos (Grado + Sección + Nivel) existentes en Gestión académica.
  const cursosCatalogo = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => ({ nombre: cursoNombre(g), curso: g })),
    [grades],
  )

  // Cursos con sus asignaturas (una entrada por curso, sin repetir), con su nivel.
  const cursosConAsignaturas = useMemo(() => {
    const map = new Map<string, { nivel: string; asignaturas: Set<string> }>()
    for (const g of grades) {
      if (!isRealSubject(asignaturaDe(g))) continue
      const curso = cursoNombre(g)
      if (!map.has(curso)) map.set(curso, { nivel: nivelShort(g.level), asignaturas: new Set() })
      map.get(curso)!.asignaturas.add(asignaturaDe(g))
    }
    return [...map.entries()]
      .map(([curso, v]) => ({ curso, nivel: v.nivel, asignaturas: [...v.asignaturas].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.curso.localeCompare(b.curso))
  }, [grades])

  const cursosPorNivel = useMemo(() => {
    const niveles = ['Primaria', 'Secundaria', 'Inicial', 'Otros']
    return niveles
      .map((nivel) => ({ nivel, cursos: cursosConAsignaturas.filter((c) => (nivel === 'Otros' ? !['Primaria', 'Secundaria', 'Inicial'].includes(c.nivel) : c.nivel === nivel)) }))
      .filter((g) => g.cursos.length > 0)
  }, [cursosConAsignaturas])

  // Asignaturas que ya tiene el curso seleccionado (para la gestión manual).
  const asignaturasDelCurso = useMemo(() => {
    if (!manualCurso) return []
    return [...new Set(grades.filter((g) => cursoNombre(g) === manualCurso && isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b))
  }, [grades, manualCurso])

  /** Agrega al curso seleccionado las asignaturas marcadas manualmente. */
  const agregarAsignaturasManual = async () => {
    if (!manualCurso) { toaster.dispatchToast('Selecciona un curso.', { intent: 'error' }); return }
    const elegidas = Object.entries(manualAsig).filter(([, v]) => v).map(([k]) => k)
    if (elegidas.length === 0) { toaster.dispatchToast('Marca al menos una asignatura.', { intent: 'error' }); return }
    const registros = grades.filter((g) => cursoNombre(g) === manualCurso)
    const template = registros.find((g) => isRealSubject(asignaturaDe(g))) ?? registros[0]
    if (!template) { toaster.dispatchToast('No se encontró el curso en Gestión académica.', { intent: 'error' }); return }
    setBusy(true)
    try {
      let creadas = 0
      const existentes = new Set(registros.map((g) => asignaturaDe(g).trim().toLowerCase()))
      for (const asig of elegidas) {
        if (existentes.has(asig.trim().toLowerCase())) continue
        await gradesCol.save({
          id: genId('g'),
          name: template.name,
          grado: template.grado ?? gradoDe(template),
          section: template.section ?? seccionDe(template),
          level: template.level,
          nivel: template.nivel ?? nivelShort(template.level),
          ciclo: template.ciclo,
          asignatura: asig,
        })
        creadas += 1
      }
      await Promise.all([gradesCol.refresh(), refreshCatalogs()])
      setManualAsig({})
      toaster.dispatchToast(`${creadas} asignatura(s) agregada(s) al curso.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudieron agregar las asignaturas.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Quita una asignatura del curso seleccionado. */
  const quitarAsignaturaManual = async (asig: string) => {
    setBusy(true)
    try {
      const targets = grades.filter((g) => cursoNombre(g) === manualCurso && asignaturaDe(g).trim().toLowerCase() === asig.trim().toLowerCase())
      for (const g of targets) await gradesCol.remove(g.id)
      await Promise.all([gradesCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`Asignatura "${asig}" quitada del curso.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo quitar la asignatura.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // Un curso es válido si su nombre sigue el patrón: "Grado.Sección" (Primaria/Secundaria) o el grado de Inicial.
  const esNombreValido = (g: GradeSection): boolean => {
    const nivel = nivelShort(g.level)
    const nombre = (g.name || '').trim()
    if (nivel === 'Inicial') {
      return INICIAL_GRADOS.some((gi) => gi.nombre.toLowerCase() === nombre.toLowerCase()) || /^(pre\s*-?\s*kinder|kinder|pre\s*-?\s*primaria)(\.[a-g])?$/i.test(nombre)
    }
    const grado = gradoDe(g)
    const sec = (g.section || seccionDe(g) || '').trim().toUpperCase()
    if (!grado || !/^[A-G]$/.test(sec)) return false
    return nombre.replace(/\s+/g, '').toUpperCase() === `${grado}.${sec}`.toUpperCase()
  }

  /** Elimina los cursos con nombre fuera de formato y asegura los de Inicial estándar. */
  const limpiarCursos = async () => {
    const invalidos = grades.filter((g) => !esNombreValido(g))
    if (invalidos.length === 0) {
      toaster.dispatchToast('No hay cursos con formato inválido.', { intent: 'info' })
      return
    }
    if (!window.confirm(`¿Eliminar ${invalidos.length} curso(s) con nombre fuera del formato (p. ej. ${invalidos.slice(0, 3).map((x) => x.name).join(', ')})?`)) return
    setImportingSubjects(true)
    try {
      for (const g of invalidos) await dataService.deleteGrade(g.id)
      const existentes = new Set((gradesCol.items.length ? gradesCol.items : grades).map((g) => cursoNombre(g)))
      let creadosIni = 0
      for (const gi of INICIAL_GRADOS) {
        const objetivo = `${gi.nombre} · Inicial`
        if (existentes.has(objetivo)) continue
        await dataService.saveGrade({ id: genId('g'), name: gi.nombre, grado: gi.nombre, level: 'Nivel Inicial', nivel: 'Inicial', asignatura: 'Asignaturas Generales', edad: gi.edad })
        creadosIni += 1
      }
      await Promise.all([gradesCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(`Se eliminaron ${invalidos.length} curso(s) inválido(s)${creadosIni ? ` y se crearon ${creadosIni} curso(s) de Inicial` : ''}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron limpiar los cursos.', { intent: 'error' })
    } finally {
      setImportingSubjects(false)
    }
  }
  // Cursos con docente encargado, filtrados por el curso y/o docente seleccionados.
  const cursosEncargado = useMemo(
    () => cursosCatalogo.filter((c) => {
      if (eCurso) return c.nombre === eCurso && !!c.curso.leadTeacherId
      if (eTeacher) return c.curso.leadTeacherId === eTeacher
      return !!c.curso.leadTeacherId
    }),
    [cursosCatalogo, eCurso, eTeacher],
  )
  /** Nombre visible de un docente o de un usuario con acceso al portal Docente. */
  const nombreDocente = (id?: string) => (id ? teacherById(id)?.fullName ?? userById(id)?.displayName ?? '—' : '')

  const encargadoTitulo = eCurso
    ? `Curso: ${eCurso}`
    : eTeacher
      ? `Cursos de ${nombreDocente(eTeacher)} como encargado`
      : 'Cursos con docente encargado'
  const cursoSel = cursosCatalogo.find((c) => c.nombre === mCurso)?.curso
  const periodActive = periods.find((p) => p.id === mPeriod)?.isActive ?? false

  // Asignaturas que pertenecen al curso seleccionado (según Gestión académica).
  const cursoMaterias = useMemo(
    () => grades.filter((g) => isRealSubject(asignaturaDe(g)) && cursoNombre(g) === mCurso),
    [grades, mCurso],
  )
  const cursoAsignaturas = useMemo(
    () => [...new Set(cursoMaterias.map((g) => asignaturaDe(g)))].sort((a, b) => a.localeCompare(b)),
    [cursoMaterias],
  )

  // Matrículas del curso seleccionado en el período (solo estudiantes de ese curso).
  const matriculasCurso = useMemo(() => {
    if (!mCurso) return []
    return enrollmentsCol.items.filter((e) => {
      if (mPeriod && e.periodId !== mPeriod) return false
      const g = gradeById(e.gradeId)
      return !!g && cursoNombre(g) === mCurso
    })
  }, [enrollmentsCol.items, mCurso, mPeriod, gradeById])
  const studentOptions = useMemo(() => students.map((s) => ({ id: s.id, label: s.fullName, detail: s.email })), [students])

  // Usuarios con acceso al portal Docente: rol fijo «docente» o rol personalizado
  // cuyo portal sea «docente». Deben aparecer aunque no tengan ficha de docente.
  const portalDocenteUsers = useMemo(
    () => users.filter((u) => expandPortalRoles(u.roles, roleMeta).includes('docente')),
    [users, roleMeta],
  )

  /** Docentes = fichas de docente + usuarios con acceso al portal Docente (sin duplicar). */
  const teacherOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; detail?: string }>()
    const emails = new Set<string>()
    for (const t of teachers) {
      byId.set(t.id, { id: t.id, label: t.fullName, detail: t.email })
      if (t.email) emails.add(t.email.trim().toLowerCase())
    }
    for (const u of portalDocenteUsers) {
      const linked = teachers.find((t) => t.id === u.teacherId) ?? teachers.find((t) => t.userId === u.id) ?? teachers.find((t) => sameEmail(t.email, u.email))
      const id = linked?.id ?? u.id
      if (byId.has(id)) continue
      if (u.email && emails.has(u.email.trim().toLowerCase())) continue
      byId.set(id, { id, label: linked?.fullName ?? u.displayName, detail: u.email })
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [teachers, portalDocenteUsers])
  // ---------------------------------------------------------------- Matrículas en lote
  const matricular = async () => {
    if (!mCurso || !mPeriod || !periodActive) {
      toaster.dispatchToast('Selecciona un curso y un período/año educativo activo.', { intent: 'error' })
      return
    }
    if (cursoMaterias.length === 0) {
      toaster.dispatchToast('El curso no tiene asignaturas registradas en Gestión académica.', { intent: 'error' })
      return
    }
    if (mStudents.length === 0) {
      toaster.dispatchToast('Selecciona al menos un estudiante.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let created = 0
      let skipped = 0
      const conflicts: string[] = []
      for (const studentId of mStudents) {
        const existing = enrollmentsCol.items.filter((e) => e.studentId === studentId && e.periodId === mPeriod)
        // Regla: un estudiante solo puede estar en UN curso por período.
        const otherCourse = existing.some((e) => {
          const g = gradeById(e.gradeId)
          return g && cursoNombre(g) !== mCurso
        })
        if (otherCourse) {
          conflicts.push(studentById(studentId)?.fullName ?? '—')
          continue
        }
        const already = existing.some((e) => {
          const g = gradeById(e.gradeId)
          return g && cursoNombre(g) === mCurso
        })
        if (already) { skipped += 1; continue }
        // Una sola matrícula por estudiante = el curso completo (todas sus asignaturas).
        await enrollmentsCol.save({ id: genId('enr'), studentId, gradeId: cursoMaterias[0].id, periodId: mPeriod })
        created += 1
      }
      const extra = conflicts.length ? ` No se matricularon (ya están en otro curso): ${conflicts.join(', ')}.` : ''
      toaster.dispatchToast(`${created} matrícula(s) creada(s)${skipped ? `; ${skipped} ya existían` : ''}.${extra}`, { intent: conflicts.length ? 'warning' : 'success' })
      setMStudents([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron crear las matrículas.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Desmatricula a los estudiantes seleccionados del curso elegido. */
  const desmatricularSeleccionados = async () => {
    if (!mCurso || mStudents.length === 0) {
      toaster.dispatchToast('Selecciona un curso y los estudiantes a desmatricular.', { intent: 'error' })
      return
    }
    if (!window.confirm('¿Desmatricular a los estudiantes seleccionados de este curso?')) return
    setBusy(true)
    try {
      const targets = enrollmentsCol.items.filter((e) => {
        if (e.periodId !== mPeriod || !mStudents.includes(e.studentId)) return false
        const g = gradeById(e.gradeId)
        return !!g && cursoNombre(g) === mCurso
      })
      for (const e of targets) await enrollmentsCol.remove(e.id)
      toaster.dispatchToast(`${targets.length} matrícula(s) eliminada(s).`, { intent: 'success' })
      setMStudents([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron eliminar las matrículas.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Desmatricula a TODOS los estudiantes del curso seleccionado. */
  const desmatricularTodosCurso = async () => {
    if (!mCurso) {
      toaster.dispatchToast('Selecciona un curso.', { intent: 'error' })
      return
    }
    if (!window.confirm('¿Desmatricular a TODOS los estudiantes del curso seleccionado?')) return
    setBusy(true)
    try {
      const targets = enrollmentsCol.items.filter((e) => {
        if (e.periodId !== mPeriod) return false
        const g = gradeById(e.gradeId)
        return !!g && cursoNombre(g) === mCurso
      })
      for (const e of targets) await enrollmentsCol.remove(e.id)
      toaster.dispatchToast(`${targets.length} matrícula(s) eliminada(s).`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron eliminar las matrículas.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Matrícula masiva desde un archivo Excel con los estudiantes del curso. */
  const matricularDesdeExcel = async (file: File | undefined) => {
    if (!file) return
    if (!mCurso || !periodActive || cursoMaterias.length === 0) {
      toaster.dispatchToast('Selecciona un curso con asignaturas y un período activo.', { intent: 'error' })
      return
    }
    setImportingExcel(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

      // Extrae nombre y correo de cada fila (cualquier columna).
      const ids: Array<{ name: string; email: string }> = []
      for (const row of rows) {
        let name = ''
        let email = ''
        for (const v of Object.values(row)) {
          const val = String(v ?? '').trim()
          if (!val) continue
          if (!email && val.includes('@')) email = val
          else if (!name && !/^\d+([.,]\d+)?$/.test(val)) name = val
        }
        if (name || email) ids.push({ name, email })
      }

      const byEmail = new Map(students.filter((s) => s.email).map((s) => [norm(s.email as string), s]))
      const byName = new Map(students.map((s) => [norm(s.fullName), s]))
      const matched: Student[] = []
      const notFound: string[] = []
      for (const id of ids) {
        const st = (id.email && byEmail.get(norm(id.email))) || (id.name && byName.get(norm(id.name))) || undefined
        if (st) matched.push(st)
        else notFound.push(id.name || id.email)
      }

      let created = 0
      let skipped = 0
      const conflicts: string[] = []
      for (const st of matched) {
        const existing = enrollmentsCol.items.filter((e) => e.studentId === st.id && (!activePeriod || e.periodId === activePeriod))
        const otherCourse = existing.some((e) => { const g = gradeById(e.gradeId); return g && cursoNombre(g) !== mCurso })
        if (otherCourse) { conflicts.push(st.fullName); continue }
        const already = existing.some((e) => { const g = gradeById(e.gradeId); return g && cursoNombre(g) === mCurso })
        if (already) { skipped += 1; continue }
        await enrollmentsCol.save({ id: genId('enr'), studentId: st.id, gradeId: cursoMaterias[0].id, periodId: activePeriod })
        created += 1
      }
      toaster.dispatchToast(
        `Excel: ${created} matriculado(s)${skipped ? `, ${skipped} ya estaban` : ''}${notFound.length ? `, ${notFound.length} no encontrado(s): ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '…' : ''}` : ''}${conflicts.length ? `, ${conflicts.length} en otro curso` : ''}.`,
        { intent: notFound.length || conflicts.length ? 'warning' : 'success' },
      )
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo leer el archivo Excel.', { intent: 'error' })
    } finally {
      setImportingExcel(false)
      if (excelRef.current) excelRef.current.value = ''
    }
  }

  const abrirEdicionMatricula = (e: Enrollment) => {
    const g = gradeById(e.gradeId)
    setEditEnr(e)
    setEditEnrCurso(g ? cursoNombre(g) : '')
  }

  const guardarEdicionMatricula = async () => {
    if (!editEnr || !editEnrCurso) return
    const rep = grades.find((g) => cursoNombre(g) === editEnrCurso)
    if (!rep) {
      toaster.dispatchToast('Curso no válido.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      await enrollmentsCol.save({ ...editEnr, gradeId: rep.id })
      const st = studentsCol.items.find((s) => s.id === editEnr.studentId)
      if (st) await studentsCol.save({ ...st, gradeId: rep.id })
      toaster.dispatchToast('Matrícula actualizada.', { intent: 'success' })
      setEditEnr(null)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo actualizar la matrícula.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // ---------------------------------------------------------------- Asignaturas por curso (Excel)
  /** Descarga un Excel con un curso por fila: columna A = curso, columnas B, C, D… = sus asignaturas. */
  const exportarAsignaturasPorCurso = () => {
    const porCurso = cursosCatalogo.map((c) => ({
      curso: c.nombre,
      materias: [...new Set(grades.filter((g) => cursoNombre(g) === c.nombre && isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))]
        .sort((a, b) => a.localeCompare(b)),
    }))
    if (porCurso.length === 0) {
      toaster.dispatchToast('No hay cursos registrados para exportar.', { intent: 'error' })
      return
    }
    const maxMaterias = Math.max(1, ...porCurso.map((c) => c.materias.length))
    const header = ['Curso', ...Array.from({ length: maxMaterias }, (_, i) => `Asignatura ${i + 1}`)]
    const rows: string[][] = [header, ...porCurso.map((c) => [c.curso, ...c.materias])]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 34 }, ...Array.from({ length: maxMaterias }, () => ({ wch: 26 }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Asignaturas por curso')
    XLSX.writeFile(wb, `Asignaturas_por_curso_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toaster.dispatchToast(`${porCurso.length} curso(s) exportado(s). Cada asignatura va en una columna (B, C, D…).`, { intent: 'success' })
  }

  /** Carga el Excel (un curso por fila) y deja cada curso con única y exclusivamente las asignaturas indicadas. */
  const importarAsignaturasPorCurso = async (file: File | undefined) => {
    if (!file) return
    setImportingSubjects(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      const grupos = new Map<string, Set<string>>()
      for (const r of rows) {
        const curso = String(r?.[0] ?? '').trim()
        if (!curso || /^curso$/i.test(curso)) continue
        if (!grupos.has(curso)) grupos.set(curso, new Set())
        // Todas las columnas desde la B son asignaturas del curso.
        for (let i = 1; i < (r?.length ?? 0); i++) {
          const asig = String(r[i] ?? '').trim()
          if (asig && !/^asignatura/i.test(asig)) grupos.get(curso)!.add(asig)
        }
      }
      if (grupos.size === 0) {
        toaster.dispatchToast('El Excel no contiene cursos (columna A) ni asignaturas (columnas B, C…).', { intent: 'error' })
        return
      }
      let creadas = 0
      let eliminadas = 0
      let cursosCreados = 0
      const noEncontrados: string[] = []
      for (const [curso, setAsig] of grupos) {
        const registros = grades.filter((g) => cursoNombre(g) === curso)
        // Curso nuevo: se crea con exactamente las asignaturas del Excel.
        if (registros.length === 0) {
          if (setAsig.size === 0) { noEncontrados.push(curso); continue }
          const [base, nivelRaw = ''] = curso.split(' · ')
          const temp = { id: '', name: base, level: nivelRaw } as GradeSection
          const grado = gradoDe(temp)
          const section = grado ? seccionDe(temp) : base
          for (const asig of setAsig) {
            await dataService.saveGrade({
              id: genId('g'),
              name: base,
              grado: grado || undefined,
              section,
              level: nivelRaw,
              nivel: nivelShort(nivelRaw),
              ciclo: cicloFromGrade(nivelRaw, grado),
              asignatura: asig,
            })
            creadas += 1
          }
          cursosCreados += 1
          continue
        }
        const template = registros.find((g) => isRealSubject(asignaturaDe(g))) ?? registros[0]
        const setLower = new Set([...setAsig].map((a) => a.toLowerCase()))
        // Quita las asignaturas que ya no están en el Excel (deja intactos otros registros del curso).
        for (const g of registros) {
          const nombre = asignaturaDe(g)
          if (isRealSubject(nombre) && !setLower.has(nombre.toLowerCase())) {
            await dataService.deleteGrade(g.id)
            eliminadas += 1
          }
        }
        // Agrega las asignaturas nuevas.
        for (const asig of setAsig) {
          if (registros.some((g) => asignaturaDe(g).toLowerCase() === asig.toLowerCase())) continue
          await dataService.saveGrade({
            id: genId('g'),
            name: template.name,
            grado: template.grado ?? gradoDe(template),
            section: template.section ?? seccionDe(template),
            level: template.level,
            nivel: template.nivel ?? nivelShort(template.level),
            ciclo: template.ciclo,
            asignatura: asig,
          })
          creadas += 1
        }
      }
      await Promise.all([gradesCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(
        `Asignaturas actualizadas: ${creadas} agregada(s), ${eliminadas} quitada(s)${cursosCreados ? `, ${cursosCreados} curso(s) creado(s)` : ''}${noEncontrados.length ? `. Cursos sin asignaturas: ${noEncontrados.slice(0, 5).join(', ')}${noEncontrados.length > 5 ? '…' : ''}` : ''}.`,
        { intent: noEncontrados.length ? 'warning' : 'success' },
      )
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo procesar el Excel.', { intent: 'error' })
    } finally {
      setImportingSubjects(false)
      if (subjectExcelRef.current) subjectExcelRef.current.value = ''
    }
  }

  // ---------------------------------------------------------------- Asignaciones docentes
  const asignarSeleccionadas = async () => {
    if (!dCurso || dCurso === TODOS_CURSOS || !dDocente || dAsignaturas.length === 0) {
      toaster.dispatchToast('Selecciona un docente, un curso y al menos una asignatura.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let created = 0
      let skipped = 0
      for (const name of dAsignaturas) {
        const grade = docenteCursoMaterias.find((g) => asignaturaDe(g) === name)
        if (!grade) continue
        const subjectId = subjects.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?.id ?? name
        const dup = assignmentsCol.items.some(
          (a) => a.teacherId === dDocente && a.gradeId === grade.id && a.subjectId === subjectId && (!activePeriod || a.periodId === activePeriod),
        )
        if (dup) { skipped += 1; continue }
        await assignmentsCol.save({ id: genId('ta'), teacherId: dDocente, gradeId: grade.id, subjectId, periodId: activePeriod })
        created += 1
      }
      toaster.dispatchToast(`${created} asignatura(s) asignada(s)${skipped ? `; ${skipped} ya estaban` : ''}.`, { intent: 'success' })
      setDAsignaturas([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron asignar las asignaturas.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const quitarAsignacion = async (a: TeacherAssignment) => {
    try {
      await assignmentsCol.remove(a.id)
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo eliminar.', { intent: 'error' })
    }
  }

  const eliminarTodasAsignaciones = async () => {
    if (assignmentsCol.items.length === 0) return
    if (!window.confirm('¿Eliminar TODAS las asignaciones de docentes para iniciar desde cero?')) return
    setBusy(true)
    try {
      for (const a of assignmentsCol.items) await assignmentsCol.remove(a.id)
      toaster.dispatchToast('Se eliminaron todas las asignaciones de docentes.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron eliminar las asignaciones.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // ---------------------------------------------------------------- Docente encargado
  const asignarEncargado = async () => {
    if (!eCurso || !eTeacher) {
      toaster.dispatchToast('Selecciona curso y docente encargado.', { intent: 'error' })
      return
    }
    const materias = grades.filter((g) => cursoNombre(g) === eCurso)
    if (materias.length === 0) {
      toaster.dispatchToast('El curso no tiene registros en Gestión académica.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      for (const g of materias) await gradesCol.save({ ...g, leadTeacherId: eTeacher })
      toaster.dispatchToast(`Docente encargado asignado en ${eCurso}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo asignar el encargado.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const quitarEncargado = async (curso: string) => {
    const materias = grades.filter((g) => cursoNombre(g) === curso)
    setBusy(true)
    try {
      for (const g of materias) await gradesCol.save({ ...g, leadTeacherId: undefined })
      toaster.dispatchToast('Docente encargado removido.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo remover.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  /** Matricula a los estudiantes de Inicial/Primaria/Secundaria desde los listados SIGERD subidos. */
  const matricularDesdeSigerd = async (nivel: string) => {
    const nivelReporte = (r: SigerdReport) => nivelShort(r.nivel ?? nivelDeTanda(r.header.tandaServicio) ?? '')
    const reports = reportsCol.items.filter((r) => !nivel || nivelReporte(r) === nivel)
    if (reports.length === 0) { toaster.dispatchToast('No hay listados SIGERD para ese nivel. Súbelos en SIGERD.', { intent: 'error' }); return }
    const reportIds = new Set(reports.map((r) => r.id))
    setBusy(true)
    try {
      let ok = 0
      let sinCurso = 0
      let ya = 0
      let considerados = 0
      for (const s of students) {
        const rep = s.sigerdReportId ? reportsCol.items.find((r) => r.id === s.sigerdReportId) : undefined
        const nivelEst = s.sigerd?.nivel ? nivelShort(s.sigerd.nivel) : (rep ? nivelReporte(rep) : '')
        if (nivel && nivelEst && nivelEst !== nivel) continue
        if (nivel && !nivelEst && !reportIds.has(s.sigerdReportId ?? '')) continue
        considerados += 1
        const gi = gradoInicialDe(s.sigerd?.grado)
        let curso: GradeSection | undefined
        if (gi) {
          const sec = (s.sigerd?.seccion ?? rep?.header.seccion ?? 'A').trim().toUpperCase()
          curso = grades.find((g) => nivelShort(g.level) === 'Inicial' && gradoDe(g) === gi.nombre && seccionDe(g) === sec)
            ?? grades.find((g) => nivelShort(g.level) === 'Inicial' && gradoDe(g) === gi.nombre)
        } else {
          const n = numGradoSigerd(s.sigerd?.grado) ?? numGradoSigerd(rep?.header.grado)
          const sec = (s.sigerd?.seccion ?? rep?.header.seccion ?? '').trim().toUpperCase()
          if (n) {
            curso = grades.find((g) => cursoNombre(g) === `${GRADOS[n - 1]}.${sec}${nivelEst ? ` · ${nivelEst}` : ''}`)
              ?? grades.find((g) => gradoDe(g) === GRADOS[n - 1] && seccionDe(g) === sec && (!nivelEst || nivelShort(g.level) === nivelEst))
              ?? grades.find((g) => gradoDe(g) === GRADOS[n - 1] && seccionDe(g) === sec)
          }
        }
        if (!curso) { sinCurso += 1; continue }
        const matriculado = enrollmentsCol.items.some((e) => e.studentId === s.id && (!activePeriod || e.periodId === activePeriod))
        if (matriculado) { ya += 1; continue }
        await enrollmentsCol.save({ id: genId('enr'), studentId: s.id, gradeId: curso.id, periodId: activePeriod })
        if (s.gradeId !== curso.id) await dataService.saveStudent({ ...s, gradeId: curso.id })
        ok += 1
      }
      await Promise.all([enrollmentsCol.refresh(), refreshCatalogs()])
      toaster.dispatchToast(
        `SIGERD: ${considerados} estudiante(s) considerados · ${ok} matriculado(s) · ${ya} ya matriculados · ${sinCurso} sin curso identificable.`,
        { intent: considerados === 0 ? 'warning' : 'success' },
      )
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo matricular desde SIGERD.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Asignaciones"
        subtitle="Matricula estudiantes y asigna docentes en lote por curso, asignatura y período. Curso y grado son lo mismo."
      />

      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="matriculas">Matrículas de estudiantes ({enrollmentsCol.items.length})</Tab>
        <Tab value="docentes">Asignaciones docentes ({assignmentsCol.items.length})</Tab>
        <Tab value="encargado">Docente encargado por curso</Tab>
        <Tab value="matricular">Matricular estudiantes seleccionados</Tab>
        <Tab value="asignaturas">Agregar asignaturas por curso</Tab>
      </TabList>

      {/* ------------------------------ Matrículas ------------------------------ */}
      {tab === 'matriculas' && (
        <>
          <Card className={styles.card}>
            <FieldRow>
              <FormField label="Curso" required>
                <Select value={mCurso} onChange={(_, d) => setMCurso(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Período" required hint={periodActive ? 'Período activo' : 'Debe ser un período ACTIVO'}>
                <Select value={mPeriod} onChange={(_, d) => setMPeriod(d.value)}>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            {cursoSel && (
              <div className={styles.info}>
                <Text size={200}><strong>Nivel:</strong> {nivelShort(cursoSel.level)}</Text>
                <Text size={200}><strong>Ciclo:</strong> {cursoSel.ciclo || cicloFromGrade(cursoSel.level, gradoDe(cursoSel)) || '—'}</Text>
                <Text size={200}><strong>Grado:</strong> {gradoDe(cursoSel)}</Text>
                <Text size={200}><strong>Sección:</strong> {seccionDe(cursoSel)}</Text>
              </div>
            )}
            <Text weight="semibold" size={300} block>Asignaturas del curso ({cursoAsignaturas.length})</Text>
            {!mCurso ? (
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>Selecciona un curso para ver sus asignaturas.</Text>
            ) : cursoAsignaturas.length === 0 ? (
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Este curso no tiene asignaturas registradas en Gestión académica.</Text>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {cursoAsignaturas.map((s) => (
                  <span key={s} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '3px 12px' }}><Text size={200}>{s}</Text></span>
                ))}
              </div>
            )}

          </Card>

          <Card className={styles.card}>
            <Text weight="semibold" size={300}>Matricular desde SIGERD (listados PDF)</Text>
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>
              Matricula a los estudiantes de Inicial, Primaria o Secundaria según los listados subidos en SIGERD, en el curso que les corresponde (grado + sección).
            </Text>
            <FieldRow>
              <FormField label="Nivel">
                <Select value={sigNivel} onChange={(_, d) => setSigNivel(d.value)} style={{ maxWidth: '260px' }}>
                  <option value="">Todos los niveles</option>
                  <option value="Inicial">Inicial</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                </Select>
              </FormField>
            </FieldRow>
            <div className={styles.actions}>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void matricularDesdeSigerd(sigNivel)}>
                {busy ? 'Procesando…' : 'Matricular desde SIGERD'}
              </Button>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <Button appearance="secondary" icon={<DeleteRegular />} disabled={busy || !mCurso || mStudents.length === 0} onClick={() => void desmatricularSeleccionados()}>
              Vaciar matrícula por estudiantes
            </Button>
            <Button appearance="secondary" icon={<DeleteRegular />} disabled={busy || !mCurso} onClick={() => void desmatricularTodosCurso()}>
              Vaciar matrícula todos los estudiantes
            </Button>
          </div>

          {enrollmentsCol.loading ? (
            <Spinner label="Cargando matrículas…" />
          ) : !mCurso ? (
            <EmptyStateView title="Sin curso seleccionado" message="Selecciona un curso para ver sus estudiantes matriculados." />
          ) : matriculasCurso.length === 0 ? (
            <EmptyStateView title="Sin estudiantes" message="Este curso no tiene estudiantes matriculados." />
          ) : (
            <Table aria-label="Matrículas">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Estudiante</TableHeaderCell>
                  <TableHeaderCell>Curso</TableHeaderCell>
                  <TableHeaderCell>Asignatura</TableHeaderCell>
                  <TableHeaderCell>Período</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriculasCurso.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><Text weight="semibold">{studentById(e.studentId)?.fullName ?? '—'}</Text></TableCell>
                    <TableCell>{gradeById(e.gradeId) ? cursoNombre(gradeById(e.gradeId) as GradeSection) : e.gradeId}</TableCell>
                    <TableCell>{e.subjectId ? subjectById(e.subjectId)?.name ?? e.subjectId : 'Todas'}</TableCell>
                    <TableCell>{periodById(e.periodId)?.name ?? e.periodId}</TableCell>
                    <TableCell>
                      <Toolbar size="small">
                        <ToolbarButton icon={<EditRegular />} onClick={() => abrirEdicionMatricula(e)}>Editar</ToolbarButton>
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => void enrollmentsCol.remove(e.id)}>Desmatricular</ToolbarButton>
                      </Toolbar>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* ------------------------------ Docentes ------------------------------ */}
      {tab === 'docentes' && (
        <>
          <Card className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button appearance="secondary" icon={<DeleteRegular />} disabled={busy || assignmentsCol.items.length === 0} onClick={() => void eliminarTodasAsignaciones()}>
                Eliminar todas las asignaciones
              </Button>
            </div>
            <FieldRow>
              <FormField label="Curso" required hint="Al seleccionarlo se muestran sus asignaturas.">
                <Select value={dCurso} onChange={(_, d) => { setDCurso(d.value); setDAsignaturas([]) }}>
                  <option value="">— Selecciona un curso —</option>
                  <option value={TODOS_CURSOS}>Todas las asignaturas</option>
                  {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Docente" hint="Al seleccionarlo se muestran TODAS sus asignaturas asignadas (cualquier curso).">
                <Select value={dDocente} onChange={(_, d) => { setDDocente(d.value); setDAsignaturas(d.value && d.value !== TODOS_DOCENTES ? asignaturasDeDocente(d.value) : []) }}>
                  <option value={TODOS_DOCENTES}>Todos los docentes</option>
                  {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </FormField>
            </FieldRow>

            {dDocente !== TODOS_DOCENTES ? (
              <>
                <MultiSelect
                  label={`Asignaturas asignadas a ${teacherById(dDocente)?.fullName ?? ''} (${asignaturasDeDocente(dDocente).length})`}
                  options={asignaturasDeDocente(dDocente).map((n) => ({ id: n, label: n }))}
                  selected={dAsignaturas}
                  onChange={setDAsignaturas}
                  placeholder="Filtrar asignaturas…"
                  emptyMessage="Este docente no tiene asignaturas asignadas."
                />
                <div className={styles.actions}>
                  <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || dAsignaturas.length === 0 || !dCurso || dCurso === TODOS_CURSOS} onClick={() => void asignarSeleccionadas()}>
                    {busy ? 'Procesando…' : 'Asignar seleccionadas al curso'}
                  </Button>
                  {(!dCurso || dCurso === TODOS_CURSOS) && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Selecciona un curso para asignar.</Text>}
                </div>
              </>
            ) : dCurso ? (
              <>
                <Text weight="semibold" size={300} block>Asignaturas del curso ({docenteCursoAsignaturas.length})</Text>
                {docenteCursoAsignaturas.length === 0 ? (
                  <Text size={200} style={{ color: 'var(--texto-suave)' }}>Este curso no tiene asignaturas registradas.</Text>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {docenteCursoAsignaturas.map((s) => (
                      <span key={s} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '3px 12px' }}><Text size={200}>{s}</Text></span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>Selecciona un curso o un docente para ver sus asignaturas.</Text>
            )}
          </Card>

          {dDocente && (
            <>
              <Text weight="semibold" size={300} block style={{ marginBottom: '8px' }}>
                {dDocente === TODOS_DOCENTES ? 'Asignaturas de todos los docentes' : `Asignaturas de ${nombreDocente(dDocente)}`}{dCurso && dCurso !== TODOS_CURSOS ? ` en ${dCurso}` : ''} ({asignacionesDocenteFiltradas.length})
              </Text>
              {asignacionesDocenteFiltradas.length === 0 ? (
                <EmptyStateView title="Sin asignaturas" message={dCurso && dCurso !== TODOS_CURSOS ? (dDocente === TODOS_DOCENTES ? 'No hay asignaciones en el curso seleccionado.' : 'Este docente no tiene asignaturas en el curso seleccionado.') : (dDocente === TODOS_DOCENTES ? 'No hay asignaciones registradas.' : 'Este docente no tiene asignaturas asignadas.')} />
              ) : (
                <Table aria-label="Asignaturas del docente">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Docente</TableHeaderCell>
                      <TableHeaderCell>Curso</TableHeaderCell>
                      <TableHeaderCell>Asignatura</TableHeaderCell>
                      <TableHeaderCell>Período</TableHeaderCell>
                      <TableHeaderCell>Acciones</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asignacionesDocenteFiltradas.map((a) => {
                      const g = gradeById(a.gradeId)
                      return (
                        <TableRow key={a.id}>
                          <TableCell><Text weight="semibold">{nombreDocente(a.teacherId)}</Text></TableCell>
                          <TableCell>{g ? cursoNombre(g) : a.gradeId}</TableCell>
                          <TableCell>{subjectById(a.subjectId)?.name ?? a.subjectId}</TableCell>
                          <TableCell>{periodById(a.periodId)?.name ?? a.periodId}</TableCell>
                          <TableCell>
                            <Toolbar size="small">
                              <ToolbarButton icon={<DeleteRegular />} onClick={() => void quitarAsignacion(a)} aria-label="Eliminar" />
                            </Toolbar>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </>
      )}

      {/* ------------------------------ Docente encargado ------------------------------ */}
      {tab === 'encargado' && (
        <>
          <Card className={styles.card}>
            <FieldRow>
              <FormField label="Curso" required hint="Cursos creados en Gestión académica.">
                <Select value={eCurso} onChange={(_, d) => setECurso(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Docente encargado" required>
                <Select value={eTeacher} onChange={(_, d) => setETeacher(d.value)}>
                  <option value="">— Selecciona un docente —</option>
                  {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <div className={styles.actions}>
              <Button appearance="primary" icon={<CheckmarkCircleRegular />} onClick={() => void asignarEncargado()}>Asignar encargado</Button>
            </div>
          </Card>

          <Text weight="semibold" size={300} block style={{ marginBottom: '8px' }}>{encargadoTitulo}</Text>
          {cursosEncargado.length > 0 ? (
          <Table aria-label="Docente encargado por curso">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Curso (grado)</TableHeaderCell>
                <TableHeaderCell>Docente encargado</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cursosEncargado.map((c) => {
                const lead = c.curso.leadTeacherId
                return (
                  <TableRow key={c.nombre}>
                    <TableCell><Text weight="semibold">{c.nombre}</Text></TableCell>
                    <TableCell>{lead ? nombreDocente(lead) : <Text style={{ color: tokens.colorNeutralForeground2 }}>Sin asignar</Text>}</TableCell>
                    <TableCell>
                      <Toolbar size="small">
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => void quitarEncargado(c.nombre)} aria-label="Quitar encargado" disabled={!lead} />
                      </Toolbar>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          ) : (
            <EmptyStateView title="Sin docentes encargados" message="Asigna un docente encargado a un curso para verlo aquí." />
          )}
        </>
      )}

      {/* ------------------------------ Matricular estudiantes ------------------------------ */}
      {tab === 'matricular' && (
        <Card className={styles.card}>
          <FieldRow>
            <FormField label="Curso" required>
              <Select value={mCurso} onChange={(_, d) => setMCurso(d.value)}>
                <option value="">— Selecciona un curso —</option>
                {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
              </Select>
            </FormField>
            <FormField label="Período" required hint={periodActive ? 'Período activo' : 'Debe ser un período ACTIVO'}>
              <Select value={mPeriod} onChange={(_, d) => setMPeriod(d.value)}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
              </Select>
            </FormField>
          </FieldRow>
          {cursoSel && (
            <div className={styles.info}>
              <Text size={200}><strong>Nivel:</strong> {nivelShort(cursoSel.level)}</Text>
              <Text size={200}><strong>Ciclo:</strong> {cursoSel.ciclo || cicloFromGrade(cursoSel.level, gradoDe(cursoSel)) || '—'}</Text>
              <Text size={200}><strong>Grado:</strong> {gradoDe(cursoSel)}</Text>
              <Text size={200}><strong>Sección:</strong> {seccionDe(cursoSel)}</Text>
            </div>
          )}
          <Text weight="semibold" size={300} block>Asignaturas del curso ({cursoAsignaturas.length})</Text>
          {!mCurso ? (
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>Selecciona un curso para ver sus asignaturas.</Text>
          ) : cursoAsignaturas.length === 0 ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Este curso no tiene asignaturas registradas en Gestión académica.</Text>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {cursoAsignaturas.map((s) => (
                <span key={s} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '3px 12px' }}><Text size={200}>{s}</Text></span>
              ))}
            </div>
          )}
          <MultiSelect
            label="Estudiantes a matricular"
            options={studentOptions}
            selected={mStudents}
            onChange={setMStudents}
            placeholder="Filtrar estudiantes…"
            emptyMessage="No hay estudiantes en el catálogo."
          />
          <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => void matricularDesdeExcel(e.target.files?.[0])} />
          <div className={styles.actions}>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || !periodActive || cursoMaterias.length === 0 || mStudents.length === 0} onClick={() => void matricular()}>
              {busy ? 'Procesando…' : `Matricular seleccionados (${mStudents.length})`}
            </Button>
            <Button appearance="secondary" icon={importingExcel ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={importingExcel || !mCurso || !periodActive || cursoMaterias.length === 0} onClick={() => excelRef.current?.click()}>
              {importingExcel ? 'Procesando…' : 'Matricular desde Excel'}
            </Button>
          </div>
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            El Excel/csv debe incluir una columna con los <strong>nombres</strong> y/o <strong>correos</strong> de los estudiantes a matricular en el curso seleccionado.
          </Text>
        </Card>
      )}

      {/* ------------------------------ Agregar asignaturas por curso ------------------------------ */}
      {tab === 'asignaturas' && (
        <>
          <Card className={styles.card}>
            <Text weight="semibold" size={300}>Agregar o quitar asignaturas a un curso (manual)</Text>
            <FormField label="Curso">
              <Select value={manualCurso} onChange={(_, d) => { setManualCurso(d.value); setManualAsig({}) }} style={{ maxWidth: '360px' }}>
                <option value="">Selecciona un curso…</option>
                {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
              </Select>
            </FormField>
            {manualCurso && (
              <>
                <Text size={200} block style={{ color: 'var(--texto-suave)' }}>Marca las asignaturas a agregar:</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', maxHeight: '220px', overflowY: 'auto' }}>
                  {subjects.map((s) => (
                    <Checkbox
                      key={s.id}
                      checked={!!manualAsig[s.name]}
                      disabled={asignaturasDelCurso.some((a) => a.trim().toLowerCase() === s.name.trim().toLowerCase())}
                      label={s.name}
                      onChange={(_, d) => setManualAsig((m) => ({ ...m, [s.name]: !!d.checked }))}
                    />
                  ))}
                </div>
                <div className={styles.actions}>
                  <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void agregarAsignaturasManual()}>
                    {busy ? 'Agregando…' : 'Agregar asignaturas marcadas'}
                  </Button>
                </div>
                <Text weight="semibold" size={300} block style={{ marginTop: '8px' }}>Asignaturas del curso ({asignaturasDelCurso.length})</Text>
                {asignaturasDelCurso.length === 0 ? (
                  <Text size={200} style={{ color: 'var(--texto-suave)' }}>Este curso aún no tiene asignaturas.</Text>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {asignaturasDelCurso.map((a) => (
                      <span key={a} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '2px 6px 2px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Text size={200}>{a}</Text>
                        <Button size="small" appearance="subtle" icon={<DeleteRegular />} disabled={busy} aria-label={`Quitar ${a}`} onClick={() => void quitarAsignaturaManual(a)} />
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className={styles.card}>
            <Text weight="semibold" size={300}>Asignaturas por curso</Text>
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>
              Descarga el Excel con un curso por fila (columna A: nombre del curso) y sus asignaturas en las columnas B, C, D… (una asignatura por columna).
              Modifícalo y cárgalo de vuelta: cada curso quedará con única y exclusivamente las asignaturas indicadas en el archivo.
            </Text>
            <input ref={subjectExcelRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => void importarAsignaturasPorCurso(e.target.files?.[0])} />
            <div className={styles.actions}>
              <Button appearance="primary" icon={<ArrowDownloadRegular />} disabled={importingSubjects || cursosCatalogo.length === 0} onClick={exportarAsignaturasPorCurso}>
                Crear y exportar Excel
              </Button>
              <Button appearance="secondary" icon={importingSubjects ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={importingSubjects} onClick={() => subjectExcelRef.current?.click()}>
                {importingSubjects ? 'Procesando…' : 'Cargar Excel actualizado'}
              </Button>
              <Button appearance="secondary" icon={<DeleteRegular />} disabled={importingSubjects} onClick={() => void limpiarCursos()}>
                Limpiar cursos con formato inválido
              </Button>
            </div>
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
              {cursosCatalogo.length} curso(s) · {cursosCatalogo.reduce((acc, c) => acc + grades.filter((g) => cursoNombre(g) === c.nombre && isRealSubject(asignaturaDe(g))).length, 0)} asignatura(s) registrada(s).
            </Text>
          </Card>

          <Text weight="semibold" size={400} block style={{ margin: '4px 0 10px' }}>Cursos con sus asignaturas ({cursosConAsignaturas.length})</Text>
          {cursosPorNivel.map((grupo) => (
            <div key={grupo.nivel} style={{ marginBottom: '18px' }}>
              <Text weight="semibold" size={300} block style={{ marginBottom: '8px' }}>
                {grupo.nivel} ({grupo.cursos.length} curso{grupo.cursos.length === 1 ? '' : 's'})
              </Text>
              <Table aria-label={`Cursos de ${grupo.nivel}`} size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Curso</TableHeaderCell>
                    <TableHeaderCell>Asignaturas</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupo.cursos.map((c) => (
                    <TableRow key={c.curso}>
                      <TableCell><Text weight="semibold">{c.curso}</Text></TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {c.asignaturas.map((a) => (
                            <span key={a} style={{ border: '1px solid var(--borde)', borderRadius: '999px', padding: '2px 10px' }}>
                              <Text size={200}>{a}</Text>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{c.asignaturas.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </>
      )}

      {/* -------- Editar matrícula -------- */}
      <ModalForm
        open={!!editEnr}
        onOpenChange={(o) => { if (!o) setEditEnr(null) }}
        title="Editar matrícula"
        subtitle={editEnr ? (studentById(editEnr.studentId)?.fullName ?? '') : undefined}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditEnr(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void guardarEdicionMatricula()} disabled={busy}>Guardar</Button>
          </>
        }
      >
        {editEnr && (
          <FormField label="Curso" required>
            <Select value={editEnrCurso} onChange={(_, d) => setEditEnrCurso(d.value)}>
              <option value="">— Selecciona un curso —</option>
              {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
            </Select>
          </FormField>
        )}
      </ModalForm>
    </div>
  )
}
