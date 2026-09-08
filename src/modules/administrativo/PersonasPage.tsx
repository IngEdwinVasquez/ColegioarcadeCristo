import { useState } from 'react'
import { Button, Input, Select, Tab, TabList, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { CloudArrowDownRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField, FieldRow } from '../../components/shared/form'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { Persona, Student, StudentGuardian, Teacher } from '../../types'
import type { Role } from '../../types/roles'
import { genId } from '../../utils/helpers'
import { EntraUserPicker } from '../../components/shared/EntraUserPicker'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { ImportPersonasWizard } from '../tecnologia/ImportPersonasWizard'
import { entraEmail, getDirectoryUsers, linkUserRole, syncTeacherAssignments, unlinkUserRole, type LinkTarget } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'

const useStyles = makeStyles({
  tabs: { marginBottom: '16px' },
})

const PERSON_TYPES = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'padre', label: 'Padre / Tutor' },
  { value: 'coordinador', label: 'Coordinador pedagógico' },
  { value: 'tic', label: 'Tecnología (TIC)' },
  { value: 'director', label: 'Director' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'siger', label: 'SIGER' },
  { value: 'apoyo', label: 'Personal de apoyo' },
  { value: 'psicologia', label: 'Orientación y Psicología' },
] as const

type TipoOp = (typeof PERSON_TYPES)[number]['value']

const ROLE_OF: Record<TipoOp, Role> = { estudiante: 'estudiante', docente: 'docente', padre: 'padre', coordinador: 'coordinacion', tic: 'tecnologia', director: 'admin', administrador: 'admin', siger: 'admin', apoyo: 'admin', psicologia: 'psicologia' }
const LINK_OF: Record<TipoOp, (id: string) => LinkTarget> = {
  estudiante: (id) => ({ studentId: id }),
  docente: (id) => ({ teacherId: id }),
  padre: () => ({}),
  coordinador: () => ({}),
  tic: () => ({}),
  director: () => ({}),
  administrador: () => ({}),
  siger: () => ({}),
  apoyo: () => ({}),
  psicologia: () => ({}),
}
const labelOf = (t: TipoOp) => PERSON_TYPES.find((p) => p.value === t)?.label ?? t

/** Agrupa los tipos de persona por categoría para el selector. */
const TIPO_GROUPS: Array<{ label: string; values: TipoOp[] }> = [
  { label: 'Estudiantes', values: ['estudiante'] },
  { label: 'Docentes', values: ['docente'] },
  { label: 'Personal', values: ['coordinador', 'tic', 'director', 'administrador', 'siger', 'apoyo', 'psicologia'] },
  { label: 'Familias', values: ['padre'] },
]

interface BasePerson { id: string; fullName: string; userId?: string }

export function PersonasPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { grades, subjects, students, teachers, periods } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent, dataService.deleteStudent)
  const teachersCol = useCollection<Teacher>(dataService.getTeachers, dataService.saveTeacher, dataService.deleteTeacher)
  const guardiansCol = useCollection<StudentGuardian>(dataService.getGuardians, dataService.saveGuardian, dataService.deleteGuardian)
  const personasCol = useCollection<Persona>(dataService.getPersonas, dataService.savePersona, dataService.deletePersona)

  const [tab, setTab] = useState('estudiantes')
  const [importOpen, setImportOpen] = useState(false)

  /** Convierte una persona de un tipo a otro: cambia el registro de lista y su rol de Entra ID. */
  async function convertPersona(base: BasePerson, sourceType: TipoOp, targetType: TipoOp) {
    if (sourceType === targetType) return
    if (!base.userId) {
      toaster.dispatchToast('Esta persona no tiene cuenta de Microsoft 365 vinculada; vincúlela antes de cambiar el tipo.', { intent: 'error' })
      return
    }
    const account = (await getDirectoryUsers()).find((u) => u.id === base.userId)
    if (!account) {
      toaster.dispatchToast('La cuenta de Microsoft 365 ya no existe en el directorio.', { intent: 'error' })
      return
    }
    const newId = genId(targetType === 'estudiante' ? 's' : targetType === 'docente' ? 't' : targetType === 'padre' ? 'gr' : 'p')
    try {
      await unlinkUserRole(base.userId, ROLE_OF[sourceType], LINK_OF[sourceType](base.id))
      if (targetType === 'estudiante') {
        await studentsCol.save({ id: newId, fullName: base.fullName, email: entraEmail(account), userId: base.userId, gradeId: grades[0]?.id ?? '', parentName: '', parentEmail: '', birthDate: '' })
        await linkUserRole(account, 'estudiante', { studentId: newId })
      } else if (targetType === 'docente') {
        const teacher: Teacher = { id: newId, fullName: base.fullName, email: entraEmail(account), userId: base.userId, subjects: [], grades: [] }
        await teachersCol.save(teacher)
        await linkUserRole(account, 'docente', { teacherId: newId })
        const sync = await syncTeacherAssignments(teacher, periods)
        void sync
      } else if (targetType === 'padre') {
        await guardiansCol.save({ id: newId, fullName: base.fullName, email: entraEmail(account), userId: base.userId, studentId: '', parentesco: 'padre' })
        await linkUserRole(account, 'padre')
      } else {
        await personasCol.save({ id: newId, fullName: base.fullName, email: entraEmail(account), userId: base.userId, tipo: targetType, createdAt: new Date().toISOString() })
        await linkUserRole(account, ROLE_OF[targetType])
      }
      await removeByType(sourceType, base.id)
      toaster.dispatchToast(`Persona convertida de ${labelOf(sourceType)} a ${labelOf(targetType)}.`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo cambiar el tipo: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  async function removeByType(type: TipoOp, id: string) {
    if (type === 'estudiante') return studentsCol.remove(id)
    if (type === 'docente') return teachersCol.remove(id)
    if (type === 'padre') return guardiansCol.remove(id)
    return personasCol.remove(id)
  }

  /** Columna "Tipo" con selector para cambiar la persona de lista. */
  const tipoCell = (current: TipoOp, item: BasePerson) => (
    <Select value={current} onChange={(_, d) => {
      const t = d.value as TipoOp
      if (t !== current && window.confirm(`¿Convertir "${item.fullName}" de ${labelOf(current)} a ${labelOf(t)}? Se moverá de la lista actual y se actualizará su rol de acceso.`)) {
        void convertPersona(item, current, t)
      }
    }}>
      {TIPO_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.values.map((v) => (<option key={v} value={v}>{labelOf(v)}</option>))}
        </optgroup>
      ))}
    </Select>
  )

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

  const savePersona = async (p: Persona) => {
    if (!p.fullName.trim()) {
      toaster.dispatchToast('Complete el nombre.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(p.userId, labelOf(p.tipo).toLowerCase())
    try {
      const previous = personasCol.items.find((x) => x.id === p.id)
      if (previous?.userId && previous.userId !== account.id) await unlinkUserRole(previous.userId, ROLE_OF[previous.tipo])
      await linkUserRole(account, ROLE_OF[p.tipo])
      await personasCol.save({ ...p, email: entraEmail(account) })
      toaster.dispatchToast(`${labelOf(p.tipo)} guardado y cuenta ${entraEmail(account)} vinculada con rol ${labelOf(p.tipo)}`, { intent: 'success' })
    } catch (error) {
      failed(error)
    }
  }

  const deleteStudent = async (id: string) => { const s = studentsCol.items.find((x) => x.id === id); await unlinkUserRole(s?.userId, 'estudiante', { studentId: id }); await studentsCol.remove(id) }
  const deleteTeacher = async (id: string) => { const t = teachersCol.items.find((x) => x.id === id); await unlinkUserRole(t?.userId, 'docente', { teacherId: id }); await teachersCol.remove(id) }
  const deleteGuardian = async (id: string) => {
    const g = guardiansCol.items.find((x) => x.id === id)
    const others = guardiansCol.items.some((x) => x.id !== id && x.userId && x.userId === g?.userId)
    if (!others) await unlinkUserRole(g?.userId, 'padre')
    await guardiansCol.remove(id)
  }
  const deletePersona = async (id: string) => { const p = personasCol.items.find((x) => x.id === id); await unlinkUserRole(p?.userId, ROLE_OF[p?.tipo ?? 'coordinador']); await personasCol.remove(id) }

  const takenStudentUsers = studentsCol.items.map((x) => x.userId ?? '').filter(Boolean)
  const takenTeacherUsers = teachersCol.items.map((x) => x.userId ?? '').filter(Boolean)
  const takenPersonaUsers = personasCol.items.map((x) => x.userId ?? '').filter(Boolean)

  const studentColumns: CrudColumn<Student>[] = [
    { header: 'Estudiante', render: (s) => <Text weight="semibold">{s.fullName}</Text> },
    { header: 'Cuenta M365', render: (s) => s.email || <Text size={200} style={{ color: '#B42318' }}>Sin vincular</Text> },
    { header: 'Grado', render: (s) => grades.find((g) => g.id === s.gradeId)?.name ?? s.gradeId },
    { header: 'Tipo', render: (s) => tipoCell('estudiante', s) },
    { header: 'Padre / Tutor', render: (s) => s.parentName || '—' },
    { header: 'Contacto', render: (s) => s.parentEmail || '—', hideMobile: true },
  ]

  const teacherColumns: CrudColumn<Teacher>[] = [
    { header: 'Docente', render: (t) => <Text weight="semibold">{t.fullName}</Text> },
    { header: 'Correo', render: (t) => t.email || '—' },
    { header: 'Tipo', render: (t) => tipoCell('docente', t) },
    {
      header: 'Asignaturas',
      render: (t) => <span>{t.subjects.map((id) => subjects.find((s) => s.id === id)?.shortName ?? id).join(', ')}</span>,
    },
  ]

  const personaColumns: CrudColumn<Persona>[] = [
    { header: 'Nombre', render: (p) => <Text weight="semibold">{p.fullName}</Text> },
    { header: 'Correo', render: (p) => p.email || '—' },
    { header: 'Tipo', render: (p) => <StatusBadge status={p.tipo}>{labelOf(p.tipo)}</StatusBadge> },
    { header: 'Cambiar a', render: (p) => tipoCell(p.tipo, p) },
  ]

  return (
    <div>
      <PageHeader
        title="Datos institucionales"
        subtitle="Mantenimiento de estudiantes, docentes, padres y personal de coordinación/TIC. Use la columna 'Tipo' para cambiar la categoría de una persona."
        actions={
          <Button appearance="primary" icon={<CloudArrowDownRegular />} onClick={() => setImportOpen(true)}>
            Importar desde Microsoft 365
          </Button>
        }
      />
      <ImportPersonasWizard open={importOpen} onOpenChange={setImportOpen} />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="estudiantes">Estudiantes ({students.length})</Tab>
        <Tab value="docentes">Docentes ({teachers.length})</Tab>
        <Tab value="padres">Padres ({guardiansCol.items.length})</Tab>
        <Tab value="personas">Personal institucional ({personasCol.items.length})</Tab>
      </TabList>

      {tab === 'estudiantes' && (
        <EntityCrud
          title="Estudiantes"
          items={studentsCol.items}
          loading={studentsCol.loading}
          columns={studentColumns}
          searchText={(s) => `${s.fullName} ${s.parentName}`}
          newLabel="Nuevo estudiante"
          createDefault={() => ({ id: genId('s'), fullName: '', email: '', userId: undefined, gradeId: grades[0]?.id ?? '', parentName: '', parentEmail: '', birthDate: '' })}
          renderForm={(s, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={s.fullName} onChange={(_, d) => set({ ...s, fullName: d.value })} placeholder="Nombre y apellidos" />
              </FormField>
              <EntraUserPicker
                value={s.userId}
                takenIds={takenStudentUsers}
                onChange={(u) => set({ ...s, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? s.fullName })}
                hint="Obligatorio. La cuenta recibirá el rol Estudiante y verá su Campus Virtual."
              />
              <FieldRow>
                <FormField label="Grado / Curso" required>
                  <Select value={s.gradeId} onChange={(_, d) => set({ ...s, gradeId: d.value })}>
                    {grades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
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
          createDefault={() => ({ id: genId('t'), fullName: '', email: '', userId: undefined, subjects: [], grades: [] })}
          renderForm={(t, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={t.fullName} onChange={(_, d) => set({ ...t, fullName: d.value })} />
              </FormField>
              <EntraUserPicker
                value={t.userId}
                takenIds={takenTeacherUsers}
                onChange={(u) => set({ ...t, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? t.fullName })}
                hint="Obligatorio. La cuenta recibirá el rol Docente; el correo institucional se toma de la cuenta."
              />
              <Text size={200} block style={{ color: 'var(--texto-suave)', margin: '4px 0 10px' }}>
                Marque las asignaturas y los grados: al guardar se crean automáticamente las asignaciones (grado × asignatura) del período escolar activo.
              </Text>
              <MultiSelect label="Asignaturas que imparte" placeholder="Filtrar asignaturas…" options={subjects.map((sub) => ({ id: sub.id, label: sub.name, detail: sub.shortName }))} selected={t.subjects} onChange={(ids) => set({ ...t, subjects: ids })} emptyMessage="Cree las asignaturas en Catálogos." />
              <MultiSelect label="Grados y cursos a su cargo" placeholder="Filtrar cursos…" options={grades.map((g) => ({ id: g.id, label: g.name, detail: g.level }))} selected={t.grades} onChange={(ids) => set({ ...t, grades: ids })} emptyMessage="Cree los cursos en Catálogos." />
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
            { header: 'Tipo', render: (g) => tipoCell('padre', g) },
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
                    {studentsCol.items.map((s) => (<option key={s.id} value={s.id}>{s.fullName}</option>))}
                  </Select>
                </FormField>
              </FieldRow>
              <EntraUserPicker
                value={g.userId}
                onChange={(u) => set({ ...g, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? g.fullName })}
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

      {tab === 'personas' && (
        <EntityCrud<Persona>
          title="Personal institucional"
          items={personasCol.items}
          loading={personasCol.loading}
          columns={personaColumns}
          searchText={(p) => `${p.fullName} ${p.email} ${p.tipo}`}
          newLabel="Nuevo personal"
          createDefault={() => ({ id: genId('p'), fullName: '', email: '', userId: undefined, tipo: 'coordinador', createdAt: new Date().toISOString() })}
          renderForm={(p, set) => (
            <div>
              <FormField label="Nombre completo" required>
                <Input value={p.fullName} onChange={(_, d) => set({ ...p, fullName: d.value })} />
              </FormField>
              <EntraUserPicker
                value={p.userId}
                takenIds={takenPersonaUsers}
                onChange={(u) => set({ ...p, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? p.fullName })}
                hint="Obligatorio. La cuenta recibirá el rol según el tipo (Coordinación, Tecnología o Administrativo)."
              />
              <FormField label="Posición / Tipo">
                <Select value={p.tipo} onChange={(_, d) => set({ ...p, tipo: d.value as Persona['tipo'] })}>
                  {['coordinador', 'tic', 'director', 'administrador', 'siger', 'apoyo', 'psicologia'].map((t) => (<option key={t} value={t}>{labelOf(t as TipoOp)}</option>))}
                </Select>
              </FormField>
            </div>
          )}
          onSave={savePersona}
          onDelete={deletePersona}
          emptyMessage="Registre a coordinadores, TIC, dirección y personal de apoyo."
        />
      )}
    </div>
  )
}
