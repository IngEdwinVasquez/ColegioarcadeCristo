import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Spinner, Text, Textarea } from '@fluentui/react-components'
import { SparkleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { isAiConfigured } from '../../services/ai'
import { generarPlanConIA } from './planificadorAi'
import type { PlanAlcance, PlanificacionDinamica } from '../../types'
import { genId } from '../../utils/helpers'

const ALCANCES: Array<{ value: PlanAlcance; label: string }> = [
  { value: 'actividad', label: 'Por actividad' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

interface Assignment {
  gradeId: string
  subjectId: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  grades: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
  /** Pares grado–asignatura asignados al docente (limita las opciones). */
  assignments: Assignment[]
  teacherId: string
  onGenerated: (plan: PlanificacionDinamica) => void | Promise<void>
  onError: (message: string) => void
}

/** Un solo paso: Grado/Curso · Asignatura · Tema u objetivo → ✨ Generar con Asistente IA. */
export function ModalCrearIA({ open, onOpenChange, grades, subjects, assignments, teacherId, onGenerated, onError }: Props) {
  const [gradeId, setGradeId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [tema, setTema] = useState('')
  const [alcance, setAlcance] = useState<PlanAlcance>('actividad')
  const [duracion, setDuracion] = useState('')
  const [generando, setGenerando] = useState(false)
  const aiReady = isAiConfigured()

  // Solo los grados/cursos asignados al docente (con nombre resuelto).
  const gradeOptions = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.gradeId))]
    return ids.map((id) => grades.find((g) => g.id === id)).filter((g): g is { id: string; name: string } => !!g)
  }, [assignments, grades])

  // Solo las asignaturas asignadas para el grado seleccionado.
  const subjectOptions = useMemo(() => {
    if (!gradeId) return []
    const ids = [...new Set(assignments.filter((a) => a.gradeId === gradeId).map((a) => a.subjectId))]
    return ids.map((id) => subjects.find((s) => s.id === id)).filter((s): s is { id: string; name: string } => !!s)
  }, [assignments, gradeId, subjects])

  const firstSubject = (gId: string) => assignments.find((a) => a.gradeId === gId)?.subjectId ?? ''

  useEffect(() => {
    if (!open) return
    const firstGrade = gradeOptions[0]?.id ?? ''
    setGradeId(firstGrade)
    setSubjectId(firstSubject(firstGrade))
    setTema('')
    setAlcance('actividad')
    setDuracion('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gradeOptions])

  const sinAsignaturas = gradeOptions.length === 0

  const generar = async () => {
    if (!gradeId || !subjectId || !tema.trim()) {
      onError('Complete grado, asignatura y tema/objetivo.')
      return
    }
    setGenerando(true)
    try {
      const grado = gradeOptions.find((g) => g.id === gradeId)?.name ?? ''
      const asignatura = subjectOptions.find((s) => s.id === subjectId)?.name ?? ''
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
          <Button appearance="primary" icon={generando ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generar()} disabled={generando || !aiReady || sinAsignaturas}>
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
        {sinAsignaturas ? (
          <Text size={300} block style={{ color: 'var(--texto-suave)' }}>
            No tienes cursos ni asignaturas asignados. Solicita a coordinación o dirección que te asigne los cursos y asignaturas para poder planificar.
          </Text>
        ) : (
          <>
            <FieldRow>
              <FormField label="Grado / Curso" required hint="Solo tus cursos asignados.">
                <Select value={gradeId} onChange={(_, d) => { setGradeId(d.value); setSubjectId(firstSubject(d.value)) }}>
                  {gradeOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Asignatura" required hint="Solo tus asignaturas asignadas.">
                <Select value={subjectId} onChange={(_, d) => setSubjectId(d.value)}>
                  {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <FormField label="Duración (opcional)">
                <Input value={duracion} onChange={(_, d) => setDuracion(d.value)} placeholder="Ej. 45 min / 1 semana" />
              </FormField>
            </FieldRow>
          </>
        )}
      </div>
    </ModalForm>
  )
}
