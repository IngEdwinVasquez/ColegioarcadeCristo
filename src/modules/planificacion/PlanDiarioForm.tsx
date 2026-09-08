import { useState } from 'react'
import { Button, Input, Select, Text, Textarea, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, DismissRegular } from '@fluentui/react-icons'
import { FormActions, FormField, FieldRow } from '../../components/shared/form'
import { MultiSelect } from '../../components/shared/MultiSelect'
import { useApp } from '../../context/useApp'
import type { DailyPlan, SecuenciaCurricular } from '../../types'
import { genId, todayIso } from '../../utils/helpers'
import {
  COMPETENCIAS_FUNDAMENTALES,
  EJES_TRANSVERSALES,
  NIVELES,
  SECCIONES,
  TIPOS_EVALUACION,
  joinLines,
  splitLines,
} from './curriculo'

const useStyles = makeStyles({
  section: {
    marginTop: '18px',
    padding: '14px 16px',
    borderRadius: '12px',
    background: tokens.colorNeutralBackground2,
    border: '1px solid var(--borde)',
  },
  sectionTitle: { display: 'block', marginBottom: '12px' },
})

interface PlanDiarioFormProps {
  initial?: DailyPlan | null
  onSave: (plan: DailyPlan) => void
  onCancel?: () => void
  submitting?: boolean
}

export function PlanDiarioForm({ initial, onSave, onCancel, submitting = false }: PlanDiarioFormProps) {
  const styles = useStyles()
  const { subjects, grades, teachers, gradeById } = useApp()

  const [form, setForm] = useState<DailyPlan>(() => {
    if (initial) return { ...initial }
    return {
      id: genId('pdia'),
      teacherId: teachers[0]?.id ?? '',
      subjectId: subjects[0]?.id ?? '',
      gradeId: grades[0]?.id ?? '',
      section: '',
      tipo: 'diaria',
      nivel: gradeById(grades[0]?.id)?.level ?? 'Primaria',
      unidad: '',
      tema: '',
      fecha: todayIso(),
      duracion: '45 minutos',
      competenciasFundamentales: [],
      competenciasEspecificas: [],
      ejesTransversales: [],
      contenidos: { conceptuales: '', procedimentales: '', actitudinales: '' },
      actividades: { inicio: '', desarrollo: '', cierre: '' },
      estrategias: [],
      recursos: [],
      indicadoresLogro: [],
      evaluacion: { tipo: 'formativa', instrumento: '', criterios: '' },
      generadoPorIA: false,
      createdAt: new Date().toISOString(),
    }
  })

  const set = <K extends keyof DailyPlan>(key: K, value: DailyPlan[K]) => setForm((f) => ({ ...f, [key]: value }))

  const handleGrade = (gradeId: string) => {
    const level = gradeById(gradeId)?.level ?? ''
    setForm((f) => ({ ...f, gradeId, nivel: level || f.nivel }))
  }

  const submit = () => {
    if (!form.tema || !form.subjectId || !form.gradeId || !form.fecha) {
      window.alert('Complete los campos obligatorios: asignatura, grado, tema y fecha.')
      return
    }
    onSave({ ...form, updatedAt: new Date().toISOString() })
  }

  const asOptions = (arr: string[]) => arr.map((s) => ({ id: s, label: s }))

  return (
    <div>
      <FieldRow>
        <FormField label="Tipo de planificación" required>
          <Select value={form.tipo} onChange={(_, d) => set('tipo', d.value as DailyPlan['tipo'])}>
            <option value="diaria">Planificación diaria</option>
            <option value="unidad">Planificación de unidad</option>
          </Select>
        </FormField>
        <FormField label="Asignatura / Área" required>
          <Select value={form.subjectId} onChange={(_, d) => set('subjectId', d.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="Grado" required>
          <Select value={form.gradeId} onChange={(_, d) => handleGrade(d.value)}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Sección">
          <Select value={form.section} onChange={(_, d) => set('section', d.value)}>
            <option value="">—</option>
            {SECCIONES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Nivel">
          <Select value={form.nivel} onChange={(_, d) => set('nivel', d.value)}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={(_, d) => set('fecha', d.value)} />
        </FormField>
        <FormField label="Duración">
          <Input value={form.duracion} onChange={(_, d) => set('duracion', d.value)} placeholder="Ej. 45 minutos" />
        </FormField>
      </FieldRow>

      <FormField label="Unidad didáctica">
        <Input value={form.unidad} onChange={(_, d) => set('unidad', d.value)} placeholder="Ej. Unidad 3: Los números racionales" />
      </FormField>
      <FormField label="Tema de la sesión" required>
        <Input value={form.tema} onChange={(_, d) => set('tema', d.value)} placeholder="Ej. Operaciones con fracciones" />
      </FormField>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Competencias y ejes transversales</Text>
        <MultiSelect
          label="Competencias fundamentales"
          options={asOptions(COMPETENCIAS_FUNDAMENTALES)}
          selected={form.competenciasFundamentales}
          onChange={(ids) => set('competenciasFundamentales', ids)}
          placeholder="Filtrar competencias…"
        />
        <FormField label="Competencias específicas" hint="Una por línea.">
          <Textarea
            value={joinLines(form.competenciasEspecificas)}
            onChange={(_, d) => set('competenciasEspecificas', splitLines(d.value))}
            resize="vertical"
            rows={3}
          />
        </FormField>
        <MultiSelect
          label="Ejes transversales"
          options={asOptions(EJES_TRANSVERSALES)}
          selected={form.ejesTransversales}
          onChange={(ids) => set('ejesTransversales', ids)}
          placeholder="Filtrar ejes…"
        />
      </div>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Contenidos</Text>
        <FieldRow>
          <FormField label="Conceptuales">
            <Textarea value={form.contenidos.conceptuales} onChange={(_, d) => set('contenidos', { ...form.contenidos, conceptuales: d.value })} resize="vertical" rows={3} />
          </FormField>
          <FormField label="Procedimentales">
            <Textarea value={form.contenidos.procedimentales} onChange={(_, d) => set('contenidos', { ...form.contenidos, procedimentales: d.value })} resize="vertical" rows={3} />
          </FormField>
        </FieldRow>
        <FormField label="Actitudinales">
          <Textarea value={form.contenidos.actitudinales} onChange={(_, d) => set('contenidos', { ...form.contenidos, actitudinales: d.value })} resize="vertical" rows={2} />
        </FormField>
      </div>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Secuencia didáctica</Text>
        <FormField label="Inicio (apertura / saberes previos)">
          <Textarea value={form.actividades.inicio} onChange={(_, d) => set('actividades', { ...form.actividades, inicio: d.value })} resize="vertical" rows={3} />
        </FormField>
        <FormField label="Desarrollo (construcción del aprendizaje)">
          <Textarea value={form.actividades.desarrollo} onChange={(_, d) => set('actividades', { ...form.actividades, desarrollo: d.value })} resize="vertical" rows={4} />
        </FormField>
        <FormField label="Cierre (síntesis y evaluación formativa)">
          <Textarea value={form.actividades.cierre} onChange={(_, d) => set('actividades', { ...form.actividades, cierre: d.value })} resize="vertical" rows={3} />
        </FormField>
      </div>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Estrategias, recursos e indicadores</Text>
        <FieldRow>
          <FormField label="Estrategias" hint="Una por línea.">
            <Textarea value={joinLines(form.estrategias)} onChange={(_, d) => set('estrategias', splitLines(d.value))} resize="vertical" rows={4} />
          </FormField>
          <FormField label="Recursos" hint="Una por línea.">
            <Textarea value={joinLines(form.recursos)} onChange={(_, d) => set('recursos', splitLines(d.value))} resize="vertical" rows={4} />
          </FormField>
        </FieldRow>
        <FormField label="Indicadores de logro" hint="Una por línea.">
          <Textarea value={joinLines(form.indicadoresLogro)} onChange={(_, d) => set('indicadoresLogro', splitLines(d.value))} resize="vertical" rows={3} />
        </FormField>
      </div>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Evaluación</Text>
        <FieldRow>
          <FormField label="Tipo">
            <Select value={form.evaluacion.tipo} onChange={(_, d) => set('evaluacion', { ...form.evaluacion, tipo: d.value })}>
              {TIPOS_EVALUACION.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Instrumento">
            <Input value={form.evaluacion.instrumento} onChange={(_, d) => set('evaluacion', { ...form.evaluacion, instrumento: d.value })} placeholder="Ej. Rúbrica, lista de cotejo…" />
          </FormField>
        </FieldRow>
        <FormField label="Criterios">
          <Textarea value={form.evaluacion.criterios} onChange={(_, d) => set('evaluacion', { ...form.evaluacion, criterios: d.value })} resize="vertical" rows={2} />
        </FormField>
      </div>

      <div className={styles.section}>
        <Text size={400} weight="semibold" className={styles.sectionTitle}>Estructura de Unidad de Aprendizaje (Eduplan · MINERD)</Text>
        <FormField label="Secuencias curriculares correspondientes">
          <SecuenciasEditor value={form.secuenciasCurriculares ?? []} onChange={(s) => set('secuenciasCurriculares', s)} />
        </FormField>
        <FormField label="Recuerda (saberes previos)">
          <Textarea value={form.recuerda ?? ''} onChange={(_, d) => set('recuerda', d.value)} resize="vertical" rows={3} />
        </FormField>
        <FormField label="Situación de aprendizaje">
          <Textarea value={form.situacionAprendizaje ?? ''} onChange={(_, d) => set('situacionAprendizaje', d.value)} resize="vertical" rows={3} />
        </FormField>
        <FieldRow>
          <FormField label="Materiales necesarios" hint="Una por línea.">
            <Textarea value={joinLines(form.materiales ?? [])} onChange={(_, d) => set('materiales', splitLines(d.value))} resize="vertical" rows={3} />
          </FormField>
          <FormField label="Recursos didácticos digitales" hint="Una por línea.">
            <Textarea value={joinLines(form.recursosDigitales ?? [])} onChange={(_, d) => set('recursosDigitales', splitLines(d.value))} resize="vertical" rows={3} />
          </FormField>
        </FieldRow>
      </div>

      {form.generadoPorIA && (
        <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1, marginTop: '8px', display: 'block' }}>
          ✨ Contenido generado con IA. Revise y ajuste antes de guardar.
        </Text>
      )}

      <FormActions onCancel={onCancel} onSubmit={submit} saving={submitting} submitLabel={initial ? 'Actualizar planificación' : 'Guardar planificación'} />
    </div>
  )
}

function SecuenciasEditor({ value, onChange }: { value: SecuenciaCurricular[]; onChange: (v: SecuenciaCurricular[]) => void }) {
  const set = (i: number, patch: Partial<SecuenciaCurricular>) => onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {value.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Input placeholder="Área (ej. Ciencias)" value={s.area} onChange={(_, d) => set(i, { area: d.value })} style={{ flex: 2 }} />
          <Input placeholder="SC 12" value={s.codigo} onChange={(_, d) => set(i, { codigo: d.value })} style={{ width: '80px' }} />
          <Input placeholder="Título de la secuencia" value={s.titulo} onChange={(_, d) => set(i, { titulo: d.value })} style={{ flex: 3 }} />
          <Button appearance="subtle" icon={<DismissRegular />} aria-label="Quitar" onClick={() => onChange(value.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <Button appearance="subtle" icon={<AddRegular />} onClick={() => onChange([...value, { area: '', codigo: '', titulo: '' }])}>
        Añadir secuencia curricular
      </Button>
    </div>
  )
}
