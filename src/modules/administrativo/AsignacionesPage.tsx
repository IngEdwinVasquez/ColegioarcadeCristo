import { useState } from 'react'
import { Select, Tab, TabList, Text, useToastController, makeStyles } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Enrollment, TeacherAssignment } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
})

export function AsignacionesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { students, teachers, grades, subjects, periods, gradeById, subjectById, periodById, studentById, teacherById } = useApp()
  const enrollmentsCol = useCollection<Enrollment>(dataService.getEnrollments, dataService.saveEnrollment, dataService.deleteEnrollment)
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments, dataService.saveTeacherAssignment, dataService.deleteTeacherAssignment)

  const [tab, setTab] = useState('matriculas')

  const enrollmentColumns: CrudColumn<Enrollment>[] = [
    { header: 'Estudiante', render: (e) => <Text weight="semibold">{studentById(e.studentId)?.fullName ?? e.studentId}</Text> },
    { header: 'Curso', render: (e) => gradeById(e.gradeId)?.name ?? e.gradeId },
    { header: 'Asignatura', render: (e) => (e.subjectId ? subjectById(e.subjectId)?.name ?? e.subjectId : 'Todas') },
    { header: 'Período', render: (e) => periodById(e.periodId)?.name ?? e.periodId },
  ]

  const teacherAssignmentColumns: CrudColumn<TeacherAssignment>[] = [
    { header: 'Docente', render: (a) => <Text weight="semibold">{teacherById(a.teacherId)?.fullName ?? a.teacherId}</Text> },
    { header: 'Curso', render: (a) => gradeById(a.gradeId)?.name ?? a.gradeId },
    { header: 'Asignatura', render: (a) => subjectById(a.subjectId)?.name ?? a.subjectId },
    { header: 'Período', render: (a) => periodById(a.periodId)?.name ?? a.periodId },
  ]

  const saveEnrollment = async (e: Enrollment) => {
    await enrollmentsCol.save(e)
    toaster.dispatchToast('Matrícula guardada', { intent: 'success' })
  }
  const saveAssignment = async (a: TeacherAssignment) => {
    await assignmentsCol.save(a)
    toaster.dispatchToast('Asignación guardada', { intent: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Asignaciones"
        subtitle="Asigne estudiantes y docentes a cursos, asignaturas y períodos escolares."
      />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="matriculas">Matrículas de estudiantes ({enrollmentsCol.items.length})</Tab>
        <Tab value="docentes">Asignaciones docentes ({assignmentsCol.items.length})</Tab>
      </TabList>

      {tab === 'matriculas' && (
        <EntityCrud
          title="Matrículas"
          items={enrollmentsCol.items}
          loading={enrollmentsCol.loading}
          columns={enrollmentColumns}
          searchText={(e) => `${studentById(e.studentId)?.fullName ?? ''} ${gradeById(e.gradeId)?.name ?? ''}`}
          newLabel="Nueva matrícula"
          createDefault={() => ({
            id: genId('enr'),
            studentId: students[0]?.id ?? '',
            gradeId: grades[0]?.id ?? '',
            subjectId: '',
            periodId: periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '',
          })}
          renderForm={(e, set) => (
            <div>
              <FieldRow>
                <FormField label="Estudiante" required>
                  <Select value={e.studentId} onChange={(_, d) => set({ ...e, studentId: d.value })}>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Curso" required>
                  <Select value={e.gradeId} onChange={(_, d) => set({ ...e, gradeId: d.value })}>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </FormField>
              </FieldRow>
              <FieldRow>
                <FormField label="Asignatura (opcional)">
                  <Select value={e.subjectId ?? ''} onChange={(_, d) => set({ ...e, subjectId: d.value || undefined })}>
                    <option value="">Todas las asignaturas</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Período" required>
                  <Select value={e.periodId} onChange={(_, d) => set({ ...e, periodId: d.value })}>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>
                    ))}
                  </Select>
                </FormField>
              </FieldRow>
            </div>
          )}
          onSave={saveEnrollment}
          onDelete={(id) => enrollmentsCol.remove(id)}
        />
      )}

      {tab === 'docentes' && (
        <EntityCrud
          title="Asignaciones docentes"
          items={assignmentsCol.items}
          loading={assignmentsCol.loading}
          columns={teacherAssignmentColumns}
          searchText={(a) => `${teacherById(a.teacherId)?.fullName ?? ''} ${subjectById(a.subjectId)?.name ?? ''}`}
          newLabel="Nueva asignación"
          createDefault={() => ({
            id: genId('ta'),
            teacherId: teachers[0]?.id ?? '',
            gradeId: grades[0]?.id ?? '',
            subjectId: subjects[0]?.id ?? '',
            periodId: periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? '',
          })}
          renderForm={(a, set) => (
            <div>
              <FieldRow>
                <FormField label="Docente" required>
                  <Select value={a.teacherId} onChange={(_, d) => set({ ...a, teacherId: d.value })}>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Curso" required>
                  <Select value={a.gradeId} onChange={(_, d) => set({ ...a, gradeId: d.value })}>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </FormField>
              </FieldRow>
              <FieldRow>
                <FormField label="Asignatura" required>
                  <Select value={a.subjectId} onChange={(_, d) => set({ ...a, subjectId: d.value })}>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Período" required>
                  <Select value={a.periodId} onChange={(_, d) => set({ ...a, periodId: d.value })}>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (activo)' : ''}</option>
                    ))}
                  </Select>
                </FormField>
              </FieldRow>
            </div>
          )}
          onSave={saveAssignment}
          onDelete={(id) => assignmentsCol.remove(id)}
        />
      )}
    </div>
  )
}
