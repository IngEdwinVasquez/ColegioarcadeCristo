import { useMemo, useState } from 'react'
import { Button, Card, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId } from '../../utils/helpers'
import { NIVELES, GRADOS, SECCIONES, asignaturaDe, cursoNombre, isRealSubject, nivelShort, gradoDe, seccionDe, cicloFromGrade } from '../../utils/academic'
import type { Enrollment, GradeSection, TeacherAssignment } from '../../types'

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

  const [tab, setTab] = useState('matriculas')
  const [busy, setBusy] = useState(false)

  const activePeriod = periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? ''

  // Matrículas (filtro por Curso = Grado + Sección + Nivel, tal como en Gestión académica)
  const [mCurso, setMCurso] = useState('')
  const [mPeriod, setMPeriod] = useState(activePeriod)
  const [mStudents, setMStudents] = useState<string[]>([])

  // Asignaciones docentes (filtros Nivel · Grado · Sección como Gestión académica)
  const [dNivel, setDNivel] = useState('')
  const [dGrado, setDGrado] = useState('')
  const [dSeccion, setDSeccion] = useState('')
  const [dGrade, setDGrade] = useState('')
  const [dPeriod, setDPeriod] = useState(activePeriod)
  const [dSubject, setDSubject] = useState('')
  const [dTeachers, setDTeachers] = useState<string[]>([])

  // Docente encargado
  const [eGrade, setEGrade] = useState('')
  const [eTeacher, setETeacher] = useState('')

  // Misma lista/etiquetas que «Gestión académica» (Asignatura · Curso = Grado + Sección + Nivel).
  const gradeLabel = (g: GradeSection) => `${asignaturaDe(g)} · ${cursoNombre(g)}`
  const gradeOptions = useMemo(
    () => grades.filter((g) => isRealSubject(asignaturaDe(g))).map((g) => ({ id: g.id, label: gradeLabel(g) })),
    [grades],
  )

  // Cursos para Asignaciones docentes, filtrados por Nivel · Grado · Sección.
  const cursoGradeOptions = useMemo(
    () => grades
      .filter((g) => isRealSubject(asignaturaDe(g)))
      .filter((g) => !dNivel || nivelShort(g.level) === dNivel)
      .filter((g) => !dGrado || gradoDe(g) === dGrado)
      .filter((g) => !dSeccion || seccionDe(g) === dSeccion)
      .map((g) => ({ id: g.id, label: gradeLabel(g) })),
    [grades, dNivel, dGrado, dSeccion],
  )

  // Catálogo de cursos (Grado + Sección + Nivel) existentes en Gestión académica.
  const cursosCatalogo = useMemo(() => {
    const reales = grades.filter((g) => isRealSubject(asignaturaDe(g)))
    const map = new Map<string, GradeSection>()
    for (const g of reales) {
      const nombre = cursoNombre(g)
      if (!map.has(nombre)) map.set(nombre, g)
    }
    return [...map.entries()].map(([nombre, curso]) => ({ nombre, curso }))
  }, [grades])
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
  const studentOptions = useMemo(() => students.map((s) => ({ id: s.id, label: s.fullName, detail: s.email })), [students])
  const teacherOptions = useMemo(() => teachers.map((t) => ({ id: t.id, label: t.fullName, detail: t.email })), [teachers])
  // Asignaturas tal como se ven en Gestión académica (derivadas de los cursos).
  const asignaturaGAOptions = useMemo(
    () => [...new Set(grades.filter((g) => isRealSubject(asignaturaDe(g))).map((g) => asignaturaDe(g)))]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ id: n, label: n })),
    [grades],
  )

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

  // ---------------------------------------------------------------- Docentes en lote
  const asignarDocentes = async () => {
    if (!dGrade || !dPeriod || !dSubject || dTeachers.length === 0) {
      toaster.dispatchToast('Selecciona curso, asignatura, período y al menos un docente.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      // La asignatura viene de Gestión académica (por nombre); se vincula al catálogo si existe.
      const subjectId = subjects.find((s) => s.name.trim().toLowerCase() === dSubject.trim().toLowerCase())?.id ?? dSubject
      let created = 0
      let skipped = 0
      for (const teacherId of dTeachers) {
        const dup = assignmentsCol.items.some(
          (a) => a.teacherId === teacherId && a.gradeId === dGrade && a.subjectId === subjectId && a.periodId === dPeriod,
        )
        if (dup) { skipped += 1; continue }
        await assignmentsCol.save({ id: genId('ta'), teacherId, gradeId: dGrade, subjectId, periodId: dPeriod })
        created += 1
      }
      toaster.dispatchToast(`${created} asignación(es) creada(s)${skipped ? `; ${skipped} ya existían` : ''}.`, { intent: 'success' })
      setDTeachers([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron crear las asignaciones.', { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // ---------------------------------------------------------------- Docente encargado
  const asignarEncargado = async () => {
    const grade = gradeById(eGrade)
    if (!grade || !eTeacher) {
      toaster.dispatchToast('Selecciona curso y docente encargado.', { intent: 'error' })
      return
    }
    try {
      await gradesCol.save({ ...grade, leadTeacherId: eTeacher })
      toaster.dispatchToast(`Docente encargado asignado en ${gradeLabel(grade)}.`, { intent: 'success' })
      setETeacher('')
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo asignar el encargado.', { intent: 'error' })
    }
  }

  const quitarEncargado = async (grade: GradeSection) => {
    try {
      await gradesCol.save({ ...grade, leadTeacherId: undefined })
      toaster.dispatchToast('Docente encargado removido.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudo remover.', { intent: 'error' })
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

            <MultiSelect
              label="Estudiantes a matricular"
              options={studentOptions}
              selected={mStudents}
              onChange={setMStudents}
              placeholder="Filtrar estudiantes…"
              emptyMessage="No hay estudiantes en el catálogo."
            />
            <div className={styles.actions}>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy || !periodActive || cursoMaterias.length === 0 || mStudents.length === 0} onClick={() => void matricular()}>
                {busy ? 'Procesando…' : 'Matricular seleccionados'}
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
          ) : enrollmentsCol.items.length === 0 ? (
            <EmptyStateView title="Sin matrículas" message="Selecciona un curso y estudiantes para matricularlos." />
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
                {enrollmentsCol.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><Text weight="semibold">{studentById(e.studentId)?.fullName ?? e.studentId}</Text></TableCell>
                    <TableCell>{gradeById(e.gradeId) ? cursoNombre(gradeById(e.gradeId) as GradeSection) : e.gradeId}</TableCell>
                    <TableCell>{e.subjectId ? subjectById(e.subjectId)?.name ?? e.subjectId : 'Todas'}</TableCell>
                    <TableCell>{periodById(e.periodId)?.name ?? e.periodId}</TableCell>
                    <TableCell>
                      <Toolbar size="small">
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => void enrollmentsCol.remove(e.id)} aria-label="Eliminar" />
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
            <FieldRow>
              <FormField label="Nivel">
                <Select value={dNivel} onChange={(_, d) => setDNivel(d.value)}>
                  <option value="">Todos los niveles</option>
                  {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </FormField>
              <FormField label="Grado">
                <Select value={dGrado} onChange={(_, d) => setDGrado(d.value)}>
                  <option value="">Todos los grados</option>
                  {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </FormField>
              <FormField label="Sección">
                <Select value={dSeccion} onChange={(_, d) => setDSeccion(d.value)}>
                  <option value="">Todas las secciones</option>
                  {SECCIONES.map((s) => <option key={s} value={s}>Sección {s}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Curso" required>
                <Select value={dGrade} onChange={(_, d) => setDGrade(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {cursoGradeOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Asignatura" required>
                <Select value={dSubject} onChange={(_, d) => setDSubject(d.value)}>
                  <option value="">— Selecciona una asignatura —</option>
                  {asignaturaGAOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Período" required>
                <Select value={dPeriod} onChange={(_, d) => setDPeriod(d.value)}>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <MultiSelect
              label="Docentes a asignar"
              options={teacherOptions}
              selected={dTeachers}
              onChange={setDTeachers}
              placeholder="Filtrar docentes…"
              required
              emptyMessage="No hay docentes en el catálogo."
            />
            <div className={styles.actions}>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void asignarDocentes()}>
                {busy ? 'Procesando…' : 'Asignar seleccionados'}
              </Button>
            </div>
          </Card>

          {assignmentsCol.loading ? (
            <Spinner label="Cargando asignaciones…" />
          ) : assignmentsCol.items.length === 0 ? (
            <EmptyStateView title="Sin asignaciones" message="Selecciona curso, asignatura y docentes para asignarlos." />
          ) : (
            <Table aria-label="Asignaciones docentes">
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
                {assignmentsCol.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Text weight="semibold">{teacherById(a.teacherId)?.fullName ?? a.teacherId}</Text></TableCell>
                    <TableCell>{gradeById(a.gradeId) ? gradeLabel(gradeById(a.gradeId) as GradeSection) : a.gradeId}</TableCell>
                    <TableCell>{subjectById(a.subjectId)?.name ?? a.subjectId}</TableCell>
                    <TableCell>{periodById(a.periodId)?.name ?? a.periodId}</TableCell>
                    <TableCell>
                      <Toolbar size="small">
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => void assignmentsCol.remove(a.id)} aria-label="Eliminar" />
                      </Toolbar>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* ------------------------------ Docente encargado ------------------------------ */}
      {tab === 'encargado' && (
        <>
          <Card className={styles.card}>
            <FieldRow>
              <FormField label="Curso" required>
                <Select value={eGrade} onChange={(_, d) => setEGrade(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {gradeOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
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

          <Table aria-label="Docente encargado por curso">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Curso (grado)</TableHeaderCell>
                <TableHeaderCell>Docente encargado</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><Text weight="semibold">{gradeLabel(g)}</Text></TableCell>
                  <TableCell>{g.leadTeacherId ? teacherById(g.leadTeacherId)?.fullName ?? g.leadTeacherId : <Text style={{ color: tokens.colorNeutralForeground2 }}>Sin asignar</Text>}</TableCell>
                  <TableCell>
                    <Toolbar size="small">
                      <ToolbarButton icon={<DeleteRegular />} onClick={() => void quitarEncargado(g)} aria-label="Quitar encargado" disabled={!g.leadTeacherId} />
                    </Toolbar>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
