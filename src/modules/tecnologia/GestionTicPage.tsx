import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Badge, Button, Card, Input, ProgressBar, Select, Spinner, Tab, TabList, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow, Text, Textarea, Toolbar, ToolbarButton, useToastController, makeStyles, tokens,
} from '@fluentui/react-components'
import {
  AddRegular, AttachRegular, CalendarAddRegular, DeleteRegular, DocumentPdfRegular, EditRegular,
  ImageRegular, NoteAddRegular, OpenRegular, PrintRegular, SparkleRegular, CloudArrowUpRegular,
} from '@fluentui/react-icons'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { CronogramaTrabajoPage } from './CronogramaTrabajoPage'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { StatCard } from '../../components/shared/StatCard'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadAndShare } from '../../services/onedrive'
import { graphRequest, graphErrorMessage } from '../../services/graph'
import { extractPdfText } from '../../services/pdf'
import { generateTicPlanWithAi, generateAnnualPlanDocumentWithAi, parseWeeklySchedulePdf } from '../../services/ticAi'
import { isAiConfigured } from '../../services/ai'
import { appConfig } from '../../config/appConfig'
import { formatDate, genId, monthLabel, pct, todayIso } from '../../utils/helpers'
import { gradientes } from '../../theme'
import type { AnnualPlanDocument, TicActivity, TicCategoryItem, TicScope, TicStage, TicStatus, WeeklySchedule } from '../../types'

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const SCOPE_LABELS: Record<TicScope, string> = { anual: 'Anual', mensual: 'Mensual', semanal: 'Semanal' }
const STAGE_LABELS: Record<TicStage, string> = { inicio: 'Inicio', desarrollo: 'Desarrollo', finalizacion: 'Finalización' }
const STATUS_LABELS: Record<TicStatus, string> = { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada' }
const DEFAULT_CATEGORIES = ['Infraestructura', 'Soporte técnico', 'Capacitación', 'Innovación educativa', 'Plataforma M365', 'Otros']
const STAGE_COLORS: Record<TicStage, string> = { inicio: '#0095C8', desarrollo: '#EA580C', finalizacion: '#15803D' }

/** Meses del año escolar para la planificación anual. */
const ANNUAL_MONTHS = ['Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio']

/** Mes (o rango de meses) que abarca la planificación de una actividad. */
const periodLabel = (a: TicActivity): string => {
  if (a.scope === 'anual') return 'Agosto – Junio'
  const start = monthLabel(a.startDate)
  const end = monthLabel(a.endDate)
  return start === end ? start : `${start} – ${end}`
}
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  infraestructura: 'Infraestructura',
  soporte: 'Soporte técnico',
  capacitacion: 'Capacitación',
  innovacion: 'Innovación educativa',
  plataforma: 'Plataforma M365',
  otros: 'Otros',
}

const useStyles = makeStyles({
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '14px', marginBottom: '20px' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '20px' },
  card: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  logEntry: { padding: '8px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  report: {
    background: '#fff',
    border: '1px solid var(--borde)',
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '860px',
  },
})

export function GestionTicPage({ title = 'Gestión del Coordinador TIC' }: { title?: string } = {}) {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const col = useCollection<TicActivity>(dataService.getTicActivities, dataService.saveTicActivity, dataService.deleteTicActivity)
  const catCol = useCollection<TicCategoryItem>(dataService.getTicCategories, dataService.saveTicCategory, dataService.deleteTicCategory)

  // Siembra las categorías por defecto la primera vez.
  useEffect(() => {
    if (!catCol.loading && catCol.items.length === 0 && !catCol.saving) {
      for (const name of DEFAULT_CATEGORIES) void catCol.save({ id: genId('cat'), name })
    }
  }, [catCol.loading, catCol.items.length, catCol.saving])

  const catName = (cat: string) => catCol.items.find((c) => c.id === cat)?.name ?? LEGACY_CATEGORY_LABELS[cat] ?? cat

  const [tab, setTab] = useState('plan')
  const [scopeFilter, setScopeFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<TicActivity | null>(null)
  const [detail, setDetail] = useState<TicActivity | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [reportMonth, setReportMonth] = useState(todayIso().slice(0, 7))
  const [aiOpen, setAiOpen] = useState(false)
  const [aiSource, setAiSource] = useState('')
  const [aiScope, setAiScope] = useState<TicScope>('mensual')
  const [aiCategory, setAiCategory] = useState('')
  const [aiStage, setAiStage] = useState<TicStage>('inicio')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [newCat, setNewCat] = useState('')
  const aiFileRef = useRef<HTMLInputElement>(null)
  const horCol = useCollection<WeeklySchedule>(dataService.getWeeklySchedules, dataService.saveWeeklySchedule, dataService.deleteWeeklySchedule)
  const [horarioOpen, setHorarioOpen] = useState(false)
  const [horarioTitle, setHorarioTitle] = useState('Horario de trabajo semanal')
  const [horarioGenerating, setHorarioGenerating] = useState(false)
  const horarioFileRef = useRef<HTMLInputElement>(null)
  const [editHorario, setEditHorario] = useState<WeeklySchedule | null>(null)
  const [annualDoc, setAnnualDoc] = useState<AnnualPlanDocument | null>(null)
  const [annualGenerating, setAnnualGenerating] = useState(false)

  /** Extrae el texto del PDF de horario y lo convierte a estructura semanal. */
  const onHorarioPdf = async (file: File | undefined) => {
    if (!file) return
    setHorarioGenerating(true)
    try {
      const text = await extractPdfText(file)
      const schedule = await parseWeeklySchedulePdf(text, horarioTitle)
      await horCol.save(schedule)
      setHorarioOpen(false)
      toaster.dispatchToast('Horario semanal creado desde el PDF.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo crear el horario: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setHorarioGenerating(false)
      if (horarioFileRef.current) horarioFileRef.current.value = ''
    }
  }

  const setCell = (row: number, day: number, value: string) => setEditHorario((h) => h ? { ...h, rows: h.rows.map((r, i) => (i === row ? { ...r, cells: r.cells.map((c, di) => (di === day ? value : c)) } : r)) } : h)
  const setRow = (row: number, patch: Partial<WeeklySchedule['rows'][number]>) => setEditHorario((h) => h ? { ...h, rows: h.rows.map((r, i) => (i === row ? { ...r, ...patch } : r)) } : h)
  const setRows = (rows: WeeklySchedule['rows']) => setEditHorario((h) => h ? { ...h, rows } : h)
  const guardarHorario = async () => {
    if (!editHorario) return
    await horCol.save(editHorario)
    toaster.dispatchToast('Horario actualizado.', { intent: 'success' })
    setEditHorario(null)
  }

  /** Genera con IA la "Planificación Anual" a partir de todas las planificaciones anuales. */
  const generarPlanificacionAnual = async () => {
    if (annualItems.length === 0) {
      toaster.dispatchToast('No hay planificaciones anuales para analizar.', { intent: 'warning' })
      return
    }
    setAnnualGenerating(true)
    try {
      const doc = await generateAnnualPlanDocumentWithAi({
        institution: appConfig.institution,
        responsable: user?.displayName,
        plans: annualItems.map((a) => ({ title: a.title, description: a.description, category: catName(a.category), monthlyTopics: a.monthlyTopics })),
      })
      setAnnualDoc(doc)
      toaster.dispatchToast('Planificación Anual generada. Revísela y guárdela en PDF.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo generar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setAnnualGenerating(false)
    }
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

  /** Abre una ventana con el documento y lanza "Guardar PDF" con el nombre "Planificación Anual". */
  const imprimirPlanificacionAnual = (doc: AnnualPlanDocument) => {
    const meses = doc.meses.length
      ? doc.meses
      : ANNUAL_MONTHS.map((m) => ({ mes: m, tema: '', actividades: '' }))
    const filas = meses
      .map(
        (m) =>
          `<tr><td class="mes">${escapeHtml(m.mes)}</td><td>${escapeHtml(m.tema || '—')}${
            m.actividades ? `<div class="act">${escapeHtml(m.actividades)}</div>` : ''
          }</td></tr>`,
      )
      .join('')
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Planificación Anual</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#111;margin:18mm;font-size:11pt;line-height:1.4}
        h1{font-size:20pt;margin:0 0 2px}
        .sub{color:#555;font-size:9pt;margin-bottom:14px}
        h2{font-size:12.5pt;margin:14px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
        p{margin:0 0 8px;white-space:pre-wrap}
        table{width:100%;border-collapse:collapse;margin-top:4px}
        th,td{border:1px solid #999;padding:5px 8px;vertical-align:top;text-align:left;font-size:10pt}
        th{background:#eef2f5}
        td.mes{width:24%;font-weight:600}
        .act{color:#333;font-size:9pt;margin-top:2px}
        .signs{display:flex;gap:18px;margin-top:34px}
        .sign{flex:1;text-align:center;font-size:8.5pt}
        .line{border-bottom:1px solid #000;height:30px;margin-bottom:3px}
        @page{size:A4 portrait;margin:12mm}
      </style></head><body>
        <h1>${escapeHtml(doc.titulo || 'Planificación Anual')}</h1>
        <div class="sub">${escapeHtml(appConfig.institution)}${doc.generadoPor ? ` · ${escapeHtml(doc.generadoPor)}` : ''} · ${escapeHtml(new Date().toLocaleDateString('es-DO'))}</div>
        ${doc.presentacion ? `<h2>Presentación</h2><p>${escapeHtml(doc.presentacion)}</p>` : ''}
        ${doc.objetivoGeneral ? `<h2>Objetivo general</h2><p>${escapeHtml(doc.objetivoGeneral)}</p>` : ''}
        <h2>Planificación por mes</h2>
        <table><thead><tr><th>Mes</th><th>Tema / actividades</th></tr></thead><tbody>${filas}</tbody></table>
        ${doc.evaluacion ? `<h2>Evaluación</h2><p>${escapeHtml(doc.evaluacion)}</p>` : ''}
        ${doc.conclusion ? `<h2>Conclusión</h2><p>${escapeHtml(doc.conclusion)}</p>` : ''}
        <div class="signs">
          <div class="sign"><div class="line"></div>${escapeHtml(user?.displayName ?? '')}<div>Coordinador/a TIC</div></div>
          <div class="sign"><div class="line"></div>&nbsp;<div>Dirección del centro</div></div>
        </div>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      toaster.dispatchToast('Permita las ventanas emergentes para generar el PDF.', { intent: 'warning' })
      return
    }
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  // Preselecciona la primera categoría cuando se cargan.
  useEffect(() => {
    if (catCol.items.length && !aiCategory) setAiCategory(catCol.items[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catCol.items.length])

  const filtered = useMemo(
    () =>
      col.items
        .filter((a) => (!scopeFilter || a.scope === scopeFilter) && (!stageFilter || a.stage === stageFilter) && (!statusFilter || a.status === statusFilter))
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [col.items, scopeFilter, stageFilter, statusFilter],
  )

  const annualItems = useMemo(() => col.items.filter((a) => a.scope === 'anual'), [col.items])

  const stats = useMemo(() => {
    const total = col.items.length
    const completadas = col.items.filter((a) => a.status === 'completada').length
    const enProgreso = col.items.filter((a) => a.status === 'en_progreso').length
    const evidencias = col.items.reduce((n, a) => n + a.evidences.length, 0)
    const avance = total ? Math.round(col.items.reduce((n, a) => n + (a.progress || 0), 0) / total) : 0
    return { total, completadas, enProgreso, evidencias, avance, cumplimiento: pct(completadas, total) }
  }, [col.items])

  const chartByStage = useMemo(
    () =>
      (Object.keys(STAGE_LABELS) as TicStage[]).map((s) => ({
        name: STAGE_LABELS[s],
        actividades: col.items.filter((a) => a.stage === s && a.status !== 'cancelada').length,
        fill: STAGE_COLORS[s],
      })),
    [col.items],
  )

  const chartByCategory = useMemo(
    () =>
      catCol.items
        .map((c) => ({ name: c.name, value: col.items.filter((a) => a.category === c.id).length }))
        .filter((d) => d.value > 0),
    [catCol.items, col.items],
  )
  const PIE_COLORS = ['#0095C8', '#E30613', '#15803D', '#9A9C2E', '#7D1D24', '#6B21A8']

  const newActivity = (): TicActivity => ({
    id: genId('tic'),
    title: '',
    description: '',
    scope: (scopeFilter as TicScope) || 'mensual',
    category: 'plataforma',
    startDate: todayIso(),
    endDate: todayIso(),
    stage: 'inicio',
    status: 'pendiente',
    progress: 0,
    responsible: user?.displayName,
    evidences: [],
    log: [],
    createdAt: new Date().toISOString(),
  })

  const save = async (a: TicActivity) => {
    if (!a.title.trim()) {
      toaster.dispatchToast('Indique el título de la actividad.', { intent: 'error' })
      return
    }
    try {
      await col.save({ ...a, updatedAt: new Date().toISOString() })
      toaster.dispatchToast('Actividad guardada', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  /** Extrae el texto de un PDF y lo añade al campo de la IA. */
  const onAiPdf = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await extractPdfText(file)
      setAiSource((s) => (s ? `${s}\n\n${text}` : text))
    } catch (error) {
      toaster.dispatchToast(`No se pudo leer el PDF: ${error instanceof Error ? error.message : ''}`, { intent: 'error' })
    }
    if (aiFileRef.current) aiFileRef.current.value = ''
  }

  /** Genera un plan de trabajo TIC con IA y lo abre en el formulario de edición. */
  const generar = async () => {
    if (!aiSource.trim()) {
      toaster.dispatchToast('Escriba un texto o cargue un documento para generar el plan.', { intent: 'error' })
      return
    }
    setAiGenerating(true)
    try {
      const plan = await generateTicPlanWithAi({ source: aiSource, scope: aiScope, category: aiCategory, stage: aiStage, responsible: user?.displayName ?? '' })
      setEditing(plan)
      setAiOpen(false)
      setAiSource('')
      toaster.dispatchToast('Plan generado con IA. Revíselo y guárdelo.', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo generar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setAiGenerating(false)
    }
  }

  /** Crea una categoría TIC nueva. */
  const crearCategoria = async () => {
    const name = newCat.trim()
    if (!name) return
    const item: TicCategoryItem = { id: genId('cat'), name }
    await catCol.save(item)
    setNewCat('')
    setAiCategory(item.id)
    toaster.dispatchToast(`Categoría «${name}» creada.`, { intent: 'success' })
  }

  const renombrarCategoria = async (id: string, name: string) => {
    if (!name) return
    await catCol.save({ id, name })
    toaster.dispatchToast('Categoría actualizada.', { intent: 'success' })
  }

  const eliminarCategoria = async (id: string) => {
    if (!id) return
    const item = catCol.items.find((c) => c.id === id)
    if (!window.confirm(`¿Eliminar la categoría «${item?.name ?? id}»?`)) return
    await catCol.remove(id)
    if (aiCategory === id) setAiCategory(catCol.items.find((c) => c.id !== id)?.id ?? '')
  }

  const addLog = async () => {
    if (!detail || !note.trim()) return
    const next: TicActivity = {
      ...detail,
      log: [...detail.log, { id: genId('log'), date: new Date().toISOString(), note: note.trim(), author: user?.displayName }],
      updatedAt: new Date().toISOString(),
    }
    await col.save(next)
    setDetail(next)
    setNote('')
    toaster.dispatchToast('Registro añadido a la bitácora', { intent: 'success' })
  }

  const addEvidence = async (files: FileList | null) => {
    if (!detail || !files || files.length === 0) return
    setUploading(true)
    try {
      let next = detail
      for (const file of Array.from(files)) {
        const ref = await uploadAndShare(`GestionTIC/${detail.startDate.slice(0, 4)}/${detail.title.slice(0, 40)}`, file)
        next = {
          ...next,
          evidences: [
            ...next.evidences,
            { id: ref.id, name: ref.name, webUrl: ref.webUrl, type: file.type.startsWith('image/') ? 'foto' : 'documento', uploadedAt: new Date().toISOString() },
          ],
        }
      }
      await col.save({ ...next, updatedAt: new Date().toISOString() })
      setDetail(next)
      toaster.dispatchToast('Evidencia(s) subida(s) a OneDrive', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo subir la evidencia: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const addToOutlook = async (a: TicActivity) => {
    try {
      await graphRequest('/me/events', 'POST', {
        subject: `[TIC] ${a.title}`,
        body: { contentType: 'HTML', content: `<p>${a.description || 'Actividad del plan de trabajo TIC.'}</p>` },
        start: { dateTime: `${a.startDate}T08:00:00`, timeZone: appConfig.timeZone },
        end: { dateTime: `${a.endDate}T17:00:00`, timeZone: appConfig.timeZone },
        categories: ['Gestión TIC'],
      })
      toaster.dispatchToast('Actividad agregada a su calendario de Outlook', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo crear el evento: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  const reportItems = useMemo(
    () => col.items.filter((a) => a.startDate.slice(0, 7) <= reportMonth && a.endDate.slice(0, 7) >= reportMonth).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [col.items, reportMonth],
  )

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Planificación anual, mensual y semanal; seguimiento por etapas (Inicio, Desarrollo, Finalización), evidencias en OneDrive, bitácora e informes automáticos."
        actions={
          <>
            <Button appearance="secondary" icon={<SparkleRegular />} onClick={() => setAiOpen(true)} disabled={!isAiConfigured()}>
              Generar con IA
            </Button>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing(newActivity())}>
              Nueva actividad
            </Button>
          </>
        }
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '16px' }}>
        <Tab value="plan">Plan de trabajo ({col.items.length})</Tab>
        <Tab value="horario">Horario semanal ({horCol.items.length})</Tab>
        <Tab value="cronograma">Cronograma de trabajo</Tab>
        <Tab value="dashboard">Dashboard</Tab>
        <Tab value="informe">Informes</Tab>
      </TabList>

      {tab === 'plan' && (
        <>
          <div className={styles.filters}>
            <Select value={scopeFilter} onChange={(_, d) => setScopeFilter(d.value)} style={{ minWidth: '150px' }}>
              <option value="">Toda planificación</option>
              {(Object.keys(SCOPE_LABELS) as TicScope[]).map((sc) => <option key={sc} value={sc}>{SCOPE_LABELS[sc]}</option>)}
            </Select>
            <Select value={stageFilter} onChange={(_, d) => setStageFilter(d.value)} style={{ minWidth: '150px' }}>
              <option value="">Todas las etapas</option>
              {(Object.keys(STAGE_LABELS) as TicStage[]).map((st) => <option key={st} value={st}>{STAGE_LABELS[st]}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(_, d) => setStatusFilter(d.value)} style={{ minWidth: '150px' }}>
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as TicStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
            </Select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <Button
              appearance="secondary"
              icon={annualGenerating ? <Spinner size="tiny" /> : <SparkleRegular />}
              onClick={() => void generarPlanificacionAnual()}
              disabled={annualGenerating || !isAiConfigured() || annualItems.length === 0}
            >
              {annualGenerating ? 'Generando…' : 'Generar Planificación Anual (PDF)'}
            </Button>
          </div>

          <Table aria-label="Plan de trabajo TIC">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell>Período</TableHeaderCell>
                <TableHeaderCell>Etapa</TableHeaderCell>
                <TableHeaderCell>Avance</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Acciones</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Text weight="semibold" block>{a.title}</Text>
                    <Text size={200} style={{ color: 'var(--texto-suave)' }}>{catName(a.category)} · {a.evidences.length} evidencia(s)</Text>
                  </TableCell>
                  <TableCell>{periodLabel(a)}</TableCell>
                  <TableCell>
                    <Badge appearance="filled" style={{ background: STAGE_COLORS[a.stage], color: '#fff' }}>{STAGE_LABELS[a.stage]}</Badge>
                  </TableCell>
                  <TableCell style={{ minWidth: '120px' }}>
                    <ProgressBar value={(a.progress || 0) / 100} thickness="large" />
                    <Text size={200}>{a.progress || 0}%</Text>
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <Toolbar size="small">
                      <ToolbarButton icon={<OpenRegular />} onClick={() => setDetail(a)}>Seguimiento</ToolbarButton>
                      <ToolbarButton icon={<EditRegular />} onClick={() => setEditing({ ...a })}>Editar</ToolbarButton>
                      <ToolbarButton icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar la actividad?')) void col.remove(a.id) }} />
                    </Toolbar>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!col.loading && filtered.length === 0 && (
            <EmptyStateView
              title="Sin actividades en el plan"
              message="Registre las actividades del plan de trabajo TIC: planificación anual, mensual y semanal con sus etapas y evidencias."
              icon={<NoteAddRegular />}
              action={<Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing(newActivity())}>Nueva actividad</Button>}
            />
          )}
        </>
      )}

      {tab === 'horario' && (
        <>
          <Button appearance="primary" icon={<DocumentPdfRegular />} onClick={() => { setHorarioOpen(true); setHorarioTitle('Horario de trabajo semanal') }}>
            Crear horario desde PDF
          </Button>
          <Text size={200} block style={{ color: 'var(--texto-suave)', margin: '6px 0 14px' }}>
            Cargue un PDF con el horario semanal (columnas HOR / LUNES…VIERNES) y la IA lo convierte en una tabla.
          </Text>
          {horCol.items.length === 0 && !horCol.loading && (
            <EmptyStateView title="Sin horarios" message="Cree su horario de trabajo semanal cargando un PDF." icon={<DocumentPdfRegular />} />
          )}
          {horCol.items.map((h) => (
            <div key={h.id} style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <Text weight="semibold" size={400} style={{ color: 'var(--azul-oscuro)' }}>{h.title}</Text>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => setEditHorario({ ...h, rows: h.rows.map((r) => ({ ...r, cells: [...r.cells] })) })}>Editar</Button>
                  <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar este horario?')) void horCol.remove(h.id) }}>Eliminar</Button>
                </div>
              </div>
              <Table aria-label={h.title}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>HOR</TableHeaderCell>
                    {WEEK_DAYS.map((d) => (<TableHeaderCell key={d}>{d}</TableHeaderCell>))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {h.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Text size={300} weight="semibold">{r.time}</Text></TableCell>
                      {WEEK_DAYS.map((_, di) => (<TableCell key={di}><Text size={300}>{r.cells[di] ?? ''}</Text></TableCell>))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </>
      )}

      {tab === 'cronograma' && <CronogramaTrabajoPage embedded />}

      {tab === 'dashboard' && (
        <>
          <div className={styles.kpis}>
            <StatCard title="Actividades" value={stats.total} icon={<NoteAddRegular />} color="#0095C8" gradient={gradientes.azul} sub={`${stats.enProgreso} en progreso`} />
            <StatCard title="Cumplimiento" value={`${stats.cumplimiento}%`} icon={<PrintRegular />} color="#15803D" gradient={gradientes.verde} sub={`${stats.completadas} completadas`} />
            <StatCard title="Avance promedio" value={`${stats.avance}%`} icon={<EditRegular />} color="#EA580C" gradient={gradientes.naranja} sub="Sobre todas las actividades" />
            <StatCard title="Evidencias" value={stats.evidencias} icon={<ImageRegular />} color="#7D1D24" gradient={gradientes.rojo} sub="Fotos y documentos en OneDrive" />
          </div>
          <div className={styles.charts}>
            <Card className={styles.card}>
              <Text weight="semibold" size={400}>Actividades por etapa</Text>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartByStage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <RTooltip />
                  <Bar dataKey="actividades" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className={styles.card}>
              <Text weight="semibold" size={400}>Distribución por categoría</Text>
              {chartByCategory.length === 0 ? (
                <Text size={300} style={{ color: 'var(--texto-suave)' }}>Sin datos todavía.</Text>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={chartByCategory} dataKey="value" nameKey="name" outerRadius={80} label>
                      {chartByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}

      {tab === 'informe' && (
        <div>
          <div className={styles.filters}>
            <FormField label="Mes del informe">
              <Input type="month" value={reportMonth} onChange={(_, d) => setReportMonth(d.value)} />
            </FormField>
            <Button appearance="primary" icon={<PrintRegular />} onClick={() => window.print()} style={{ alignSelf: 'flex-end' }}>
              Imprimir / Guardar PDF
            </Button>
          </div>
          <div className={styles.report} id="informe-tic">
            <Text size={500} weight="bold" block>Informe de Gestión TIC · {reportMonth}</Text>
            <Text size={300} block style={{ color: 'var(--texto-suave)', marginBottom: '14px' }}>
              {appConfig.institution} · Coordinación de Tecnología e Innovación Educativa · Generado el {formatDate(todayIso())} por {user?.displayName}
            </Text>
            <Text size={300} block style={{ marginBottom: '12px' }}>
              Actividades del período: <strong>{reportItems.length}</strong> · Completadas: <strong>{reportItems.filter((a) => a.status === 'completada').length}</strong> · En progreso: <strong>{reportItems.filter((a) => a.status === 'en_progreso').length}</strong> · Evidencias: <strong>{reportItems.reduce((n, a) => n + a.evidences.length, 0)}</strong>
            </Text>
            {reportItems.length === 0 && <Text size={300}>No hay actividades que abarquen este mes.</Text>}
            {reportItems.map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid var(--borde)', padding: '10px 0' }}>
                <Text weight="semibold" block>{a.title} — {STAGE_LABELS[a.stage]} ({a.progress || 0}%)</Text>
                <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
                  {SCOPE_LABELS[a.scope]} · {catName(a.category)} · {formatDate(a.startDate)} — {formatDate(a.endDate)} · {STATUS_LABELS[a.status]}
                </Text>
                {a.description && <Text size={300} block>{a.description}</Text>}
                {a.log.length > 0 && (
                  <Text size={200} block style={{ marginTop: '4px' }}>
                    Bitácora: {a.log.map((l) => `${formatDate(l.date)} — ${l.note}`).join(' · ')}
                  </Text>
                )}
                {a.evidences.length > 0 && (
                  <Text size={200} block style={{ marginTop: '4px' }}>
                    Evidencias: {a.evidences.map((e) => e.name).join(', ')}
                  </Text>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------- Formulario de actividad -------- */}
      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={
          editing && col.items.some((x) => x.id === editing.id)
            ? `Editar · ${editing.title}`
            : editing
              ? `Planificación ${SCOPE_LABELS[editing.scope].toLowerCase()}`
              : 'Nueva actividad TIC'
        }
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => editing && void save(editing)} disabled={col.saving}>{col.saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        {editing && (
          <div>
            <FormField label="Título" required>
              <Input value={editing.title} onChange={(_, d) => setEditing({ ...editing, title: d.value })} placeholder="Ej. Capacitación docente en Teams" />
            </FormField>
            <FormField label="Descripción / objetivo">
              <Textarea value={editing.description} onChange={(_, d) => setEditing({ ...editing, description: d.value })} resize="vertical" />
            </FormField>
            <FieldRow>
              <FormField label="Planificación">
                <Select value={editing.scope} onChange={(_, d) => setEditing({ ...editing, scope: d.value as TicScope })}>
                  {(Object.keys(SCOPE_LABELS) as TicScope[]).map((sc) => <option key={sc} value={sc}>{SCOPE_LABELS[sc]}</option>)}
                </Select>
              </FormField>
              <FormField label="Categoría">
                <Select value={editing.category} onChange={(_, d) => setEditing({ ...editing, category: d.value })}>
                  {catCol.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            {editing.scope === 'anual' ? (
              <div style={{ marginBottom: '14px' }}>
                <Text size={300} weight="semibold" block style={{ marginBottom: '8px' }}>Temas de la planificación por mes (agosto – junio)</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0 16px' }}>
                  {ANNUAL_MONTHS.map((m) => (
                    <FormField key={m} label={m}>
                      <Input
                        value={editing.monthlyTopics?.[m] ?? ''}
                        onChange={(_, d) => setEditing({ ...editing, monthlyTopics: { ...(editing.monthlyTopics ?? {}), [m]: d.value } })}
                        placeholder="Tema de la planificación"
                      />
                    </FormField>
                  ))}
                </div>
              </div>
            ) : (
              <FieldRow>
                <FormField label="Inicio">
                  <Input type="date" value={editing.startDate} onChange={(_, d) => setEditing({ ...editing, startDate: d.value })} />
                </FormField>
                <FormField label="Fin">
                  <Input type="date" value={editing.endDate} onChange={(_, d) => setEditing({ ...editing, endDate: d.value })} />
                </FormField>
              </FieldRow>
            )}
            <FieldRow>
              <FormField label="Etapa">
                <Select value={editing.stage} onChange={(_, d) => setEditing({ ...editing, stage: d.value as TicStage })}>
                  {(Object.keys(STAGE_LABELS) as TicStage[]).map((st) => <option key={st} value={st}>{STAGE_LABELS[st]}</option>)}
                </Select>
              </FormField>
              <FormField label="Estado">
                <Select value={editing.status} onChange={(_, d) => setEditing({ ...editing, status: d.value as TicStatus })}>
                  {(Object.keys(STATUS_LABELS) as TicStatus[]).map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Avance (%)">
                <Input type="number" min={0} max={100} value={String(editing.progress ?? 0)} onChange={(_, d) => setEditing({ ...editing, progress: Math.max(0, Math.min(100, Number(d.value))) })} />
              </FormField>
              <FormField label="Responsable">
                <Input value={editing.responsible ?? ''} onChange={(_, d) => setEditing({ ...editing, responsible: d.value })} />
              </FormField>
            </FieldRow>
          </div>
        )}
      </ModalForm>

      {/* -------- Seguimiento: bitácora y evidencias -------- */}
      <ModalForm
        open={!!detail}
        onOpenChange={(o) => { if (!o) setDetail(null) }}
        title={`Seguimiento · ${detail?.title ?? ''}`}
        subtitle={detail ? `${STAGE_LABELS[detail.stage]} · ${detail.progress || 0}% · ${STATUS_LABELS[detail.status]}` : undefined}
        actions={<Button appearance="secondary" onClick={() => setDetail(null)}>Cerrar</Button>}
      >
        {detail && (
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Button size="small" appearance="outline" icon={<CalendarAddRegular />} onClick={() => void addToOutlook(detail)}>Agregar a Outlook</Button>
              <input ref={fileInput} type="file" multiple style={{ display: 'none' }} onChange={(e) => void addEvidence(e.target.files)} />
              <Button size="small" appearance="outline" icon={uploading ? <Spinner size="tiny" /> : <AttachRegular />} disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? 'Subiendo…' : 'Subir evidencia (foto/documento)'}
              </Button>
            </div>

            {detail.scope === 'anual' && detail.monthlyTopics && Object.values(detail.monthlyTopics).some((v) => v?.trim()) && (
              <FormField label="Temas de la planificación por mes">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '4px 16px' }}>
                  {ANNUAL_MONTHS.filter((m) => detail.monthlyTopics?.[m]?.trim()).map((m) => (
                    <Text key={m} size={300} block><strong>{m}:</strong> {detail.monthlyTopics?.[m]}</Text>
                  ))}
                </div>
              </FormField>
            )}

            <FormField label="Evidencias">
              {detail.evidences.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin evidencias todavía. Se guardan en OneDrive (carpeta GestionTIC).</Text>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {detail.evidences.map((e) => (
                  <Button key={e.id} size="small" appearance="subtle" icon={e.type === 'foto' ? <ImageRegular /> : <DocumentPdfRegular />} onClick={() => window.open(e.webUrl, '_blank', 'noopener')} style={{ justifyContent: 'flex-start' }}>
                    {e.name} · {formatDate(e.uploadedAt)}
                  </Button>
                ))}
              </div>
            </FormField>

            <FormField label="Bitácora">
              <div>
                {detail.log.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin registros.</Text>}
                {detail.log.slice().reverse().map((l) => (
                  <div key={l.id} className={styles.logEntry}>
                    <Text size={300} block>{l.note}</Text>
                    <Text size={200} style={{ color: 'var(--texto-suave)' }}>{formatDate(l.date)}{l.author ? ` · ${l.author}` : ''}</Text>
                  </div>
                ))}
              </div>
            </FormField>
            <FieldRow>
              <FormField label="Nuevo registro">
                <Input value={note} onChange={(_, d) => setNote(d.value)} placeholder="Ej. Se configuraron 12 equipos del laboratorio…" />
              </FormField>
            </FieldRow>
            <Button appearance="primary" size="small" icon={<NoteAddRegular />} onClick={() => void addLog()} disabled={!note.trim()}>Añadir a la bitácora</Button>
          </div>
        )}
      </ModalForm>

      <input ref={aiFileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void onAiPdf(e.target.files?.[0])} />
      <ModalForm open={aiOpen} onOpenChange={setAiOpen} title="Generar plan de trabajo con IA" subtitle="A partir de un texto, documento (PDF) o describiendo una imagen/audio/video." width={720}>
        <div>
          <FormField label="Texto / descripción" hint="Escriba o pegue el contenido. Para imagen, audio o video, descríbalo aquí; para un documento, use el botón de PDF.">
            <Textarea value={aiSource} onChange={(_, d) => setAiSource(d.value)} resize="vertical" rows={8} placeholder="Describa la iniciativa, el problema, el objetivo o pegue un documento…" />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
            <Button appearance="secondary" icon={<CloudArrowUpRegular />} onClick={() => aiFileRef.current?.click()}>Cargar documento (PDF)</Button>
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>Se extrae el texto y se añade al campo.</Text>
          </div>
          <FieldRow>
            <FormField label="Ámbito">
              <Select value={aiScope} onChange={(_, d) => setAiScope(d.value as TicScope)}>
                {Object.entries(SCOPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </Select>
            </FormField>
            <FormField label="Categoría">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Select value={aiCategory} onChange={(_, d) => setAiCategory(d.value)} style={{ flex: 1, minWidth: '150px' }}>
                  {catCol.items.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </Select>
                <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => { const c = catCol.items.find((x) => x.id === aiCategory); const n = window.prompt('Nuevo nombre de la categoría:', c?.name); if (n && n.trim()) void renombrarCategoria(aiCategory, n.trim()) }} disabled={!aiCategory}>Editar</Button>
                <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => void eliminarCategoria(aiCategory)} disabled={!aiCategory}>Eliminar</Button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                <Input value={newCat} onChange={(_, d) => setNewCat(d.value)} placeholder="Nueva categoría…" style={{ flex: 1, minWidth: '150px' }} />
                <Button size="small" appearance="secondary" icon={<AddRegular />} onClick={() => void crearCategoria()} disabled={!newCat.trim()}>Crear</Button>
              </div>
            </FormField>
            <FormField label="Etapa">
              <Select value={aiStage} onChange={(_, d) => setAiStage(d.value as TicStage)}>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </Select>
            </FormField>
          </FieldRow>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button appearance="secondary" onClick={() => setAiOpen(false)}>Cancelar</Button>
            <Button appearance="primary" icon={aiGenerating ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generar()} disabled={aiGenerating || !aiSource.trim()}>
              {aiGenerating ? 'Generando…' : 'Generar plan'}
            </Button>
          </div>
        </div>
      </ModalForm>

      <input ref={horarioFileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void onHorarioPdf(e.target.files?.[0])} />
      <ModalForm open={horarioOpen} onOpenChange={setHorarioOpen} title="Crear horario semanal desde PDF" subtitle="El PDF debe contener una tabla con columnas HOR / LUNES / MARTES / MIÉRCOLES / JUEVES / VIERNES." width={620}>
        <div>
          <FormField label="Título del horario">
            <Input value={horarioTitle} onChange={(_, d) => setHorarioTitle(d.value)} placeholder="Ej. Horario mes de Enero" />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
            <Button appearance="secondary" icon={<DocumentPdfRegular />} onClick={() => horarioFileRef.current?.click()} disabled={horarioGenerating}>
              {horarioGenerating ? <Spinner size="tiny" /> : 'Seleccionar PDF'}
            </Button>
            <Text size={200} style={{ color: 'var(--texto-suave)' }}>Se extrae el texto y la IA reconstruye el horario.</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button appearance="secondary" onClick={() => setHorarioOpen(false)} disabled={horarioGenerating}>Cancelar</Button>
            <Button appearance="primary" icon={<DocumentPdfRegular />} onClick={() => horarioFileRef.current?.click()} disabled={horarioGenerating}>
              {horarioGenerating ? 'Procesando…' : 'Cargar y crear'}
            </Button>
          </div>
        </div>
      </ModalForm>

      <ModalForm open={!!editHorario} onOpenChange={(o) => !o && setEditHorario(null)} title="Editar horario" subtitle={editHorario?.title ?? ''} width={860}>
        {editHorario && (
          <div>
            <FormField label="Título">
              <Input value={editHorario.title} onChange={(_, d) => setEditHorario({ ...editHorario, title: d.value })} />
            </FormField>
            <div style={{ overflowX: 'auto' }}>
              <Table aria-label="Editar horario" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>HOR</TableHeaderCell>
                    {WEEK_DAYS.map((d) => (<TableHeaderCell key={d}>{d}</TableHeaderCell>))}
                    <TableHeaderCell> </TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editHorario.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={r.time} onChange={(_, d) => setRow(i, { time: d.value })} style={{ minWidth: '90px' }} /></TableCell>
                      {WEEK_DAYS.map((_, di) => (
                        <TableCell key={di}><Input value={r.cells[di] ?? ''} onChange={(_, d) => setCell(i, di, d.value)} style={{ minWidth: '110px' }} /></TableCell>
                      ))}
                      <TableCell><Button appearance="subtle" icon={<DeleteRegular />} aria-label="Quitar fila" onClick={() => setRows(editHorario.rows.filter((_, x) => x !== i))} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <Button appearance="subtle" icon={<AddRegular />} onClick={() => setRows([...editHorario.rows, { time: '', cells: ['', '', '', '', ''] }])}>Añadir fila</Button>
              <Button appearance="primary" icon={<NoteAddRegular />} onClick={() => void guardarHorario()} disabled={horCol.saving}>{horCol.saving ? 'Guardando…' : 'Guardar horario'}</Button>
            </div>
          </div>
        )}
      </ModalForm>

      {/* -------- Planificación Anual generada con IA -------- */}
      <ModalForm
        open={!!annualDoc}
        onOpenChange={(o) => { if (!o) setAnnualDoc(null) }}
        title={annualDoc?.titulo || 'Planificación Anual'}
        subtitle={`Generado con IA a partir de ${annualItems.length} planificación(es) anual(es)`}
        width={860}
        actions={
          <>
            <Button appearance="secondary" icon={annualGenerating ? <Spinner size="tiny" /> : <SparkleRegular />} onClick={() => void generarPlanificacionAnual()} disabled={annualGenerating}>
              Regenerar
            </Button>
            <Button appearance="secondary" icon={<DocumentPdfRegular />} onClick={() => annualDoc && imprimirPlanificacionAnual(annualDoc)}>Guardar PDF</Button>
            <Button appearance="primary" onClick={() => setAnnualDoc(null)}>Cerrar</Button>
          </>
        }
      >
        {annualDoc && (
          <div>
            <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '10px' }}>
              {appConfig.institution}{annualDoc.generadoPor ? ` · ${annualDoc.generadoPor}` : ''} · {formatDate(todayIso())}
            </Text>
            {annualDoc.presentacion && (
              <FormField label="Presentación"><Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{annualDoc.presentacion}</Text></FormField>
            )}
            {annualDoc.objetivoGeneral && (
              <FormField label="Objetivo general"><Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{annualDoc.objetivoGeneral}</Text></FormField>
            )}
            <FormField label="Planificación por mes">
              <Table aria-label="Planificación por mes" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Mes</TableHeaderCell>
                    <TableHeaderCell>Tema / actividades</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(annualDoc.meses.length ? annualDoc.meses : ANNUAL_MONTHS.map((m) => ({ mes: m, tema: '', actividades: '' }))).map((m, i) => (
                    <TableRow key={`${m.mes}-${i}`}>
                      <TableCell><Text weight="semibold">{m.mes}</Text></TableCell>
                      <TableCell>
                        {m.tema && <Text size={300} block>{m.tema}</Text>}
                        {m.actividades && <Text size={200} block style={{ color: 'var(--texto-suave)' }}>{m.actividades}</Text>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </FormField>
            {annualDoc.evaluacion && (
              <FormField label="Evaluación"><Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{annualDoc.evaluacion}</Text></FormField>
            )}
            {annualDoc.conclusion && (
              <FormField label="Conclusión"><Text size={300} block style={{ whiteSpace: 'pre-wrap' }}>{annualDoc.conclusion}</Text></FormField>
            )}
          </div>
        )}
      </ModalForm>
    </div>
  )
}
