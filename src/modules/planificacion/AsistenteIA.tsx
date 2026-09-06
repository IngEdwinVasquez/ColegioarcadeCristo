import { useState } from 'react'
import { Button, Input, Select, Spinner, Text, Textarea, makeStyles, tokens } from '@fluentui/react-components'
import { SparkleRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { isAdminEmail } from '../../config/appConfig'
import { generatePlanWithAi } from '../../services/planningPrompts'
import { isAiConfigured, AiServiceError } from '../../services/ai'
import { genId, todayIso } from '../../utils/helpers'
import type { DailyPlan } from '../../types'
import { NIVELES } from './curriculo'

const useStyles = makeStyles({
  hint: {
    padding: '10px 14px',
    borderRadius: '10px',
    background: tokens.colorNeutralBackground2,
    fontSize: '13px',
    lineHeight: 1.5,
    marginBottom: '14px',
  },
  error: {
    padding: '10px 14px',
    borderRadius: '10px',
    background: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    fontSize: '13px',
    marginTop: '12px',
  },
})

interface AsistenteIAProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (plan: DailyPlan) => void
}

export function AsistenteIA({ open, onOpenChange, onGenerated }: AsistenteIAProps) {
  const styles = useStyles()
  const { user, teachers, subjects, grades, subjectById, gradeById } = useApp()
  const isSuperadmin = isAdminEmail(user?.email)

  const teacherId = user?.teacherId ?? teachers[0]?.id ?? ''
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? '')
  const [tema, setTema] = useState('')
  const [tipo, setTipo] = useState<DailyPlan['tipo']>('diaria')
  const [duracion, setDuracion] = useState('45 minutos')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configured = isAiConfigured()

  const generar = async () => {
    if (!tema.trim()) {
      setError('Indique el tema o unidad a planificar.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const grade = gradeById(gradeId)
      const subject = subjectById(subjectId)
      const plan = await generatePlanWithAi({
        nivel: grade?.level ?? 'Primaria',
        grado: grade?.name ?? '',
        asignatura: subject?.name ?? '',
        tema: tema.trim(),
        tipo,
        duracion: duracion || undefined,
        observaciones: observaciones || undefined,
        defaults: {
          id: genId('pdia'),
          teacherId,
          subjectId,
          gradeId,
          section: '',
          fecha: todayIso(),
        },
      })
      onGenerated(plan)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof AiServiceError ? err.message : err instanceof Error ? err.message : 'Error al generar la planificación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalForm open={open} onOpenChange={onOpenChange} title="Generar planificación con IA" subtitle="El asistente crea la planificación según el diseño curricular del MINERD." width={620}>
      {!configured && (
        <div className={styles.hint}>
          <Text weight="semibold">El asistente de IA no está configurado.</Text>
          <br />
          Defina <code>VITE_AI_PROVIDER</code> y <code>VITE_AI_API_URL</code> (ver <code>docs/IA_PLANIFICACION.md</code>). Mientras tanto puede crear la planificación manualmente.
        </div>
      )}

      <FieldRow>
        <FormField label="Asignatura / Área" required>
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
        <FormField label="Tipo">
          <Select value={tipo} onChange={(_, d) => setTipo(d.value as DailyPlan['tipo'])}>
            <option value="diaria">Diaria</option>
            <option value="unidad">Unidad</option>
          </Select>
        </FormField>
        <FormField label="Nivel (referencia)">
          <Select value={gradeById(gradeId)?.level ?? ''} onChange={() => undefined} disabled>
            {NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Duración">
          <Input value={duracion} onChange={(_, d) => setDuracion(d.value)} />
        </FormField>
      </FieldRow>

      <FormField label="Tema / Unidad a planificar" required>
        <Input value={tema} onChange={(_, d) => setTema(d.value)} placeholder="Ej. El sistema solar y sus planetas" />
      </FormField>
      <FormField label="Observaciones adicionales (opcional)">
        <Textarea value={observaciones} onChange={(_, d) => setObservaciones(d.value)} resize="vertical" rows={2} placeholder="Ej. Adaptación para estudiantes con NEE, enfoque en trabajo colaborativo…" />
      </FormField>

      {error && <div className={styles.error}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button appearance="secondary" icon={<ArrowLeftRegular />} onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button appearance="primary" icon={loading ? undefined : <SparkleRegular />} onClick={() => void generar()} disabled={loading || !configured || !isSuperadmin}>
          {loading ? <><Spinner size="tiny" style={{ marginRight: '8px' }} /> Generando…</> : 'Generar planificación'}
        </Button>
      </div>
    </ModalForm>
  )
}
