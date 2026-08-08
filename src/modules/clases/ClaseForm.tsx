import { useState } from 'react'
import { Input, Select } from '@fluentui/react-components'
import { FormActions, FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import type { SchoolClassRecord } from '../../types'
import { genId, todayIso } from '../../utils/helpers'

interface ClaseFormProps {
  onSave: (record: SchoolClassRecord) => void | Promise<void>
  onCancel: () => void
}

export function ClaseForm({ onSave, onCancel }: ClaseFormProps) {
  const { subjects, grades, teachers, subjectById } = useApp()
  const [saving, setSaving] = useState(false)
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '')
  const [date, setDate] = useState(todayIso())
  const [period, setPeriod] = useState('7:45 - 8:30')
  const [title, setTitle] = useState('')

  const submit = async () => {
    if (!title || !subjectId || !gradeId || !date) {
      window.alert('Complete los campos obligatorios: título, asignatura, grado y fecha.')
      return
    }
    const teacher = teachers.find((t) => t.subjects.includes(subjectId))
    const record: SchoolClassRecord = {
      id: genId('class'),
      planId: '',
      subjectId,
      teacherId: teacher?.id ?? teachers[0]?.id ?? '',
      gradeId,
      date,
      period,
      title,
      status: 'en_progreso',
      before: { objectives: '', content: '', activities: '', resources: '', cronograma: `${period}: ${title}` },
      during: { development: '', participation: '', observations: '' },
      after: { reflection: '', achieved: '', toImprove: '', report: '' },
      createdAt: new Date().toISOString(),
    }
    setSaving(true)
    await onSave(record)
    setSaving(false)
  }

  return (
    <div>
      <FieldRow>
        <FormField label="Asignatura" required>
          <Select value={subjectId} onChange={(_, d) => setSubjectId(d.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Grado" required>
          <Select value={gradeId} onChange={(_, d) => setGradeId(d.value)}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Fecha" required>
          <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
        </FormField>
        <FormField label="Periodo / Hora">
          <Input value={period} onChange={(_, d) => setPeriod(d.value)} />
        </FormField>
      </FieldRow>
      <FormField label="Título de la clase" required>
        <Input value={title} onChange={(_, d) => setTitle(d.value)} placeholder="Ej. Matemáticas · Operaciones con fracciones" />
      </FormField>
      <FormField label="Asignatura seleccionada" hint="Docente asignado automáticamente.">
        <Input value={subjectById(subjectId)?.name ?? ''} readOnly disabled />
      </FormField>
      <FormActions onCancel={onCancel} onSubmit={() => void submit()} saving={saving} submitLabel="Registrar clase" />
    </div>
  )
}
