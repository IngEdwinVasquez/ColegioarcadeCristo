import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Spinner, Text, Textarea } from '@fluentui/react-components'
import { AddRegular, ArrowLeftRegular, ArrowRightRegular, CheckmarkCircleRegular, SaveRegular, SparkleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { isAiConfigured } from '../../services/ai'
import { generarPlanConIA } from './planificadorAi'
import type { PlanAlcance, PlanificacionDinamica } from '../../types'
import { genId } from '../../utils/helpers'

const ALCANCES: Array<{ value: PlanAlcance; label: string }> = [
  { value: 'unidad', label: 'Por unidad de aprendizaje' },
  { value: 'actividad', label: 'Por actividad' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
]

const ENFOQUE_BASE = [
  'Activo / participativo',
  'Aprendizaje cooperativo',
  'Basado en proyectos',
  'STEAM (ciencia, tecnología, arte y matemática)',
  'Aula invertida',
  'Resolución de problemas',
]

const ENFOQUES_KEY = 'arca_plan_enfoques'

function cargarEnfoques(): string[] {
  let extra: string[] = []
  try {
    const raw = localStorage.getItem(ENFOQUES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) extra = parsed.map((x) => String(x)).filter(Boolean)
    }
  } catch { extra = [] }
  return [...ENFOQUE_BASE, ...extra.filter((e) => !ENFOQUE_BASE.includes(e))]
}

function guardarEnfoque(nombre: string) {
  const extra = cargarEnfoques().filter((e) => !ENFOQUE_BASE.includes(e))
  if (extra.includes(nombre)) return
  try { localStorage.setItem(ENFOQUES_KEY, JSON.stringify([...extra, nombre])) } catch { /* ignore */ }
}

const PASOS = ['Contexto', 'Enfoque', 'Resultado']

interface Assignment { gradeId: string; subjectId: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  grades: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
  assignments: Assignment[]
  teacherId: string
  /** 'subject' = abierto desde el aula de una asignatura: alcance fijo "por unidad". */
  mode?: 'general' | 'subject'
  onGenerated: (plan: PlanificacionDinamica) => void | Promise<void>
  onError: (message: string) => void
}

/** Guía visual de planificación en 3 pasos: Contexto → Enfoque → Resultado. */
export function ModalCrearIA({ open, onOpenChange, grades, subjects, assignments, teacherId, mode = 'general', onGenerated, onError }: Props) {
  const esUnidad = mode === 'subject'
  const [paso, setPaso] = useState(0)
  const [gradeId, setGradeId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [tema, setTema] = useState('')
  const [alcance, setAlcance] = useState<PlanAlcance>(esUnidad ? 'unidad' : 'actividad')
  const [duracion, setDuracion] = useState('')
  const [enfoque, setEnfoque] = useState(ENFOQUE_BASE[0])
  const [enfoques, setEnfoques] = useState<string[]>(ENFOQUE_BASE)
  const [nuevoEnfoque, setNuevoEnfoque] = useState('')
  const [prompt, setPrompt] = useState('')
  const [integracionTec, setIntegracionTec] = useState('')
  const [adecuaciones, setAdecuaciones] = useState('')
  const [generando, setGenerando] = useState(false)
  const [preview, setPreview] = useState<PlanificacionDinamica | null>(null)
  const aiReady = isAiConfigured()

  const gradeOptions = useMemo(() => {
    const ids = [...new Set(assignments.map((a) => a.gradeId))]
    return ids.map((id) => grades.find((g) => g.id === id)).filter((g): g is { id: string; name: string } => !!g)
  }, [assignments, grades])

  const subjectOptions = useMemo(() => {
    if (!gradeId) return []
    const ids = [...new Set(assignments.filter((a) => a.gradeId === gradeId).map((a) => a.subjectId))]
    return ids.map((id) => subjects.find((s) => s.id === id)).filter((s): s is { id: string; name: string } => !!s)
  }, [assignments, gradeId, subjects])

  const firstSubject = (gId: string) => assignments.find((a) => a.gradeId === gId)?.subjectId ?? ''

  useEffect(() => {
    if (!open) return
    const firstGrade = gradeOptions[0]?.id ?? ''
    setPaso(0)
    setGradeId(firstGrade)
    setSubjectId(firstSubject(firstGrade))
    setTema('')
    setAlcance(esUnidad ? 'unidad' : 'actividad')
    setDuracion('')
    const lista = cargarEnfoques()
    setEnfoques(lista)
    setEnfoque(lista[0])
    setNuevoEnfoque('')
    setPrompt('')
    setIntegracionTec('')
    setAdecuaciones('')
    setPreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gradeOptions, esUnidad])

  const agregarEnfoque = () => {
    const nombre = nuevoEnfoque.trim()
    if (!nombre) return
    guardarEnfoque(nombre)
    if (!enfoques.includes(nombre)) setEnfoques((prev) => [...prev, nombre])
    setEnfoque(nombre)
    setNuevoEnfoque('')
  }

  const sinAsignaturas = gradeOptions.length === 0

  const generar = async () => {
    if (!gradeId || !subjectId || !tema.trim()) { onError('Complete grado, asignatura y tema/objetivo.'); return }
    setGenerando(true)
    try {
      const grado = gradeOptions.find((g) => g.id === gradeId)?.name ?? ''
      const asignatura = subjectOptions.find((s) => s.id === subjectId)?.name ?? ''
      const plan = await generarPlanConIA({
        grado,
        asignatura,
        tema: tema.trim(),
        alcance: esUnidad ? 'unidad' : alcance,
        duracion: duracion.trim() || undefined,
        enfoque,
        integracionTec: integracionTec.trim() || undefined,
        adecuaciones: adecuaciones.trim() || undefined,
        observaciones: prompt.trim() || undefined,
        defaults: { id: genId('plan'), teacherId, gradeId, subjectId },
      })
      setPreview(plan)
      setPaso(2)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'No se pudo generar la planificación.')
    } finally {
      setGenerando(false)
    }
  }

  const guardar = async () => {
    if (!preview) return
    await onGenerated(preview)
    onOpenChange(false)
  }

  const actions = () => {
    if (paso === 0) {
      return (
        <>
          <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button appearance="primary" icon={<ArrowRightRegular />} disabled={sinAsignaturas || !tema.trim() || !subjectId} onClick={() => setPaso(1)}>Continuar</Button>
        </>
      )
    }
    if (paso === 1) {
      return (
        <>
          <Button appearance="secondary" icon={<ArrowLeftRegular />} onClick={() => setPaso(0)} disabled={generando}>Atrás</Button>
          <Button appearance="primary" icon={generando ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={generando || !aiReady} onClick={() => void generar()}>
            {generando ? 'Generando…' : 'Generar planificación'}
          </Button>
        </>
      )
    }
    return (
      <>
        <Button appearance="secondary" icon={<ArrowLeftRegular />} onClick={() => setPaso(1)} disabled={generando}>Atrás</Button>
        <Button appearance="secondary" icon={generando ? <Spinner size="tiny" /> : <SparkleRegular />} disabled={generando} onClick={() => void generar()}>Regenerar</Button>
        <Button appearance="primary" icon={<SaveRegular />} onClick={() => void guardar()}>Guardar planificación</Button>
      </>
    )
  }

  return (
    <ModalForm open={open} onOpenChange={onOpenChange} title="Guía de planificación" subtitle="Tres pasos: contexto, enfoque y resultado. La IA redacta la planificación alineada al currículo dominicano." width={720} actions={actions()}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {PASOS.map((label, i) => {
          const activo = i === paso
          return (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--borde)', background: activo ? 'linear-gradient(135deg,#0A4E63,#0082AD)' : 'var(--superficie)' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: activo ? 'rgba(255,255,255,0.22)' : 'var(--borde)', color: activo ? '#fff' : 'var(--texto-suave)' }}>{i + 1}</span>
              <Text size={200} weight={activo ? 'semibold' : 'regular'} style={{ color: activo ? '#fff' : 'var(--texto-suave)' }}>{label}</Text>
            </div>
          )
        })}
      </div>

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
          {paso === 0 && (
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
              <FormField label={esUnidad ? 'Tema de la unidad' : 'Tema u objetivo'} required>
                <Textarea value={tema} onChange={(_, d) => setTema(d.value)} resize="vertical" rows={3} placeholder={esUnidad ? 'Ej. Unidad 3: La fotosíntesis, proceso y factores' : 'Ej. La fotosíntesis: proceso y factores'} />
              </FormField>
              <FieldRow>
                {esUnidad ? (
                  <FormField label="Alcance" hint="La planificación siempre se hace por unidad de aprendizaje.">
                    <Text size={300} block style={{ paddingTop: '8px' }}>Por unidad de aprendizaje</Text>
                  </FormField>
                ) : (
                  <FormField label="Alcance">
                    <Select value={alcance} onChange={(_, d) => setAlcance(d.value as PlanAlcance)}>
                      {ALCANCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </Select>
                  </FormField>
                )}
                <FormField label="Duración (opcional)">
                  <Input value={duracion} onChange={(_, d) => setDuracion(d.value)} placeholder="Ej. 45 min / 1 semana" />
                </FormField>
              </FieldRow>
              <FormField label="Instrucciones para la IA (opcional)" hint="Escribe lo que quieras pedirle a la IA: actividades, recursos, evaluación, formato, etc.">
                <Textarea value={prompt} onChange={(_, d) => setPrompt(d.value)} resize="vertical" rows={3} placeholder="Ej. Incluye una actividad en Teams y una rúbrica de evaluación." />
              </FormField>
            </>
          )}

          {paso === 1 && (
            <>
              <FormField label="Enfoque pedagógico">
                <Select value={enfoque} onChange={(_, d) => setEnfoque(d.value)}>
                  {enfoques.map((e) => <option key={e} value={e}>{e}</option>)}
                </Select>
              </FormField>
              <FormField label="Agregar un nuevo enfoque" hint="Se guardará para reutilizarlo en próximas planificaciones.">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input
                    style={{ flex: 1 }}
                    value={nuevoEnfoque}
                    onChange={(_, d) => setNuevoEnfoque(d.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEnfoque() } }}
                    placeholder="Ej. Aprendizaje basado en gamificación"
                  />
                  <Button icon={<AddRegular />} disabled={!nuevoEnfoque.trim()} onClick={agregarEnfoque}>Agregar</Button>
                </div>
              </FormField>
              <FormField label="Recursos tecnológicos a integrar (opcional)" hint="Se incluirán en la planificación (M365, Teams, laboratorio, robótica…).">
                <Input value={integracionTec} onChange={(_, d) => setIntegracionTec(d.value)} placeholder="Ej. Teams, PowerPoint, Excel, laboratorio" />
              </FormField>
              <FormField label="Adecuaciones (opcional)" hint="Necesidades específicas del grupo.">
                <Textarea value={adecuaciones} onChange={(_, d) => setAdecuaciones(d.value)} resize="vertical" rows={2} placeholder="Ej. estudiantes con NEE, ritmos distintos…" />
              </FormField>
            </>
          )}

          {paso === 2 && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '440px', overflowY: 'auto' }}>
              <Card style={{ padding: '12px' }}>
                <Text weight="semibold" block>Objetivo</Text>
                <Text size={200} block>{preview.objetivo || '—'}</Text>
              </Card>
              <Card style={{ padding: '12px' }}>
                <Text weight="semibold" block>Competencias</Text>
                <Text size={200} block>{preview.competencias.join(' · ') || '—'}</Text>
                <Text weight="semibold" block style={{ marginTop: '6px' }}>Indicadores de logro</Text>
                <Text size={200} block>{preview.indicadores.join(' · ') || '—'}</Text>
              </Card>
              <Card style={{ padding: '12px' }}>
                <Text weight="semibold" block>Momentos de la clase</Text>
                {preview.momentos.map((m) => (
                  <div key={m.momento} style={{ marginTop: '6px' }}>
                    <Text size={200} weight="semibold" block style={{ textTransform: 'capitalize' }}>{m.momento} · {m.duracion}</Text>
                    <Text size={200} block>{m.descripcion}</Text>
                    <Text size={200} block style={{ color: 'var(--texto-suave)' }}>{m.actividades.join(' · ')}</Text>
                  </div>
                ))}
              </Card>
              <Card style={{ padding: '12px' }}>
                <Text weight="semibold" block>Recursos y herramientas</Text>
                <Text size={200} block>{preview.recursos.join(' · ') || '—'}</Text>
                <Text size={200} block style={{ color: 'var(--texto-suave)' }}>{preview.herramientasTec.join(' · ')}</Text>
              </Card>
              <Card style={{ padding: '12px' }}>
                <Text weight="semibold" block>Evaluación</Text>
                <Text size={200} block>{preview.evaluacion || '—'}</Text>
              </Card>
              <Text size={200} style={{ color: 'var(--texto-suave)' }}><CheckmarkCircleRegular /> Puedes regenerar o guardar. La planificación quedará en tu planificador.</Text>
            </div>
          )}
        </>
      )}
    </ModalForm>
  )
}
