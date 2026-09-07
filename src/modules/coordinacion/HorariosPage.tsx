import { useMemo, useState } from 'react'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, OpenRegular, CalendarLtrRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow, FormActions } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import type { ClassSchedule } from '../../types'
import { genId } from '../../utils/helpers'
import { SECCIONES as SECCIONES_CUR } from '../planificacion/curriculo'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  small: { color: tokens.colorNeutralForeground2 },
})

export function HorariosPage() {
  const styles = useStyles()
  const { teachers, grades, subjects, gradeById, subjectById, teacherById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()

  const col = useCollection<ClassSchedule>(dataService.getSchedules, dataService.saveSchedule, dataService.deleteSchedule)

  const [teacherFilter, setTeacherFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassSchedule | null>(null)

  const levelGradeIds = useMemo(() => grades.filter((g) => g.level === level).map((g) => g.id), [grades, level])
  const levelGrades = useMemo(() => grades.filter((g) => levelGradeIds.includes(g.id)), [grades, levelGradeIds])
  const levelTeachers = useMemo(() => teachers.filter((t) => t.grades.some((g) => levelGradeIds.includes(g))), [teachers, levelGradeIds])

  const filtered = useMemo(() => {
    const arr = col.items.filter((s) => levelGradeIds.includes(s.gradeId))
    return teacherFilter ? arr.filter((s) => s.teacherId === teacherFilter) : arr
  }, [col.items, levelGradeIds, teacherFilter])

  const openNew = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (s: ClassSchedule) => { setEditing(s); setFormOpen(true) }
  const handleDelete = async (s: ClassSchedule) => {
    if (!window.confirm('¿Desea eliminar este horario?')) return
    try { await col.remove(s.id) } catch { /* error del hook */ }
  }

  const handleSave = async (s: ClassSchedule) => {
    await col.save({ ...s, createdAt: s.createdAt ?? new Date().toISOString() })
    setFormOpen(false)
  }

  const sorted = [...filtered].sort((a, b) => (a.day === b.day ? a.startTime.localeCompare(b.startTime) : DIAS.indexOf(a.day) - DIAS.indexOf(b.day)))

  return (
    <div>
      <PageHeader
        title="Horarios de clase"
        subtitle="Asigne el horario de cada docente dentro de su nivel (curso, sección, asignatura, día y hora) para verificar el cumplimiento."
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Asignar horario</Button>}
      />
      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>

      <div className={styles.filterRow}>
        <Select value={teacherFilter} onChange={(_, d) => setTeacherFilter(d.value)} style={{ minWidth: '200px' }}>
          <option value="">Todos los docentes</option>
          {levelTeachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
        </Select>
      </div>

      {sorted.length === 0 && !col.loading && (
        <EmptyStateView title="Sin horarios" message="Asigne el horario de clase de los docentes de este nivel." icon={<CalendarLtrRegular />} action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Asignar horario</Button>} />
      )}

      {sorted.length > 0 && (
        <Table aria-label="Horarios de clase">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Docente</TableHeaderCell>
              <TableHeaderCell>Curso</TableHeaderCell>
              <TableHeaderCell>Sección</TableHeaderCell>
              <TableHeaderCell>Asignatura</TableHeaderCell>
              <TableHeaderCell>Día</TableHeaderCell>
              <TableHeaderCell>Hora</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.id}>
                <TableCell className={styles.cell}><Text weight="semibold">{teacherById(s.teacherId)?.fullName ?? '—'}</Text></TableCell>
                <TableCell className={styles.cell}>{gradeById(s.gradeId)?.name ?? '—'}</TableCell>
                <TableCell className={styles.cell}>{s.section || '—'}</TableCell>
                <TableCell className={styles.cell}>{subjectById(s.subjectId)?.name ?? '—'}</TableCell>
                <TableCell className={styles.cell}>{s.day}</TableCell>
                <TableCell className={styles.cell}><span className={styles.small}>{s.startTime} – {s.endTime}</span></TableCell>
                <TableCell className={styles.cell}>
                  <Toolbar size="small" style={{ gap: '4px' }}>
                    <ToolbarButton icon={<OpenRegular />} onClick={() => openEdit(s)}>Editar</ToolbarButton>
                    <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(s)}>Eliminar</ToolbarButton>
                  </Toolbar>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ModalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar horario' : 'Asignar horario'}
        subtitle={`Horario de clase · ${level}`}
      >
        <ScheduleForm
          initial={editing}
          levelGradeIds={levelGradeIds}
          levelGrades={levelGrades}
          teachers={levelTeachers}
          subjects={subjects}
          onSave={(s) => void handleSave(s)}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>
    </div>
  )
}

interface ScheduleFormProps {
  initial?: ClassSchedule | null
  levelGradeIds: string[]
  levelGrades: ReturnType<typeof useApp>['grades']
  teachers: ReturnType<typeof useApp>['teachers']
  subjects: ReturnType<typeof useApp>['subjects']
  onSave: (s: ClassSchedule) => void
  onCancel: () => void
}

function ScheduleForm({ initial, levelGrades, teachers, subjects, onSave, onCancel }: ScheduleFormProps) {
  const [form, setForm] = useState<ClassSchedule>(() =>
    initial ?? {
      id: genId('sch'),
      teacherId: teachers[0]?.id ?? '',
      gradeId: levelGrades[0]?.id ?? '',
      section: '',
      subjectId: subjects[0]?.id ?? '',
      day: 'Lunes',
      startTime: '07:45',
      endTime: '08:30',
      createdAt: new Date().toISOString(),
    })

  const set = <K extends keyof ClassSchedule>(k: K, v: ClassSchedule[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.teacherId || !form.gradeId || !form.subjectId || !form.day) {
      window.alert('Complete docente, curso, asignatura y día.')
      return
    }
    onSave(form)
  }

  const subjectsOfTeacher = teachers.find((t) => t.id === form.teacherId)?.subjects ?? []
  const teacherSubjects = subjects.filter((s) => subjectsOfTeacher.includes(s.id))

  return (
    <div>
      <FieldRow>
        <FormField label="Docente" required>
          <Select value={form.teacherId} onChange={(_, d) => set('teacherId', d.value)}>
            {teachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
          </Select>
        </FormField>
        <FormField label="Curso" required>
          <Select value={form.gradeId} onChange={(_, d) => set('gradeId', d.value)}>
            {levelGrades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Sección">
          <Select value={form.section} onChange={(_, d) => set('section', d.value)}>
            <option value="">—</option>
            {SECCIONES_CUR.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
        </FormField>
        <FormField label="Asignatura" required>
          <Select value={form.subjectId} onChange={(_, d) => set('subjectId', d.value)}>
            {(teacherSubjects.length ? teacherSubjects : subjects).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Día" required>
          <Select value={form.day} onChange={(_, d) => set('day', d.value)}>
            {DIAS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </Select>
        </FormField>
        <FormField label="Hora de inicio">
          <Input type="time" value={form.startTime} onChange={(_, d) => set('startTime', d.value)} />
        </FormField>
        <FormField label="Hora de fin">
          <Input type="time" value={form.endTime} onChange={(_, d) => set('endTime', d.value)} />
        </FormField>
      </FieldRow>
      <FormActions onCancel={onCancel} onSubmit={submit} submitLabel={initial ? 'Actualizar' : 'Guardar'} />
    </div>
  )
}
