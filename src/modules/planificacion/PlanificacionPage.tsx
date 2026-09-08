import { useMemo, useRef, useState } from 'react'
import { Button, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, SparkleRegular, OpenRegular, DeleteRegular, SearchRegular, DocumentRegular, PrintRegular, CalendarLtrRegular, CloudArrowUpRegular, ChatRegular, CopyRegular, VideoRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { extractPdfText } from '../../services/pdf'
import { parsePdfToPlan } from '../../services/planningPrompts'
import { isAiConfigured } from '../../services/ai'
import { PlanDiarioForm } from './PlanDiarioForm'
import { AsistenteIA } from './AsistenteIA'
import { ModifyChatPanel } from './ModifyChatPanel'
import { ProyectarUnidad } from './ProyectarUnidad'
import { exportPlanWord, printPlan } from './exportPlan'
import type { DailyPlan } from '../../types'
import { formatDate, genId, todayIso } from '../../utils/helpers'

const useStyles = makeStyles({
  toolbar: { marginBottom: '16px', gap: '12px', flexWrap: 'wrap' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  aiHint: { width: '100%', padding: '10px 14px', borderRadius: '10px', background: tokens.colorNeutralBackground2, fontSize: '12.5px', lineHeight: 1.5, marginBottom: '12px' },
})

const EDUPLAN_URL = 'https://eduplan.educando.edu.do/'

export function PlanificacionPage() {
  const styles = useStyles()
  const { user, subjects, grades, subjectById, gradeById, role } = useApp()
  const configured = isAiConfigured()

  const plansCol = useCollection<DailyPlan>(dataService.getDailyPlans, dataService.saveDailyPlan, dataService.deleteDailyPlan)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [asistenteOpen, setAsistenteOpen] = useState(false)
  const [editing, setEditing] = useState<DailyPlan | null>(null)
  const [parsing, setParsing] = useState(false)
  const [modifyTarget, setModifyTarget] = useState<DailyPlan | null>(null)
  const [modifyOpen, setModifyOpen] = useState(false)
  const [projecting, setProjecting] = useState<DailyPlan | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isStaff = role === 'admin' || role === 'psicologia' || role === 'tecnologia'

  const myPlans = useMemo(() => {
    const items = plansCol.items
    if (isStaff && !user?.teacherId) return items
    return items.filter((p) => p.teacherId === user?.teacherId)
  }, [plansCol.items, user?.teacherId, isStaff])

  const filtered = useMemo(() => {
    return myPlans
      .filter((p) => !subjectFilter || p.subjectId === subjectFilter)
      .filter((p) => !gradeFilter || p.gradeId === gradeFilter)
      .filter((p) => !tipoFilter || p.tipo === tipoFilter)
      .filter((p) => !search || p.tema.toLowerCase().includes(search.toLowerCase()) || p.unidad.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [myPlans, subjectFilter, gradeFilter, tipoFilter, search])

  const openNew = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (plan: DailyPlan) => { setEditing(plan); setFormOpen(true) }
  const handleAiGenerated = (plan: DailyPlan) => { setEditing(plan); setFormOpen(true) }
  const handleSave = async (plan: DailyPlan) => { await plansCol.save(plan); setFormOpen(false) }
  const handleDelete = async (plan: DailyPlan) => {
    if (!window.confirm('¿Desea eliminar esta planificación?')) return
    try { await plansCol.remove(plan.id) } catch { /* error del hook */ }
  }
  const handleDuplicate = (plan: DailyPlan) => {
    const copy: DailyPlan = { ...plan, id: genId('pdia'), createdAt: new Date().toISOString() }
    setEditing(copy)
    setFormOpen(true)
  }

  /** Carga un PDF de planificación, extrae su texto y crea un plan con IA. */
  const handlePdf = async (file: File | undefined) => {
    if (!file) return
    setParsing(true)
    try {
      const text = await extractPdfText(file)
      const plan = await parsePdfToPlan(text, {
        id: genId('pdia'),
        teacherId: user?.teacherId ?? '',
        subjectId: subjects[0]?.id ?? '',
        gradeId: grades[0]?.id ?? '',
        section: '',
        fecha: todayIso(),
      })
      setEditing(plan)
      setFormOpen(true)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo procesar el PDF.')
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const openModify = (plan: DailyPlan) => { setModifyTarget(plan); setModifyOpen(true) }

  return (
    <div>
      <PageHeader
        title="Planificaciones"
        subtitle="Planificaciones académicas (diarias y de unidad) con la estructura del diseño curricular del MINERD. Descargue sus planificaciones desde Eduplan o cárguelas en PDF para crearlas automáticamente con IA."
        actions={
          <>
            <Button appearance="subtle" icon={<OpenRegular />} onClick={() => window.open(EDUPLAN_URL, '_blank', 'noopener')}>
              Descargar desde Eduplan
            </Button>
            <Button appearance="secondary" icon={parsing ? <Spinner size="tiny" /> : <CloudArrowUpRegular />} onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? 'Leyendo PDF…' : 'Cargar planificación (PDF)'}
            </Button>
            <Button appearance="secondary" icon={<SparkleRegular />} onClick={() => setAsistenteOpen(true)}>
              Generar con IA
            </Button>
            <Button appearance="primary" icon={<AddRegular />} onClick={openNew}>
              Nueva planificación
            </Button>
          </>
        }
      />

      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => void handlePdf(e.target.files?.[0])} />

      {!configured && (
        <div className={styles.aiHint}>
          El asistente de IA no está configurado (defina <code>VITE_AI_API_URL</code>). La carga de PDF y la modificación con IA requieren la conexión del asistente.
        </div>
      )}

      <div className={styles.filterRow}>
        <Select value={subjectFilter} onChange={(_, d) => setSubjectFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todas las asignaturas</option>
          {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '150px' }}>
          <option value="">Todos los grados</option>
          {grades.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
        </Select>
        <Select value={tipoFilter} onChange={(_, d) => setTipoFilter(d.value)} style={{ minWidth: '150px' }}>
          <option value="">Diarias y unidades</option>
          <option value="diaria">Solo diarias</option>
          <option value="unidad">Solo unidades</option>
        </Select>
        <Input value={search} onChange={(_, d) => setSearch(d.value)} contentBefore={<SearchRegular />} placeholder="Buscar por tema o unidad…" style={{ minWidth: '220px', flex: 1 }} />
      </div>

      <Table aria-label="Planificaciones">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Grado</TableHeaderCell>
            <TableHeaderCell>Tema</TableHeaderCell>
            <TableHeaderCell>IA</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className={styles.cell}>
                <StatusBadge status={plan.tipo === 'unidad' ? 'activo' : 'planificada'}>{plan.tipo === 'unidad' ? 'Unidad' : 'Diaria'}</StatusBadge>
              </TableCell>
              <TableCell className={styles.cell}>
                <Text size={300} weight="semibold" block>{formatDate(plan.fecha)}</Text>
                <Text size={200} block style={{ color: tokens.colorNeutralForeground2 }}>{plan.duracion}</Text>
              </TableCell>
              <TableCell className={styles.cell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: subjectById(plan.subjectId)?.color ?? '#999' }} />
                  {subjectById(plan.subjectId)?.name ?? plan.subjectId}
                </span>
              </TableCell>
              <TableCell className={styles.cell}>{gradeById(plan.gradeId)?.name ?? plan.gradeId}{plan.section ? ` ${plan.section}` : ''}</TableCell>
              <TableCell className={styles.cell}>{plan.tema}</TableCell>
              <TableCell className={styles.cell}>{plan.generadoPorIA ? '✨' : '—'}</TableCell>
              <TableCell className={styles.cell}>
                <Toolbar size="small" style={{ gap: '4px' }}>
                  <ToolbarButton icon={<OpenRegular />} onClick={() => openEdit(plan)}>Editar</ToolbarButton>
                  <ToolbarButton icon={<CopyRegular />} onClick={() => handleDuplicate(plan)}>Duplicar</ToolbarButton>
                  <ToolbarButton icon={<VideoRegular />} onClick={() => setProjecting(plan)}>Proyectar</ToolbarButton>
                  <ToolbarButton icon={<ChatRegular />} onClick={() => openModify(plan)} disabled={!configured}>Modificar con IA</ToolbarButton>
                  <ToolbarButton icon={<DocumentRegular />} onClick={() => exportPlanWord(plan, subjectById(plan.subjectId)?.name ?? '', gradeById(plan.gradeId)?.name ?? '')}>Word</ToolbarButton>
                  <ToolbarButton icon={<PrintRegular />} onClick={() => printPlan(plan, subjectById(plan.subjectId)?.name ?? '', gradeById(plan.gradeId)?.name ?? '')}>PDF</ToolbarButton>
                  <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(plan)}>Eliminar</ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!plansCol.loading && filtered.length === 0 && (
        <EmptyStateView
          title="No hay planificaciones"
          message="Cree una planificación manualmente, cárguela desde un PDF del Eduplan o genere una con el asistente de IA."
          icon={<CalendarLtrRegular />}
          action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Crear planificación</Button>}
        />
      )}

      <ModalForm open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Editar planificación' : 'Nueva planificación'} subtitle="Estructura del diseño curricular del MINERD" width={820}>
        <PlanDiarioForm initial={editing} submitting={plansCol.saving} onSave={(plan) => void handleSave(plan)} onCancel={() => setFormOpen(false)} />
      </ModalForm>

      <AsistenteIA open={asistenteOpen} onOpenChange={setAsistenteOpen} onGenerated={handleAiGenerated} />

      <ModifyChatPanel
        open={modifyOpen}
        onOpenChange={setModifyOpen}
        plan={modifyTarget}
        onPlanUpdated={(plan) => { setEditing(plan); setFormOpen(true); setModifyOpen(false) }}
      />

      <ProyectarUnidad open={!!projecting} onClose={() => setProjecting(null)} unidad={projecting} subjectName={subjectById(projecting?.subjectId ?? '')?.name ?? ''} gradeName={gradeById(projecting?.gradeId ?? '')?.name ?? ''} />
    </div>
  )
}
