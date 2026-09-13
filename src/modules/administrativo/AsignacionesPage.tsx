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
import { asignaturaDe, cursoNombre, isRealSubject, nivelShort, gradoDe, seccionDe, cicloFromGrade } from '../tecnologia/AcademicaTecPage'
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
  const [mCursos, setMCursos] = useState<string[]>([])
  const [mPeriod, setMPeriod] = useState(activePeriod)
  const [mStudents, setMStudents] = useState<string[]>([])

  // Asignaciones docentes
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
    () => grades.filter((g) => isRealSubject(asignaturaDe(g))).map((g) => ({ id: g.id, label: gradeLabel(g), detail: nivelShort(g.level) })),
    [grades],
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
  const asignaturaOptions = useMemo(
    () => grades
      .filter((g) => isRealSubject(asignaturaDe(g)) && cursoNombre(g) === mCurso)
      .map((g) => ({ id: g.id, label: asignaturaDe(g), detail: cursoNombre(g) })),
    [grades, mCurso],
  )
  const studentOptions = useMemo(() => students.map((s) => ({ id: s.id, label: s.fullName, detail: s.email })), [students])
  const teacherOptions = useMemo(() => teachers.map((t) => ({ id: t.id, label: t.fullName, detail: t.email })), [teachers])
  const subjectOptions = useMemo(() => subjects.map((s) => ({ id: s.id, label: s.name })), [subjects])

  // ---------------------------------------------------------------- Matrículas en lote
  const matricular = async () => {
    if (mCursos.length === 0 || !mPeriod || mStudents.length === 0) {
      toaster.dispatchToast('Selecciona al menos una asignatura/curso, período y estudiantes.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let created = 0
      let skipped = 0
      for (const studentId of mStudents) {
        for (const gradeId of mCursos) {
          const dup = enrollmentsCol.items.some((e) => e.studentId === studentId && e.gradeId === gradeId && e.periodId === mPeriod)
          if (dup) { skipped += 1; continue }
          await enrollmentsCol.save({ id: genId('enr'), studentId, gradeId, periodId: mPeriod })
          created += 1
        }
      }
      toaster.dispatchToast(`${created} matrícula(s) creada(s)${skipped ? `; ${skipped} ya existían` : ''}.`, { intent: 'success' })
      setMStudents([])
    } catch (error) {
      toaster.dispatchToast(error instanceof Error ? error.message : 'No se pudieron crear las matrículas.', { intent: 'error' })
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
      let created = 0
      let skipped = 0
      for (const teacherId of dTeachers) {
        const dup = assignmentsCol.items.some(
          (a) => a.teacherId === teacherId && a.gradeId === dGrade && a.subjectId === dSubject && a.periodId === dPeriod,
        )
        if (dup) { skipped += 1; continue }
        await assignmentsCol.save({ id: genId('ta'), teacherId, gradeId: dGrade, subjectId: dSubject, periodId: dPeriod })
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
              <FormField label="Curso (Grado + Sección + Nivel)" required>
                <Select value={mCurso} onChange={(_, d) => { setMCurso(d.value); setMCursos([]) }}>
                  <option value="">— Selecciona un curso —</option>
                  {cursosCatalogo.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </Select>
              </FormField>
              <FormField label="Período" required>
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
            <MultiSelect
              label="Asignaturas del curso"
              options={asignaturaOptions}
              selected={mCursos}
              onChange={setMCursos}
              placeholder="Filtrar asignaturas…"
              required
              emptyMessage={mCurso ? 'Este curso no tiene asignaturas registradas.' : 'Selecciona primero un curso.'}
            />
            <MultiSelect
              label="Estudiantes a matricular"
              options={studentOptions}
              selected={mStudents}
              onChange={setMStudents}
              placeholder="Filtrar estudiantes…"
              required
              emptyMessage="No hay estudiantes en el catálogo."
            />
            <div className={styles.actions}>
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void matricular()}>
                {busy ? 'Procesando…' : 'Matricular seleccionados'}
              </Button>
            </div>
          </Card>

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
                    <TableCell>{gradeById(e.gradeId) ? gradeLabel(gradeById(e.gradeId) as GradeSection) : e.gradeId}</TableCell>
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
              <FormField label="Curso (grado)" required>
                <Select value={dGrade} onChange={(_, d) => setDGrade(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {gradeOptions.map((g) => <option key={g.id} value={g.id}>{g.label}{g.detail ? ` · ${g.detail}` : ''}</option>)}
                </Select>
              </FormField>
              <FormField label="Asignatura" required>
                <Select value={dSubject} onChange={(_, d) => setDSubject(d.value)}>
                  <option value="">— Selecciona una asignatura —</option>
                  {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
              <FormField label="Curso (grado)" required>
                <Select value={eGrade} onChange={(_, d) => setEGrade(d.value)}>
                  <option value="">— Selecciona un curso —</option>
                  {gradeOptions.map((g) => <option key={g.id} value={g.id}>{g.label}{g.detail ? ` · ${g.detail}` : ''}</option>)}
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
