import { useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, Card, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell,
  TableRow, Text, Textarea, Input, Toolbar, ToolbarButton, useToastController, makeStyles,
} from '@fluentui/react-components'
import {
  AddRegular, CalendarMonthRegular, DeleteRegular, DocumentPdfRegular, EditRegular,
  NoteAddRegular, OpenRegular, PrintRegular, SparkleRegular,
} from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { generateActivityPlanWithAi } from '../../services/ticAi'
import { isAiConfigured } from '../../services/ai'
import { formatDate, genId, monthLabel, monthsBetween, todayIso } from '../../utils/helpers'
import type { ActivityPlan, Period, WeeklySchedule, WorkCronograma, WorkPlanEntry } from '../../types'

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

/** Una actividad del horario lleva cronograma si su texto inicia con «acompañamiento» o «capacitación». */
const isEligible = (cell: string) => {
  const n = normalize(cell)
  return n.startsWith('acompanamiento') || n.startsWith('capacitacion')
}

const extractEntries = (horarios: WeeklySchedule[]): WorkPlanEntry[] => {
  const out: WorkPlanEntry[] = []
  for (const h of horarios) {
    for (const row of h.rows) {
      row.cells.forEach((cell, di) => {
        const t = (cell ?? '').trim()
        if (t && isEligible(t)) out.push({ id: genId('wp'), day: WEEK_DAYS[di % WEEK_DAYS.length], time: row.time, activity: t })
      })
    }
  }
  return out
}

/** Genera los cinco años escolares estándar (2025-2026 … 2029-2030). */
const schoolYears = (): Period[] =>
  Array.from({ length: 5 }, (_, i) => {
    const y = 2025 + i
    return {
      id: `year-${y}-${y + 1}`,
      name: `Año escolar ${y} - ${y + 1}`,
      startDate: `${y}-09-01`,
      endDate: `${y + 1}-06-30`,
      isActive: false,
    }
  })

const useStyles = makeStyles({
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' },
  card: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' },
  report: { background: '#fff', border: '1px solid var(--borde)', borderRadius: '12px', padding: '24px', maxWidth: '900px', marginTop: '16px' },
  printBlock: { display: 'none' },
  planPhase: { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' },
})

interface CronogramaViewProps {
  c: WorkCronograma
  onPlan?: (e: WorkPlanEntry) => void
  onViewPlan?: (e: WorkPlanEntry) => void
  aiReady?: boolean
}

function CronogramaView({ c, onPlan, onViewPlan, aiReady }: CronogramaViewProps) {
  const styles = useStyles()
  const showPlan = !!(onPlan || onViewPlan)
  const cols = showPlan ? 6 : 5
  return (
    <div className={styles.report}>
      <Text size={400} weight="bold" block>{c.title}</Text>
      <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '10px' }}>
        {c.periodName} · Mes: {c.monthLabel} · Generado el {formatDate(todayIso())}
      </Text>
      <Table aria-label={c.title} size="small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>#</TableHeaderCell>
            <TableHeaderCell>Día</TableHeaderCell>
            <TableHeaderCell>Hora</TableHeaderCell>
            <TableHeaderCell>Actividad</TableHeaderCell>
            <TableHeaderCell>Responsable</TableHeaderCell>
            {showPlan && <TableHeaderCell>Plan</TableHeaderCell>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {c.entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={cols}>
                <Text size={300} style={{ color: 'var(--texto-suave)' }}>No hay actividades de acompañamiento o capacitación para este mes.</Text>
              </TableCell>
            </TableRow>
          )}
          {c.entries.map((e, i) => (
            <TableRow key={e.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{e.day}</TableCell>
              <TableCell><Text weight="semibold">{e.time}</Text></TableCell>
              <TableCell>{e.activity}</TableCell>
              <TableCell>{e.responsable ?? '—'}</TableCell>
              {showPlan && (
                <TableCell>
                  {e.plan ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Button size="small" appearance="subtle" icon={<SparkleRegular />} onClick={() => onViewPlan?.(e)}>Ver plan</Button>
                      <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => onPlan?.(e)}>Regenerar</Button>
                    </div>
                  ) : (
                    <Button size="small" appearance="subtle" icon={<SparkleRegular />} disabled={!aiReady} onClick={() => onPlan?.(e)}>Generar plan</Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {c.observations && (
        <Text size={300} block style={{ marginTop: '12px' }}><strong>Observaciones:</strong> {c.observations}</Text>
      )}
    </div>
  )
}

const PHASE_META: Array<{ key: 'inicio' | 'desarrollo' | 'cierre'; label: string; color: string }> = [
  { key: 'inicio', label: 'Inicio', color: '#0095C8' },
  { key: 'desarrollo', label: 'Desarrollo', color: '#EA580C' },
  { key: 'cierre', label: 'Cierre', color: '#15803D' },
]

function PlanDetails({ plan, activity, day, time, cronograma, periodName, monthLabel }: {
  plan: ActivityPlan
  activity?: string
  day?: string
  time?: string
  cronograma?: string
  periodName?: string
  monthLabel?: string
}) {
  const styles = useStyles()
  const data: Array<[string, string]> = [
    ['Solicitante', plan.solicitante],
    ['Rol', plan.rolSolicitante ?? '—'],
    ['Objetivo de la actividad', plan.objetivo],
    ['Contenidos / temas', plan.contenidos || '—'],
    ['Audiencia', plan.audiencia || '—'],
    ['Recursos', plan.recursos || '—'],
    ['Estrategia / metodología', plan.estrategia || '—'],
    ['Evaluación / resultados esperados', plan.evaluacion || '—'],
  ]
  const firma = (nombre: string | undefined, label: string) => (
    <div style={{ flex: 1, minWidth: '200px', textAlign: 'center' }}>
      <div style={{ borderBottom: '1px solid #333', height: '40px' }} />
      <Text size={200} block weight="semibold" style={{ marginTop: '4px' }}>{nombre || '\u00A0'}</Text>
      <Text size={200} block>{label}</Text>
      <Text size={100} block style={{ color: 'var(--texto-suave)' }}>Fecha: ____ / ____ / ______</Text>
    </div>
  )
  return (
    <div className={styles.report}>
      <Text size={400} weight="bold" block>Plan de la actividad</Text>
      <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '12px' }}>
        {cronograma ? `${cronograma} · ` : ''}{periodName ? `${periodName} · ` : ''}{monthLabel ? `Mes: ${monthLabel} · ` : ''}{activity ? `Actividad: ${activity}` : ''}{(day || time) ? ` · ${day ?? ''} ${time ?? ''}` : ''}
      </Text>
      {data.map(([label, value]) => (
        <div key={label} style={{ marginBottom: '8px' }}>
          <Text size={200} weight="semibold" block style={{ color: 'var(--texto-suave)' }}>{label}</Text>
          <Text size={300} block>{value}</Text>
        </div>
      ))}
      <Text weight="semibold" size={300} block style={{ marginTop: '10px' }}>Desarrollo del plan</Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
        {PHASE_META.map((p) => (
          <Card key={p.key} className={styles.planPhase}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge appearance="filled" style={{ background: p.color, color: '#fff' }}>{p.label}</Badge>
              <Text size={300} weight="semibold">{plan[p.key].duracion || 'Sin tiempo'}</Text>
            </div>
            <Text size={300} block>{plan[p.key].detalle}</Text>
          </Card>
        ))}
      </div>
      <Text weight="semibold" size={300} block style={{ marginTop: '20px' }}>Firmas</Text>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '22px' }}>
        {firma(plan.firmantes?.acompanado, 'El acompañado / participante')}
        {firma(plan.firmantes?.ofrece ?? plan.generadoPor, 'Quien ofrece el acompañamiento/capacitación')}
        {firma(plan.firmantes?.directivo, 'Director/a o Coordinador/a Pedagógico/a')}
      </div>
    </div>
  )
}

export function CronogramaTrabajoPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const periodCol = useCollection<Period>(dataService.getPeriods, dataService.savePeriod, dataService.deletePeriod)
  const horCol = useCollection<WeeklySchedule>(dataService.getWeeklySchedules, dataService.saveWeeklySchedule, dataService.deleteWeeklySchedule)
  const cronoCol = useCollection<WorkCronograma>(dataService.getWorkCronogramas, dataService.saveWorkCronograma, dataService.deleteWorkCronograma)

  const [periodId, setPeriodId] = useState('')
  const [horarioId, setHorarioId] = useState('')
  const [editing, setEditing] = useState<WorkCronograma | null>(null)
  const [viewing, setViewing] = useState<WorkCronograma | null>(null)
  const [printDoc, setPrintDoc] = useState<WorkCronograma | null>(null)
  const [planFor, setPlanFor] = useState<{ entryId: string; activity: string; day: string; time: string } | null>(null)
  const [planView, setPlanView] = useState<{ entry: WorkPlanEntry; crono: WorkCronograma } | null>(null)
  const [planPrint, setPlanPrint] = useState<{ entry: WorkPlanEntry; crono: WorkCronograma } | null>(null)
  const [planGenerating, setPlanGenerating] = useState(false)
  const [solicitante, setSolicitante] = useState('')
  const [rolSolicitante, setRolSolicitante] = useState('Coordinador TIC')
  const [objetivo, setObjetivo] = useState('')
  const [contenidos, setContenidos] = useState('')
  const [audiencia, setAudiencia] = useState('')
  const [estrategia, setEstrategia] = useState('')
  const [recursos, setRecursos] = useState('')
  const [evaluacion, setEvaluacion] = useState('')
  const [firmaAcompanado, setFirmaAcompanado] = useState('')
  const [firmaOfrece, setFirmaOfrece] = useState('')
  const [firmaDirectivo, setFirmaDirectivo] = useState('')

  // Elimina períodos de prueba y garantiza los cinco años escolares estándar.
  useEffect(() => {
    if (periodCol.loading) return
    for (const x of periodCol.items) {
      if (/prueba/i.test(x.name)) void periodCol.remove(x.id)
    }
    for (const p of schoolYears()) {
      const y = Number(p.id.split('-')[1])
      const exists = periodCol.items.some((x) => {
        const m = x.name.match(/(\d{4})\s*-\s*(\d{4})/)
        return m && Number(m[1]) === y && Number(m[2]) === y + 1 && !/prueba/i.test(x.name)
      })
      if (!exists) void periodCol.save(p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodCol.loading])

  const sortedPeriods = useMemo(() => [...periodCol.items].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)), [periodCol.items])

  const periodIdForYear = (y: number) => `year-${y}-${y + 1}`

  useEffect(() => {
    if (!periodId && sortedPeriods.length) {
      const today = todayIso()
      const currentYear = new Date(today.length === 10 ? `${today}T00:00:00` : today).getMonth() >= 7 ? new Date(today).getFullYear() : new Date(today).getFullYear() - 1
      const current = sortedPeriods.find((p) => p.id === periodIdForYear(currentYear)) ?? sortedPeriods.find((p) => p.startDate <= today && today <= p.endDate) ?? sortedPeriods[0]
      setPeriodId(current.id)
    }
  }, [sortedPeriods, periodId])

  useEffect(() => {
    if (!horarioId && horCol.items.length) setHorarioId(horCol.items[0].id)
  }, [horCol.items, horarioId])

  const period = sortedPeriods.find((p) => p.id === periodId)
  const months = useMemo(() => (period ? monthsBetween(period.startDate, period.endDate) : []), [period])

  const selectedHorarios = useMemo(
    () => (horarioId ? horCol.items.filter((h) => h.id === horarioId) : horCol.items),
    [horCol.items, horarioId],
  )

  const aiReady = isAiConfigured()

  const cronoFor = (month: string) => cronoCol.items.find((c) => c.periodId === periodId && c.month === month)

  const newCronograma = (month: string): WorkCronograma => ({
    id: genId('crono'),
    periodId,
    periodName: period?.name ?? '',
    month,
    monthLabel: monthLabel(month),
    title: `Cronograma de trabajo · ${monthLabel(month)}`,
    responsable: user?.displayName,
    observations: '',
    entries: extractEntries(selectedHorarios),
    createdAt: new Date().toISOString(),
  })

  const importar = async () => {
    const fromHor = extractEntries(selectedHorarios)
    setEditing((e) => (e ? { ...e, entries: fromHor.length ? fromHor : e.entries } : e))
    if (!fromHor.length) toaster.dispatchToast('No hay actividades de acompañamiento o capacitación en el horario.', { intent: 'warning' })
  }

  const guardar = async () => {
    if (!editing) return
    if (!editing.title.trim()) {
      toaster.dispatchToast('Indique el título del cronograma.', { intent: 'error' })
      return
    }
    try {
      await cronoCol.save({ ...editing, updatedAt: new Date().toISOString() })
      toaster.dispatchToast('Cronograma guardado.', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    }
  }

  const eliminar = async (c: WorkCronograma) => {
    if (!window.confirm(`¿Eliminar el cronograma de ${c.monthLabel}?`)) return
    await cronoCol.remove(c.id)
    toaster.dispatchToast('Cronograma eliminado.', { intent: 'success' })
  }

  const printCronograma = (c: WorkCronograma) => {
    setPlanPrint(null)
    setPrintDoc(c)
    setTimeout(() => window.print(), 60)
  }

  const openPlanForm = (e: WorkPlanEntry) => {
    setPlanFor({ entryId: e.id, activity: e.activity, day: e.day, time: e.time })
    setSolicitante(user?.displayName ?? '')
    setRolSolicitante('Coordinador TIC')
    setFirmaAcompanado('')
    setFirmaOfrece(user?.displayName ?? '')
    setFirmaDirectivo('')

    const norm = normalize(e.activity)
    const isCap = norm.startsWith('capacitacion')
    const isAccomp = norm.startsWith('acompanamiento')
    const lower = norm.toLowerCase()

    let audiencia = 'Participantes de la actividad (a definir)'
    if (lower.includes('aula')) audiencia = 'Docentes y estudiantes del aula'
    else if (lower.includes('personal')) audiencia = 'Personal docente y administrativo'
    else if (lower.includes('docente')) audiencia = 'Docentes'
    else if (lower.includes('estudiante')) audiencia = 'Estudiantes'

    setObjetivo(`Planificar y ejecutar la actividad «${e.activity}» (${e.day}, ${e.time}) según el cronograma de trabajo del mes.`)
    setContenidos(
      isCap
        ? `Contenidos de la capacitación derivados de la actividad «${e.activity}».`
        : isAccomp
          ? `Seguimiento de la planificación e impartición de la clase en «${e.activity}».`
          : `Temas de la actividad «${e.activity}».`,
    )
    setAudiencia(audiencia)
    setEstrategia(
      isAccomp
        ? 'Acompañamiento presencial: observación de la práctica, retroalimentación y compromisos de mejora.'
        : isCap
          ? 'Taller práctico: presentación de contenidos, actividades aplicadas y trabajo colaborativo.'
          : 'Actividad planificada con presentación de la información y práctica guiada.',
    )
    setRecursos(
      isCap
        ? 'Ambiente del centro, plataforma M365, materiales y dispositivos disponibles.'
        : isAccomp
          ? 'Planificación y/o clase del docente, rúbrica de observación y hoja de compromisos.'
          : 'Recursos didácticos y tecnológicos del centro.',
    )
    setEvaluacion(
      isCap
        ? 'Participación y aplicación de lo aprendido; lista de cotejo o producto final.'
        : isAccomp
          ? 'Reflexión de lo aprendido, autoevaluación y recomendaciones de mejora.'
          : 'Participación, comprensión de los contenidos y reflexión final.',
    )
  }

  const openPlanView = (e: WorkPlanEntry, crono: WorkCronograma) => {
    setPlanView({ entry: e, crono })
  }

  const printPlan = (v: { entry: WorkPlanEntry; crono: WorkCronograma }) => {
    setPrintDoc(null)
    setPlanPrint(v)
    setTimeout(() => window.print(), 60)
  }

  const generarPlan = async () => {
    if (!planFor) return
    if (!solicitante.trim() || !objetivo.trim()) {
      toaster.dispatchToast('Complete al menos el solicitante y el objetivo.', { intent: 'error' })
      return
    }
    setPlanGenerating(true)
    try {
      const phases = await generateActivityPlanWithAi({
        activity: planFor.activity,
        day: planFor.day,
        time: planFor.time,
        cronograma: viewing?.title ?? '',
        solicitante: solicitante.trim(),
        rolSolicitante,
        objetivo: objetivo.trim(),
        contenidos: contenidos.trim(),
        audiencia: audiencia.trim(),
        estrategia: estrategia.trim(),
        recursos: recursos.trim(),
        evaluacion: evaluacion.trim(),
      })
      const plan: ActivityPlan = {
        id: genId('plan'),
        solicitante: solicitante.trim(),
        rolSolicitante,
        objetivo: objetivo.trim(),
        contenidos: contenidos.trim(),
        audiencia: audiencia.trim(),
        estrategia: estrategia.trim(),
        recursos: recursos.trim(),
        evaluacion: evaluacion.trim(),
        inicio: phases.inicio,
        desarrollo: phases.desarrollo,
        cierre: phases.cierre,
        firmantes: { acompanado: firmaAcompanado.trim(), ofrece: firmaOfrece.trim(), directivo: firmaDirectivo.trim() },
        generadoPor: user?.displayName,
        createdAt: new Date().toISOString(),
      }
      const updated: WorkCronograma = {
        ...viewing!,
        entries: viewing!.entries.map((x) => (x.id === planFor.entryId ? { ...x, plan } : x)),
      }
      await cronoCol.save({ ...updated, updatedAt: new Date().toISOString() })
      setViewing(updated)
      const entry = updated.entries.find((x) => x.id === planFor.entryId)
      setPlanFor(null)
      if (entry) setPlanView({ entry, crono: updated })
      toaster.dispatchToast('Plan de la actividad generado con IA.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo generar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setPlanGenerating(false)
    }
  }

  const setEditEntry = (idx: number, patch: Partial<WorkPlanEntry>) =>
    setEditing((e) => (e ? { ...e, entries: e.entries.map((x, i) => (i === idx ? { ...x, ...patch } : x)) } : e))

  const removeEntry = (idx: number) =>
    setEditing((e) => (e ? { ...e, entries: e.entries.filter((_, i) => i !== idx) } : e))

  const setEntries = (entries: WorkPlanEntry[]) => setEditing((e) => (e ? { ...e, entries } : e))

  const rowCount = periodCol.loading || horCol.loading || cronoCol.loading

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #cronograma-print, #cronograma-print *, #plan-print, #plan-print * { visibility: visible !important; }
          #cronograma-print, #plan-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; z-index: 99999; }
        }
      `}</style>

      <PageHeader
        title="Cronograma de trabajo"
        subtitle="Actividades de acompañamiento y capacitación del horario semanal, organizadas por mes dentro del período educativo."
      />

      <div className={styles.filters}>
        <FormField label="Período educativo">
          <Select value={periodId} onChange={(_, d) => setPeriodId(d.value)} style={{ minWidth: '260px' }}>
            {sortedPeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Horario de trabajo" hint="Elegido para extraer las actividades de acompañamiento/capacitación.">
          <Select value={horarioId} onChange={(_, d) => setHorarioId(d.value)} style={{ minWidth: '260px' }}>
            {horCol.items.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
          </Select>
        </FormField>
      </div>

      {rowCount ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Spinner label="Cargando cronogramas…" /></div>
      ) : periodCol.items.length === 0 ? (
        <EmptyStateView title="No hay períodos educativos" message="Configure los períodos educativos para organizar los cronogramas por mes." icon={<CalendarMonthRegular />} />
      ) : months.length === 0 ? (
        <EmptyStateView title="Sin meses para este período" message="El período no tiene un rango de fechas válido." icon={<CalendarMonthRegular />} />
      ) : (
        <Table aria-label="Cronogramas por mes">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Mes</TableHeaderCell>
              <TableHeaderCell>Actividades</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => {
              const c = cronoFor(m)
              return (
                <TableRow key={m}>
                  <TableCell><Text weight="semibold">Mes: {monthLabel(m)}</Text></TableCell>
                  <TableCell>{c ? `${c.entries.length} actividad(es)` : <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin cronograma</Text>}</TableCell>
                  <TableCell>
                    {c ? <Badge appearance="filled" color="success">Creado</Badge> : <Badge appearance="outline" color="warning">Pendiente</Badge>}
                  </TableCell>
                  <TableCell>
                    <Toolbar size="small">
                      {!c && <ToolbarButton icon={<AddRegular />} onClick={() => setEditing(newCronograma(m))}>Crear</ToolbarButton>}
                      {c && <ToolbarButton icon={<OpenRegular />} onClick={() => setViewing(c)}>Ver</ToolbarButton>}
                      {c && <ToolbarButton icon={<EditRegular />} onClick={() => setEditing({ ...c, entries: c.entries.map((x) => ({ ...x })) })}>Editar</ToolbarButton>}
                      {c && <ToolbarButton icon={<PrintRegular />} onClick={() => printCronograma(c)}>Guardar PDF</ToolbarButton>}
                      {c && <ToolbarButton icon={<DeleteRegular />} onClick={() => void eliminar(c)} />}
                    </Toolbar>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {printDoc && <div id="cronograma-print" className={styles.printBlock}><CronogramaView c={printDoc} /></div>}

      {/* -------- Crear / Editar cronograma -------- */}
      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing && cronoCol.items.some((x) => x.id === editing.id) ? `Editar · ${editing.monthLabel}` : `Crear cronograma · ${editing?.monthLabel ?? ''}`}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" icon={<NoteAddRegular />} onClick={() => void guardar()} disabled={cronoCol.saving}>
              {cronoCol.saving ? 'Guardando…' : 'Guardar cronograma'}
            </Button>
          </>
        }
      >
        {editing && (
          <div>
            <FieldRow>
              <FormField label="Título">
                <Input value={editing.title} onChange={(_, d) => setEditing({ ...editing, title: d.value })} />
              </FormField>
              <FormField label="Responsable">
                <Input value={editing.responsable ?? ''} onChange={(_, d) => setEditing({ ...editing, responsable: d.value })} />
              </FormField>
            </FieldRow>

            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <Text size={300} style={{ color: 'var(--texto-suave)' }}>
                Se incluyen solo las actividades del horario que inician con «acompañamiento» o «capacitación».
              </Text>
              <Button appearance="secondary" size="small" icon={<SparkleRegular />} onClick={() => void importar()}>
                Importar del horario semanal
              </Button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <Table aria-label="Actividades del cronograma" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Día</TableHeaderCell>
                    <TableHeaderCell>Hora</TableHeaderCell>
                    <TableHeaderCell>Actividad</TableHeaderCell>
                    <TableHeaderCell>Responsable</TableHeaderCell>
                    <TableHeaderCell> </TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editing.entries.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Select value={e.day} onChange={(_, d) => setEditEntry(i, { day: d.value })} style={{ minWidth: '120px' }}>
                          {WEEK_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </Select>
                      </TableCell>
                      <TableCell><Input value={e.time} onChange={(_, d) => setEditEntry(i, { time: d.value })} style={{ minWidth: '110px' }} placeholder="09:30 - 11:30" /></TableCell>
                      <TableCell><Input value={e.activity} onChange={(_, d) => setEditEntry(i, { activity: d.value })} style={{ minWidth: '220px' }} /></TableCell>
                      <TableCell><Input value={e.responsable ?? ''} onChange={(_, d) => setEditEntry(i, { responsable: d.value })} style={{ minWidth: '150px' }} /></TableCell>
                      <TableCell><Button appearance="subtle" icon={<DeleteRegular />} aria-label="Quitar actividad" onClick={() => removeEntry(i)} /></TableCell>
                    </TableRow>
                  ))}
                  {editing.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Text size={300} style={{ color: 'var(--texto-suave)' }}>Sin actividades. Pulse «Importar del horario semanal» para añadirlas automáticamente o agregue una fila.</Text>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <Button appearance="subtle" icon={<AddRegular />} onClick={() => setEntries([...editing.entries, { id: genId('wp'), day: 'Lunes', time: '', activity: '', responsable: '' }])}>
                Añadir actividad
              </Button>
              <Text size={200} style={{ color: 'var(--texto-suave)', alignSelf: 'center' }}>{editing.entries.length} actividad(es)</Text>
            </div>

            <FormField label="Observaciones">
              <Textarea value={editing.observations ?? ''} onChange={(_, d) => setEditing({ ...editing, observations: d.value })} resize="vertical" />
            </FormField>
          </div>
        )}
      </ModalForm>

      {/* -------- Ver cronograma -------- */}
      <ModalForm
        open={!!viewing}
        onOpenChange={(o) => { if (!o) setViewing(null) }}
        title="Cronograma de trabajo"
        subtitle={viewing?.monthLabel}
        width={900}
        actions={
          <>
            <Button appearance="secondary" icon={<DocumentPdfRegular />} onClick={() => viewing && printCronograma(viewing)}>Guardar PDF</Button>
            <Button appearance="primary" onClick={() => setViewing(null)}>Cerrar</Button>
          </>
        }
      >
        {viewing && <CronogramaView c={viewing} onPlan={openPlanForm} onViewPlan={(e) => openPlanView(e, viewing)} aiReady={aiReady} />}
      </ModalForm>

      {/* -------- Generar plan de la actividad con IA -------- */}
      <ModalForm
        open={!!planFor}
        onOpenChange={(o) => { if (!o) setPlanFor(null) }}
        title="Generar plan de la actividad con IA"
        subtitle={planFor ? `${planFor.day} · ${planFor.time} · ${planFor.activity}` : undefined}
        width={720}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setPlanFor(null)}>Cancelar</Button>
            <Button appearance="primary" icon={planGenerating ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generarPlan()} disabled={planGenerating || !aiReady}>
              {planGenerating ? 'Generando…' : 'Generar plan'}
            </Button>
          </>
        }
      >
        {planFor && (
          <div>
            <Text size={300} block style={{ color: 'var(--texto-suave)', marginBottom: '10px' }}>
              Complete el formulario de solicitud. Junto a la información de la actividad ({planFor.day} · {planFor.time}), la IA generará el plan con inicio, desarrollo y cierre.
            </Text>
            <FieldRow>
              <FormField label="Solicitante" required>
                <Input value={solicitante} onChange={(_, d) => setSolicitante(d.value)} placeholder="Nombre de quien solicita" />
              </FormField>
              <FormField label="Rol del solicitante">
                <Select value={rolSolicitante} onChange={(_, d) => setRolSolicitante(d.value)}>
                  {['Coordinador TIC', 'Coordinador pedagógico', 'Docente', 'Personal directivo', 'Otro'].map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FormField label="Objetivo de la actividad" required>
              <Textarea value={objetivo} onChange={(_, d) => setObjetivo(d.value)} resize="vertical" rows={2} placeholder="¿Qué se busca lograr con esta capacitación / acompañamiento?" />
            </FormField>
            <FormField label="Contenidos / temas a tratar">
              <Textarea value={contenidos} onChange={(_, d) => setContenidos(d.value)} resize="vertical" rows={2} placeholder="Temas que se desarrollarán" />
            </FormField>
            <FormField label="Audiencia / destinatarios">
              <Input value={audiencia} onChange={(_, d) => setAudiencia(d.value)} placeholder="Ej. Docentes de Primaria, estudiantes de 1ro. A, personal administrativo…" />
            </FormField>
            <FormField label="Estrategia / metodología sugerida">
              <Textarea value={estrategia} onChange={(_, d) => setEstrategia(d.value)} resize="vertical" rows={2} placeholder="Ej. taller práctico, demostración, trabajo en equipos…" />
            </FormField>
            <FieldRow>
              <FormField label="Recursos disponibles">
                <Textarea value={recursos} onChange={(_, d) => setRecursos(d.value)} resize="vertical" rows={2} placeholder="Ej. computadoras, proyector, plataforma M365, materiales…" />
              </FormField>
              <FormField label="Cómo se evaluará / resultados esperados">
                <Textarea value={evaluacion} onChange={(_, d) => setEvaluacion(d.value)} resize="vertical" rows={2} placeholder="Ej. lista de cotejo, participación, producto final…" />
              </FormField>
            </FieldRow>
            <Text weight="semibold" size={300} block style={{ marginTop: '4px' }}>Firmas del plan</Text>
            <FieldRow>
              <FormField label="Nombre del acompañado / participante">
                <Input value={firmaAcompanado} onChange={(_, d) => setFirmaAcompanado(d.value)} placeholder="Quien recibe el acompañamiento" />
              </FormField>
              <FormField label="Nombre de quien ofrece el acompañamiento">
                <Input value={firmaOfrece} onChange={(_, d) => setFirmaOfrece(d.value)} placeholder="Quien imparte la capacitación/acompañamiento" />
              </FormField>
            </FieldRow>
            <FormField label="Nombre del director/a o coordinador/a pedagógico/a">
              <Input value={firmaDirectivo} onChange={(_, d) => setFirmaDirectivo(d.value)} placeholder="Director/a o coordinador/a pedagógico/a del centro" />
            </FormField>
          </div>
        )}
      </ModalForm>

      {/* -------- Ver / regenerar plan -------- */}
      <ModalForm
        open={!!planView}
        onOpenChange={(o) => { if (!o) setPlanView(null) }}
        title="Plan de la actividad"
        subtitle={planView ? `${planView.entry.day} · ${planView.entry.time} · ${planView.entry.activity}` : undefined}
        width={820}
        actions={
          <>
            <Button appearance="secondary" icon={<EditRegular />} onClick={() => { const e = planView?.entry; if (e) { setPlanView(null); openPlanForm(e) } }}>Regenerar</Button>
            <Button appearance="secondary" icon={<DocumentPdfRegular />} onClick={() => planView && printPlan(planView)}>Guardar PDF</Button>
            <Button appearance="primary" onClick={() => setPlanView(null)}>Cerrar</Button>
          </>
        }
      >
        {planView?.entry.plan && (
          <PlanDetails
            plan={planView.entry.plan}
            activity={planView.entry.activity}
            day={planView.entry.day}
            time={planView.entry.time}
            cronograma={planView.crono.title}
            periodName={planView.crono.periodName}
            monthLabel={planView.crono.monthLabel}
          />
        )}
      </ModalForm>

      {planPrint?.entry.plan && (
        <div id="plan-print" className={styles.printBlock}>
          <PlanDetails
            plan={planPrint.entry.plan}
            activity={planPrint.entry.activity}
            day={planPrint.entry.day}
            time={planPrint.entry.time}
            cronograma={planPrint.crono.title}
            periodName={planPrint.crono.periodName}
            monthLabel={planPrint.crono.monthLabel}
          />
        </div>
      )}
    </div>
  )
}
