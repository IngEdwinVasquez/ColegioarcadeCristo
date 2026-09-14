import { useMemo, useRef, useState } from 'react'
import { Button, Card, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, CheckmarkCircleRegular, ArrowUploadRegular, EditRegular, DocumentPdfRegular } from '@fluentui/react-icons'
import * as XLSX from 'xlsx'
import { extractPdfText } from '../../services/pdf'
import { parseSigerdStudentsPdf } from '../../services/sigerdAi'
import { listEntraUsers } from '../../services/entraUsers'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId } from '../../utils/helpers'
import { asignaturaDe, cursoNombre, ordenarCursos, isRealSubject, nivelShort, gradoDe, seccionDe, cicloFromGrade } from '../../utils/academic'
import type { Enrollment, GradeSection, Student, TeacherAssignment } from '../../types'

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
  const { students, teachers, grades, subjects, periods, gradeById, subjectById, periodById, studentById, teacherById } = useApp()
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment, dataService.deleteEnrollment)
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
  const sigerdRef = useRef<HTMLInputElement>(null)
  const [editEnr, setEditEnr] = useState<Enrollment | null>(null)
  const [editEnrCurso, setEditEnrCurso] = useState('')

  // Asignaciones docentes (filtros: Docente y Curso)
  const [dDocente, setDDocente] = useState('')
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
  // Asignaturas que el docente seleccionado imparte en ese curso (período activo).
  const asignacionesDocente = useMemo(
    () => assignmentsCol.items.filter((a) => {
      if (a.teacherId !== dDocente) return false
      if (activePeriod && a.periodId !== activePeriod) return false
      const g = gradeById(a.gradeId)
      return !!g && cursoNombre(g) === dCurso
    }),
    [assignmentsCol.items, dDocente, activePeriod, dCurso, gradeById],
  )

  // Catálogo de cursos (Grado + Sección + Nivel) existentes en Gestión académica.
  const cursosCatalogo = useMemo(
    () => ordenarCursos(grades.filter((g) => isRealSubject(asignaturaDe(g)))).map((g) => ({ nombre: cursoNombre(g), curso: g })),
    [grades],
  )
  // Cursos con docente encargado, filtrados por el curso y/o docente seleccionados.
  const cursosEncargado = useMemo(
    () => cursosCatalogo.filter((c) => {
      if (eCurso) return c.nombre === eCurso && !!c.curso.leadTeacherId
      if (eTeacher) return c.curso.leadTeacherId === eTeacher
      return !!c.curso.leadTeacherId
    }),
    [cursosCatalogo, eCurso, eTeacher],
  )
  const encargadoTitulo = eCurso
    ? `Curso: ${eCurso}`
    : eTeacher
      ? `Cursos de ${teacherById(eTeacher)?.fullName ?? ''} como encargado`
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
  const teacherOptions = useMemo(() => teachers.map((t) => ({ id: t.id, label: t.fullName, detail: t.email })), [teachers])
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
          conflicts.push(studentById(studentId)?.fullName ?? studentId)
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

  /** Matrícula masiva desde un PDF del SIGERD: crea/actualiza estudiantes y los matricula en el curso. */
  const matricularDesdeSigerd = async (file: File | undefined) => {
    if (!file) return
    if (!mCurso || !periodActive || cursoMaterias.length === 0) {
      toaster.dispatchToast('Selecciona un curso con asignaturas y un período activo.', { intent: 'error' })
      return
    }
    setImportingExcel(true)
    try {
      const text = await extractPdfText(file)
      const parsed = await parseSigerdStudentsPdf(text)
      if (parsed.length === 0) throw new Error('No se encontraron estudiantes en el PDF del SIGERD.')

      // Usuarios de Microsoft 365 (para vincular la cuenta del estudiante).
      let dir: Array<{ id: string; displayName?: string; email?: string }> = []
      try { dir = await listEntraUsers() } catch { dir = [] }
      const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
      const dirByName = new Map(dir.map((u) => [norm(u.displayName ?? ''), u]))

      const isoNac = (d?: string) => {
        const m = (d ?? '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
        return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
      }

      let created = 0
      let enrolled = 0
      let linked = 0
      for (const s of parsed) {
        const fullName = `${s.nombres} ${s.primerApellido} ${s.segundoApellido}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const alt = `${s.primerApellido} ${s.segundoApellido} ${s.nombres}`.replace(/\s+/g, ' ').trim().toUpperCase()
        const match = dirByName.get(norm(fullName)) ?? dirByName.get(norm(alt))
        if (match) linked += 1
        const existing = studentsCol.items.find((st) => (s.idEstudiante && st.sigerdId === s.idEstudiante) || norm(st.fullName) === norm(fullName))
        const student: Student = existing
          ? { ...existing, fullName, email: match?.email ?? existing.email, userId: match?.id ?? existing.userId, sigerdId: s.idEstudiante || existing.sigerdId, birthDate: isoNac(s.nacimiento) ?? existing.birthDate }
          : { id: genId('stu'), fullName, email: match?.email, userId: match?.id, sigerdId: s.idEstudiante, gradeId: cursoMaterias[0].id, birthDate: isoNac(s.nacimiento) }
        if (!existing) created += 1
        await studentsCol.save(student)
        const already = enrollmentsCol.items.some((e) => e.studentId === student.id && (!activePeriod || e.periodId === activePeriod))
        if (!already) {
          await enrollmentsCol.save({ id: genId('enr'), studentId: student.id, gradeId: cursoMaterias[0].id, periodId: activePeriod })
          enrolled += 1
        }
      }
      toaster.dispatchToast(`SIGERD: ${parsed.length} estudiante(s) leído(s), ${created} nuevo(s), ${enrolled} matriculado(s), ${linked} vinculado(s) a Microsoft 365.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo procesar el PDF del SIGERD.', { intent: 'error' })
    } finally {
      setImportingExcel(false)
      if (sigerdRef.current) sigerdRef.current.value = ''
    }
  }

  // ---------------------------------------------------------------- Asignaciones docentes
  const asignarSeleccionadas = async () => {
    if (!dCurso || !dDocente || dAsignaturas.length === 0) {
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
        <Tab value="matricular">Matricular estudiantes</Tab>
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
                    <TableCell><Text weight="semibold">{studentById(e.studentId)?.fullName ?? e.studentId}</Text></TableCell>
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
                  {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Docente" hint="Opcional: filtra por docente para ver/asignar/eliminar sus asignaturas.">
                <Select value={dDocente} onChange={(_, d) => { setDDocente(d.value); setDAsignaturas([]) }}>
                  <option value="">— Todos los docentes —</option>
                  {teacherOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </FormField>
            </FieldRow>

            {!dCurso ? (
              <Text size={200} style={{ color: 'var(--texto-suave)' }}>Selecciona un curso para ver sus asignaturas.</Text>
            ) : dDocente ? (
              <>
                <MultiSelect
                  label="Asignaturas del curso (marca las que impartirá)"
                  options={docenteCursoAsignaturas.map((n) => ({ id: n, label: n }))}
                  selected={dAsignaturas}
                  onChange={setDAsignaturas}
                  placeholder="Filtrar asignaturas…"
                  emptyMessage="Este curso no tiene asignaturas registradas."
                />
                <div className={styles.actions}>
                  <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || dAsignaturas.length === 0} onClick={() => void asignarSeleccionadas()}>
                    {busy ? 'Procesando…' : 'Asignar seleccionadas'}
                  </Button>
                </div>
              </>
            ) : (
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
            )}
          </Card>

          {dDocente && dCurso && (
            <>
              <Text weight="semibold" size={300} block style={{ marginBottom: '8px' }}>
                Asignaturas de {teacherById(dDocente)?.fullName ?? ''} en {dCurso} ({asignacionesDocente.length})
              </Text>
              {asignacionesDocente.length === 0 ? (
                <EmptyStateView title="Sin asignaturas" message="Este docente no tiene asignaturas en este curso." />
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
                    {asignacionesDocente.map((a) => {
                      const g = gradeById(a.gradeId)
                      return (
                        <TableRow key={a.id}>
                          <TableCell><Text weight="semibold">{teacherById(a.teacherId)?.fullName ?? a.teacherId}</Text></TableCell>
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
                    <TableCell>{lead ? teacherById(lead)?.fullName ?? lead : <Text style={{ color: tokens.colorNeutralForeground2 }}>Sin asignar</Text>}</TableCell>
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
          <input ref={sigerdRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void matricularDesdeSigerd(e.target.files?.[0])} />
          <div className={styles.actions}>
            <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || !periodActive || cursoMaterias.length === 0 || mStudents.length === 0} onClick={() => void matricular()}>
              {busy ? 'Procesando…' : `Matricular seleccionados (${mStudents.length})`}
            </Button>
            <Button appearance="secondary" icon={importingExcel ? <Spinner size="tiny" /> : <ArrowUploadRegular />} disabled={importingExcel || !mCurso || !periodActive || cursoMaterias.length === 0} onClick={() => excelRef.current?.click()}>
              {importingExcel ? 'Procesando…' : 'Matricular desde Excel'}
            </Button>
            <Button appearance="secondary" icon={importingExcel ? <Spinner size="tiny" /> : <DocumentPdfRegular />} disabled={importingExcel || !mCurso || !periodActive || cursoMaterias.length === 0} onClick={() => sigerdRef.current?.click()}>
              {importingExcel ? 'Procesando…' : 'Matricular desde PDF SIGERD'}
            </Button>
          </div>
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            Excel/csv: incluye una columna con los <strong>nombres</strong> y/o <strong>correos</strong>. PDF: reporte del <strong>SIGERD</strong> con la relación de estudiantes del curso (crea/actualiza la ficha y vincula la cuenta de Microsoft 365 por nombre).
          </Text>
        </Card>
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
