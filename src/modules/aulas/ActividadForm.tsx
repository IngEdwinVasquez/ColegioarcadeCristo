import { useState } from 'react'
import { Input, Select, Textarea } from '@fluentui/react-components'
import { FormActions, FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import type { Activity } from '../../types'
import { genId, todayIso } from '../../utils/helpers'

interface ActividadFormProps {
  initial?: Activity | null
  onSave: (activity: Activity) => void | Promise<void>
  onCancel: () => void
}

export function ActividadForm({ initial, onSave, onCancel }: ActividadFormProps) {
  const { subjects, grades, teachers } = useApp()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Activity>(() => {
    if (initial) return { ...initial }
    return {
      id: genId('act'),
      subjectId: subjects[0]?.id ?? '',
      teacherId: teachers[0]?.id ?? '',
      gradeId: grades[0]?.id ?? '',
      title: '',
      description: '',
      type: 'tarea',
      points: 20,
      publishDate: todayIso(),
      dueDate: todayIso(),
      status: 'publicada',
      attachments: [],
    }
  })

  const set = <K extends keyof Activity>(key: K, value: Activity[K]) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubject = (subjectId: string) => {
    const teacher = teachers.find((t) => t.subjects.includes(subjectId))
    setForm((f) => ({ ...f, subjectId, teacherId: teacher?.id ?? f.teacherId }))
  }

  const submit = async () => {
    if (!form.title || !form.subjectId || !form.gradeId) {
      window.alert('Complete los campos obligatorios: título, asignatura y grado.')
      return
    }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div>
      <FormField label="Título de la actividad" required>
        <Input value={form.title} onChange={(_, d) => set('title', d.value)} placeholder="Ej. Tarea: operaciones con fracciones" />
      </FormField>
      <FormField label="Descripción / instrucciones">
        <Textarea value={form.description} onChange={(_, d) => set('description', d.value)} resize="vertical" />
      </FormField>
      <FieldRow>
        <FormField label="Asignatura" required>
          <Select value={form.subjectId} onChange={(_, d) => handleSubject(d.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Grado" required>
          <Select value={form.gradeId} onChange={(_, d) => set('gradeId', d.value)}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Tipo de actividad">
          <Select value={form.type} onChange={(_, d) => set('type', d.value as Activity['type'])}>
            <option value="tarea">Tarea</option>
            <option value="quiz">Quiz</option>
            <option value="proyecto">Proyecto</option>
            <option value="evaluacion">Evaluación</option>
            <option value="lectura">Lectura</option>
            <option value="foro">Foro</option>
          </Select>
        </FormField>
        <FormField label="Valor (puntos)">
          <Input type="number" value={String(form.points)} onChange={(_, d) => set('points', Number(d.value))} />
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Fecha de publicación">
          <Input type="date" value={form.publishDate} onChange={(_, d) => set('publishDate', d.value)} />
        </FormField>
        <FormField label="Fecha de entrega">
          <Input type="date" value={form.dueDate} onChange={(_, d) => set('dueDate', d.value)} />
        </FormField>
      </FieldRow>
      <FormField label="Estado">
        <Select value={form.status} onChange={(_, d) => set('status', d.value as Activity['status'])}>
          <option value="borrador">Borrador</option>
          <option value="publicada">Publicada</option>
          <option value="cerrada">Cerrada</option>
        </Select>
      </FormField>
      <FormActions onCancel={onCancel} onSubmit={() => void submit()} saving={saving} submitLabel={initial ? 'Actualizar actividad' : 'Publicar actividad'} />
    </div>
  )
}
