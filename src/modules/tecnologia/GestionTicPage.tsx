import { useMemo, useRef, useState } from 'react'
import {
  Badge, Button, Card, Input, ProgressBar, Select, Spinner, Tab, TabList, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow, Text, Textarea, Toolbar, ToolbarButton, useToastController, makeStyles, tokens,
} from '@fluentui/react-components'
import {
  AddRegular, AttachRegular, CalendarAddRegular, DeleteRegular, DocumentPdfRegular, EditRegular,
  ImageRegular, NoteAddRegular, OpenRegular, PrintRegular,
} from '@fluentui/react-icons'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend } from 'recharts'
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
import { appConfig } from '../../config/appConfig'
import { formatDate, genId, pct, todayIso } from '../../utils/helpers'
import { gradientes } from '../../theme'
import type { TicActivity, TicCategory, TicScope, TicStage, TicStatus } from '../../types'

const SCOPE_LABELS: Record<TicScope, string> = { anual: 'Anual', mensual: 'Mensual', semanal: 'Semanal' }
const STAGE_LABELS: Record<TicStage, string> = { inicio: 'Inicio', desarrollo: 'Desarrollo', finalizacion: 'Finalización' }
const STATUS_LABELS: Record<TicStatus, string> = { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada' }
const CATEGORY_LABELS: Record<TicCategory, string> = {
  infraestructura: 'Infraestructura',
  soporte: 'Soporte técnico',
  capacitacion: 'Capacitación',
  innovacion: 'Innovación educativa',
  plataforma: 'Plataforma M365',
  otros: 'Otros',
}
const STAGE_COLORS: Record<TicStage, string> = { inicio: '#0095C8', desarrollo: '#EA580C', finalizacion: '#15803D' }

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

export function GestionTicPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { user } = useApp()
  const col = useCollection<TicActivity>(dataService.getTicActivities, dataService.saveTicActivity, dataService.deleteTicActivity)

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

  const filtered = useMemo(
    () =>
      col.items
        .filter((a) => (!scopeFilter || a.scope === scopeFilter) && (!stageFilter || a.stage === stageFilter) && (!statusFilter || a.status === statusFilter))
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [col.items, scopeFilter, stageFilter, statusFilter],
  )

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
      (Object.keys(CATEGORY_LABELS) as TicCategory[])
        .map((c) => ({ name: CATEGORY_LABELS[c], value: col.items.filter((a) => a.category === c).length }))
        .filter((d) => d.value > 0),
    [col.items],
  )
  const PIE_COLORS = ['#0095C8', '#E30613', '#15803D', '#9A9C2E', '#7D1D24', '#6B21A8']

  const newActivity = (): TicActivity => ({
    id: genId('tic'),
    title: '',
    description: '',
    scope: 'mensual',
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
        title="Gestión del Coordinador TIC"
        subtitle="Planificación anual, mensual y semanal; seguimiento por etapas (Inicio, Desarrollo, Finalización), evidencias en OneDrive, bitácora e informes automáticos."
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={() => setEditing(newActivity())}>Nueva actividad</Button>}
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))} style={{ marginBottom: '16px' }}>
        <Tab value="plan">Plan de trabajo ({col.items.length})</Tab>
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

          <Table aria-label="Plan de trabajo TIC">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Actividad</TableHeaderCell>
                <TableHeaderCell>Plan</TableHeaderCell>
                <TableHeaderCell>Fechas</TableHeaderCell>
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
                    <Text size={200} style={{ color: 'var(--texto-suave)' }}>{CATEGORY_LABELS[a.category]} · {a.evidences.length} evidencia(s)</Text>
                  </TableCell>
                  <TableCell>{SCOPE_LABELS[a.scope]}</TableCell>
                  <TableCell>{formatDate(a.startDate)} — {formatDate(a.endDate)}</TableCell>
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
                  {SCOPE_LABELS[a.scope]} · {CATEGORY_LABELS[a.category]} · {formatDate(a.startDate)} — {formatDate(a.endDate)} · {STATUS_LABELS[a.status]}
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
        title={editing && col.items.some((x) => x.id === editing.id) ? `Editar · ${editing.title}` : 'Nueva actividad TIC'}
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
                <Select value={editing.category} onChange={(_, d) => setEditing({ ...editing, category: d.value as TicCategory })}>
                  {(Object.keys(CATEGORY_LABELS) as TicCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FieldRow>
              <FormField label="Inicio">
                <Input type="date" value={editing.startDate} onChange={(_, d) => setEditing({ ...editing, startDate: d.value })} />
              </FormField>
              <FormField label="Fin">
                <Input type="date" value={editing.endDate} onChange={(_, d) => setEditing({ ...editing, endDate: d.value })} />
              </FormField>
            </FieldRow>
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
    </div>
  )
}
