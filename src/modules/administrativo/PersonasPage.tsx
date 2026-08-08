import { useState } from 'react'
import { Button, Input, Select, Tab, TabList, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField, FieldRow } from '../../components/shared/form'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Student, StudentGuardian, Teacher } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
})

export function PersonasPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, subjects, students, teachers } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const teachersCol = useCollection<Teacher>(dataService.getTeachers, dataService.saveTeacher, dataService.deleteTeacher)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians, dataService.saveGuardian, dataService.deleteGuardian)

  const [tab, setTab] = useState('estudiantes')

  const studentColumns: CrudColumn<Student>[] = [
    { header: 'Estudiante', render: (s) => <Text weight="semibold">{s.fullName}</Text> },
    { header: 'Grado', render: (s) => grades.find((g) => g.id === s.gradeId)?.name ?? s.gradeId },
    { header: 'Padre / Tutor', render: (s) => s.parentName || '—' },
    { header: 'Contacto', render: (s) => s.parentEmail || '—', hideMobile: true },
  ]

  const teacherColumns: CrudColumn<Teacher>[] = [
    { header: 'Docente', render: (t) => <Text weight="semibold">{t.fullName}</Text> },
    { header: 'Correo', render: (t) => t.email || '—' },
    {
      header: 'Asignaturas',
      render: (t) => (
        <span>
          {t.subjects.map((id) => subjects.find((s) => s.id === id)?.shortName ?? id).join(', ')}
        </span>
      ),
    },
  ]

  const saveStudent = async (s: Student) => {
    await studentsCol.save(s)
    toaster.dispatchToast('Estudiante guardado', { intent: 'success' })
  }
  const saveTeacher = async (t: Teacher) => {
    await teachersCol.save(t)
    toaster.dispatchToast('Docente guardado', { intent: 'success' })
  }

  const saveGuardian = async (g: StudentGuardian) => {
    await guardiansCol.save(g)
    toaster.dispatchToast('Tutor guardado', { intent: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Datos institucionales"
        subtitle="Mantenimiento de los datos de estudiantes, docentes y padres de familia."
      />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="estudiantes">Estudiantes ({students.length})</Tab>
        <Tab value="docentes">Docentes ({teachers.length})</Tab>
        <Tab value="padres">Padres ({guardiansCol.items.length})</Tab>
      </TabList>

      {tab === 'estudiantes' && (
        <EntityCrud
          title="Estudiantes"
          items={studentsCol.items}
          loading={studentsCol.loading}
          columns={studentColumns}
          searchText={(s) => `${s.fullName} ${s.parentName}`}
          newLabel="Nuevo estudiante"
          createDefault={() => ({
            id: genId('s'),
            fullName: '',
            gradeId: grades[0]?.id ?? '',
            parentName: '',
            parentEmail: '',
            birthDate: '',
          })}
          renderForm={(s, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={s.fullName} onChange={(_, d) => set({ ...s, fullName: d.value })} placeholder="Nombre y apellidos" />
              </FormField>
              <FieldRow>
                <FormField label="Grado / Curso" required>
                  <Select value={s.gradeId} onChange={(_, d) => set({ ...s, gradeId: d.value })}>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Fecha de nacimiento">
                  <Input type="date" value={s.birthDate ?? ''} onChange={(_, d) => set({ ...s, birthDate: d.value })} />
                </FormField>
              </FieldRow>
              <FieldRow>
                <FormField label="Padre / Tutor">
                  <Input value={s.parentName ?? ''} onChange={(_, d) => set({ ...s, parentName: d.value })} />
                </FormField>
                <FormField label="Correo del padre / tutor">
                  <Input value={s.parentEmail ?? ''} onChange={(_, d) => set({ ...s, parentEmail: d.value })} />
                </FormField>
              </FieldRow>
            </div>
          )}
          onSave={saveStudent}
          onDelete={(id) => studentsCol.remove(id)}
          emptyMessage="Registre los estudiantes de la matrícula."
        />
      )}

      {tab === 'docentes' && (
        <EntityCrud
          title="Docentes"
          items={teachersCol.items}
          loading={teachersCol.loading}
          columns={teacherColumns}
          searchText={(t) => `${t.fullName} ${t.email}`}
          newLabel="Nuevo docente"
          createDefault={() => ({
            id: genId('t'),
            fullName: '',
            email: '',
            subjects: [],
            grades: [],
          })}
          renderForm={(t, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={t.fullName} onChange={(_, d) => set({ ...t, fullName: d.value })} />
              </FormField>
              <FormField label="Correo institucional">
                <Input value={t.email} onChange={(_, d) => set({ ...t, email: d.value })} />
              </FormField>
              <FormField label="Asignaturas que imparte">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {subjects.map((sub) => (
                    <Button
                      key={sub.id}
                      size="small"
                      appearance={t.subjects.includes(sub.id) ? 'primary' : 'secondary'}
                      onClick={() =>
                        set({
                          ...t,
                          subjects: t.subjects.includes(sub.id)
                            ? t.subjects.filter((x) => x !== sub.id)
                            : [...t.subjects, sub.id],
                        })
                      }
                    >
                      {sub.name}
                    </Button>
                  ))}
                </div>
              </FormField>
              <FormField label="Grados a su cargo">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {grades.map((g) => (
                    <Button
                      key={g.id}
                      size="small"
                      appearance={t.grades.includes(g.id) ? 'primary' : 'secondary'}
                      onClick={() =>
                        set({
                          ...t,
                          grades: t.grades.includes(g.id) ? t.grades.filter((x) => x !== g.id) : [...t.grades, g.id],
                        })
                      }
                    >
                      {g.name}
                    </Button>
                  ))}
                </div>
              </FormField>
            </div>
          )}
          onSave={saveTeacher}
          onDelete={(id) => teachersCol.remove(id)}
          emptyMessage="Registre al cuerpo docente."
        />
      )}

      {tab === 'padres' && (
        <EntityCrud<StudentGuardian>
          title="Padres y tutores"
          items={guardiansCol.items}
          loading={guardiansCol.loading}
          columns={[
            { header: 'Nombre', render: (g) => <Text weight="semibold">{g.fullName}</Text> },
            { header: 'Correo', render: (g) => g.email || '—' },
            { header: 'Teléfono', render: (g) => g.phone || '—' },
            { header: 'Parentesco', render: (g) => <StatusBadge status={g.parentesco}>{g.parentesco}</StatusBadge> },
            { header: 'Estudiante', render: (g) => studentsCol.items.find((s) => s.id === g.studentId)?.fullName ?? g.studentId },
          ]}
          searchText={(g) => `${g.fullName} ${g.email} ${g.parentesco}`}
          newLabel="Registrar tutor"
          createDefault={() => ({ id: genId('gr'), studentId: studentsCol.items[0]?.id ?? '', fullName: '', email: '', phone: '', parentesco: 'padre' })}
          renderForm={(g, set) => (
            <div>
              <FieldRow>
                <FormField label="Nombre completo" required>
                  <Input value={g.fullName} onChange={(_, d) => set({ ...g, fullName: d.value })} />
                </FormField>
                <FormField label="Estudiante">
                  <Select value={g.studentId} onChange={(_, d) => set({ ...g, studentId: d.value })}>
                    {studentsCol.items.map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </Select>
                </FormField>
              </FieldRow>
              <FieldRow>
                <FormField label="Correo">
                  <Input value={g.email ?? ''} onChange={(_, d) => set({ ...g, email: d.value })} />
                </FormField>
                <FormField label="Teléfono">
                  <Input value={g.phone ?? ''} onChange={(_, d) => set({ ...g, phone: d.value })} />
                </FormField>
              </FieldRow>
              <FormField label="Parentesco">
                <Select value={g.parentesco} onChange={(_, d) => set({ ...g, parentesco: d.value as StudentGuardian['parentesco'] })}>
                  <option value="padre">Padre</option><option value="madre">Madre</option><option value="tutor">Tutor</option><option value="otro">Otro</option>
                </Select>
              </FormField>
            </div>
          )}
          onSave={saveGuardian}
          onDelete={(id) => guardiansCol.remove(id)}
          emptyMessage="Registre los padres o tutores y asígnelos a un estudiante con su parentesco."
        />
      )}
    </div>
  )
}
