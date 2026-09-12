import { useEffect, useState } from 'react'
import { Button, Input, Select, Spinner, Text, Textarea } from '@fluentui/react-components'
import { SparkleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { isAiConfigured } from '../../services/ai'
import { generarPlanConIA } from './planificadorAi'
import type { PlanAlcance, PlanificacionDinamica } from '../../types'
import { genId, todayIso } from '../../utils/helpers'

const ALCANCES: Array<{ value: PlanAlcance; label: string }> = [
  { value: 'actividad', label: 'Por actividad' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  grades: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
  teacherId: string
  onGenerated: (plan: PlanificacionDinamica) => void | Promise<void>
  onError: (message: string) => void
}

/** Un solo paso: Grado/Curso · Asignatura · Tema u objetivo → ✨ Generar con Asistente IA. */
export function ModalCrearIA({ open, onOpenChange, grades, subjects, teacherId, onGenerated, onError }: Props) {
  const [gradeId, setGradeId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [tema, setTema] = useState('')
  const [alcance, setAlcance] = useState<PlanAlcance>('actividad')
  const [duracion, setDuracion] = useState('')
  const [generando, setGenerando] = useState(false)
  const aiReady = isAiConfigured()

  useEffect(() => {
    if (!open) return
    setGradeId(grades[0]?.id ?? '')
    setSubjectId(subjects[0]?.id ?? '')
    setTema('')
    setAlcance('actividad')
    setDuracion('')
  }, [open, grades, subjects])

  const generar = async () => {
    if (!gradeId || !subjectId || !tema.trim()) {
      onError('Complete grado, asignatura y tema/objetivo.')
      return
    }
    setGenerando(true)
    try {
      const grado = grades.find((g) => g.id === gradeId)?.name ?? ''
      const asignatura = subjects.find((s) => s.id === subjectId)?.name ?? ''
      const plan = await generarPlanConIA({
        grado,
        asignatura,
        tema: tema.trim(),
        alcance,
        duracion: duracion.trim() || undefined,
        defaults: { id: genId('plan'), teacherId, gradeId, subjectId },
      })
      await onGenerated(plan)
      onOpenChange(false)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo generar la planificación.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva planificación con IA"
      subtitle="Indica 3 datos y el asistente redacta la estructura pedagógica completa"
      width={640}
      actions={
        <>
          <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={generando}>Cancelar</Button>
          <Button appearance="primary" icon={generando ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generar()} disabled={generando || !aiReady}>
            {generando ? 'Generando…' : '✨ Generar con Asistente IA'}
          </Button>
        </>
      }
    >
      <div>
        {!aiReady && (
          <Text size={200} block style={{ color: 'var(--rojo)', marginBottom: '10px' }}>
            La IA no está disponible. Configura tu cuenta de IA en «Mi IA» o contacta al administrador.
          </Text>
        )}
        <FieldRow>
          <FormField label="Grado / Curso" required>
            <Select value={gradeId} onChange={(_, d) => setGradeId(d.value)}>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Asignatura" required>
            <Select value={subjectId} onChange={(_, d) => setSubjectId(d.value)}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
        </FieldRow>
        <FormField label="Tema u objetivo" required>
          <Textarea value={tema} onChange={(_, d) => setTema(d.value)} resize="vertical" rows={3} placeholder="Ej. La fotosíntesis: proceso y factores" />
        </FormField>
        <FieldRow>
          <FormField label="Alcance">
            <Select value={alcance} onChange={(_, d) => setAlcance(d.value as PlanAlcance)}>
              {ALCANCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Duración (opcional)" hint={`Hoy: ${todayIso()}`}>
            <Input value={duracion} onChange={(_, d) => setDuracion(d.value)} placeholder="Ej. 45 min / 1 semana" />
          </FormField>
        </FieldRow>
      </div>
    </ModalForm>
  )
}
