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
import { EntraUserPicker } from '../../components/shared/EntraUserPicker'
import { entraEmail, getDirectoryUsers, linkUserRole, syncTeacherAssignments, unlinkUserRole } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
})

export function PersonasPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, subjects, students, teachers, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const teachersCol = useCollection<Teacher>(dataService.getTeachers, dataService.saveTeacher, dataService.deleteTeacher)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians, dataService.saveGuardian, dataService.deleteGuardian)

  const [tab, setTab] = useState('estudiantes')

  const studentColumns: CrudColumn<Student>[] = [
    { header: 'Estudiante', render: (s) => <Text weight="semibold">{s.fullName}</Text> },
    { header: 'Cuenta M365', render: (s) => s.email || <Text size={200} style={{ color: '#B42318' }}>Sin vincular</Text> },
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

  /** Busca la cuenta de Entra seleccionada; lanza error si falta (vinculación obligatoria). */
  const requireAccount = async (userId: string | undefined, label: string) => {
    if (!userId) {
      const message = `Seleccione la cuenta de Microsoft 365 del ${label}: es obligatoria para darle acceso al portal.`
      toaster.dispatchToast(message, { intent: 'error' })
      throw new Error(message)
    }
    const account = (await getDirectoryUsers()).find((u) => u.id === userId)
    if (!account) {
      toaster.dispatchToast('La cuenta seleccionada ya no existe en el directorio.', { intent: 'error' })
      throw new Error('Cuenta no encontrada')
    }
    return account
  }

  const failed = (error: unknown) => {
    toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    throw error
  }

  const saveStudent = async (s: Student) => {
    if (!s.fullName.trim() || !s.gradeId) {
      toaster.dispatchToast('Complete el nombre y el grado.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(s.userId, 'estudiante')
    try {
      const previous = studentsCol.items.find((x) => x.id === s.id)
      if (previous?.userId && previous.userId !== account.id) await unlinkUserRole(previous.userId, 'estudiante', { studentId: s.id })
      await linkUserRole(account, 'estudiante', { studentId: s.id })
      await studentsCol.save({ ...s, email: entraEmail(account) })
      toaster.dispatchToast(`Estudiante guardado y cuenta ${entraEmail(account)} vinculada con rol Estudiante`, { intent: 'success' })
    } catch (error) {
      failed(error)
    }
  }

  const saveTeacher = async (t: Teacher) => {
    if (!t.fullName.trim()) {
      toaster.dispatchToast('Complete el nombre del docente.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(t.userId, 'docente')
    try {
      const previous = teachersCol.items.find((x) => x.id === t.id)
      if (previous?.userId && previous.userId !== account.id) await unlinkUserRole(previous.userId, 'docente', { teacherId: t.id })
      await linkUserRole(account, 'docente', { teacherId: t.id })
      await teachersCol.save({ ...t, email: entraEmail(account) })
      const sync = await syncTeacherAssignments({ ...t, email: entraEmail(account) }, periods)
      const detail = sync.period
        ? ` · ${sync.created} asignación(es) creada(s)${sync.removed ? `, ${sync.removed} retirada(s)` : ''} en ${sync.period.name}`
        : ' · sin período escolar: cree uno en Catálogos para generar las asignaciones'
      toaster.dispatchToast(`Docente guardado y cuenta ${entraEmail(account)} vinculada con rol Docente${detail}`, { intent: 'success' })
    } catch (error) {
      failed(error)
    }
  }

  const saveGuardian = async (g: StudentGuardian) => {
    if (!g.fullName.trim() || !g.studentId) {
      toaster.dispatchToast('Complete el nombre y el estudiante.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(g.userId, 'padre o tutor')
    try {
      const previous = guardiansCol.items.find((x) => x.id === g.id)
      if (previous?.userId && previous.userId !== account.id) await unlinkUserRole(previous.userId, 'padre')
      await linkUserRole(account, 'padre')
      await guardiansCol.save({ ...g, email: entraEmail(account) })
      toaster.dispatchToast(`Tutor guardado y cuenta ${entraEmail(account)} vinculada con rol Padre / Tutor`, { intent: 'success' })
    } catch (error) {
      failed(error)
    }
  }

  const deleteStudent = async (id: string) => {
    const s = studentsCol.items.find((x) => x.id === id)
    await unlinkUserRole(s?.userId, 'estudiante', { studentId: id })
    await studentsCol.remove(id)
  }
  const deleteTeacher = async (id: string) => {
    const t = teachersCol.items.find((x) => x.id === id)
    await unlinkUserRole(t?.userId, 'docente', { teacherId: id })
    await teachersCol.remove(id)
  }
  const deleteGuardian = async (id: string) => {
    const g = guardiansCol.items.find((x) => x.id === id)
    // Solo se quita el rol si no tiene otros hijos registrados con la misma cuenta.
    const others = guardiansCol.items.some((x) => x.id !== id && x.userId && x.userId === g?.userId)
    if (!others) await unlinkUserRole(g?.userId, 'padre')
    await guardiansCol.remove(id)
  }

  const takenStudentUsers = studentsCol.items.map((x) => x.userId ?? '').filter(Boolean)
  const takenTeacherUsers = teachersCol.items.map((x) => x.userId ?? '').filter(Boolean)

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
            email: '',
            userId: undefined,
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
              <EntraUserPicker
                value={s.userId}
                takenIds={takenStudentUsers}
                onChange={(u) => set({ ...s, userId: u?.id, email: u ? entraEmail(u) : '', fullName: s.fullName || (u?.displayName ?? '') })}
                hint="Obligatorio. La cuenta recibirá el rol Estudiante y verá su Campus Virtual."
              />
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
          onDelete={deleteStudent}
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
            userId: undefined,
            subjects: [],
            grades: [],
          })}
          renderForm={(t, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={t.fullName} onChange={(_, d) => set({ ...t, fullName: d.value })} />
              </FormField>
              <EntraUserPicker
                value={t.userId}
                takenIds={takenTeacherUsers}
                onChange={(u) => set({ ...t, userId: u?.id, email: u ? entraEmail(u) : '', fullName: t.fullName || (u?.displayName ?? '') })}
                hint="Obligatorio. La cuenta recibirá el rol Docente; el correo institucional se toma de la cuenta."
              />
              <Text size={200} block style={{ color: 'var(--texto-suave)', margin: '4px 0 10px' }}>
                Marque las asignaturas y los grados: al guardar se crean automáticamente las asignaciones (grado × asignatura) del período escolar activo.
              </Text>
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
          onDelete={deleteTeacher}
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
          createDefault={() => ({ id: genId('gr'), studentId: studentsCol.items[0]?.id ?? '', fullName: '', email: '', userId: undefined, phone: '', parentesco: 'padre' })}
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
              <EntraUserPicker
                value={g.userId}
                onChange={(u) => set({ ...g, userId: u?.id, email: u ? entraEmail(u) : '', fullName: g.fullName || (u?.displayName ?? '') })}
                hint="Obligatorio. La cuenta recibirá el rol Padre / Tutor. Un mismo tutor puede vincularse a varios hijos."
              />
              <FormField label="Teléfono">
                <Input value={g.phone ?? ''} onChange={(_, d) => set({ ...g, phone: d.value })} />
              </FormField>
              <FormField label="Parentesco">
                <Select value={g.parentesco} onChange={(_, d) => set({ ...g, parentesco: d.value as StudentGuardian['parentesco'] })}>
                  <option value="padre">Padre</option><option value="madre">Madre</option><option value="tutor">Tutor</option><option value="otro">Otro</option>
                </Select>
              </FormField>
            </div>
          )}
          onSave={saveGuardian}
          onDelete={deleteGuardian}
          emptyMessage="Registre los padres o tutores y asígnelos a un estudiante con su parentesco."
        />
      )}
    </div>
  )
}
