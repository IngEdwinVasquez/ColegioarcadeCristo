import { useState } from 'react'
import { Input, Select, Textarea } from '@fluentui/react-components'
import { FormActions, FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import type { ClassPlan } from '../../types'
import { genId, todayIso } from '../../utils/helpers'

interface PlanFormProps {
  initial?: ClassPlan | null
  onSave: (plan: ClassPlan) => void
  onCancel: () => void
}

export function PlanForm({ initial, onSave, onCancel }: PlanFormProps) {
  const { subjects, grades, teachers } = useApp()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ClassPlan>(() => {
    if (initial) return { ...initial }
    return {
      id: genId('plan'),
      subjectId: subjects[0]?.id ?? '',
      teacherId: teachers[0]?.id ?? '',
      gradeId: grades[0]?.id ?? '',
      date: todayIso(),
      period: '7:45 - 8:30',
      topic: '',
      objective: '',
      content: '',
      strategy: '',
      resources: '',
      evaluation: '',
      status: 'planificada',
    }
  })

  const set = <K extends keyof ClassPlan>(key: K, value: ClassPlan[K]) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubject = (subjectId: string) => {
    const teacher = teachers.find((t) => t.subjects.includes(subjectId))
    setForm((f) => ({ ...f, subjectId, teacherId: teacher?.id ?? f.teacherId }))
  }

  const submit = async () => {
    if (!form.topic || !form.subjectId || !form.gradeId || !form.date) {
      window.alert('Complete los campos obligatorios: tema, asignatura, grado y fecha.')
      return
    }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div>
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
        <FormField label="Fecha" required>
          <Input type="date" value={form.date} onChange={(_, d) => set('date', d.value)} />
        </FormField>
        <FormField label="Periodo / Hora">
          <Input value={form.period} onChange={(_, d) => set('period', d.value)} />
        </FormField>
      </FieldRow>
      <FormField label="Tema de la clase" required>
        <Input value={form.topic} onChange={(_, d) => set('topic', d.value)} placeholder="Ej. Operaciones con fracciones" />
      </FormField>
      <FormField label="Docente" hint="Se asigna automáticamente según la asignatura.">
        <Select value={form.teacherId} onChange={(_, d) => set('teacherId', d.value)}>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.fullName}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Objetivo de aprendizaje">
        <Textarea value={form.objective} onChange={(_, d) => set('objective', d.value)} resize="vertical" />
      </FormField>
      <FormField label="Contenido a desarrollar">
        <Textarea value={form.content} onChange={(_, d) => set('content', d.value)} resize="vertical" />
      </FormField>
      <FormField label="Estrategia didáctica">
        <Input value={form.strategy} onChange={(_, d) => set('strategy', d.value)} placeholder="Ej. Trabajo colaborativo" />
      </FormField>
      <FieldRow>
        <FormField label="Recursos">
          <Textarea value={form.resources} onChange={(_, d) => set('resources', d.value)} resize="vertical" />
        </FormField>
        <FormField label="Evaluación">
          <Textarea value={form.evaluation} onChange={(_, d) => set('evaluation', d.value)} resize="vertical" />
        </FormField>
      </FieldRow>
      <FormActions onCancel={onCancel} onSubmit={() => void submit()} saving={saving} submitLabel={initial ? 'Actualizar plan' : 'Guardar plan'} />
    </div>
  )
}
