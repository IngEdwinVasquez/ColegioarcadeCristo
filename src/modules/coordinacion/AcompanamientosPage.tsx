import { useMemo, useState } from 'react'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Textarea, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, OpenRegular, HeartPulseRegular, PrintRegular, DocumentRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow, FormActions } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { NivelSelector } from './NivelSelector'
import { useCoordinationLevel } from './useCoordinationLevel'
import { printAcompanamiento, exportAcompanamientoWord } from './exportAcompanamiento'
import type { Accompaniment, ClassPlan, DailyPlan, SchoolClassRecord } from '../../types'
import { formatDate, genId, todayIso } from '../../utils/helpers'

const PHASES = [
  { value: 'planificacion', label: 'Planificación' },
  { value: 'ejecucion', label: 'Ejecución / Observación' },
  { value: 'evaluacion', label: 'Evaluación' },
] as const

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  small: { color: tokens.colorNeutralForeground2 },
})

interface RefOption { kind: 'plan' | 'class' | 'daily'; id: string; label: string }

export function AcompanamientosPage() {
  const styles = useStyles()
  const { user, teachers, subjectById, teacherById } = useApp()
  const { level, setLevel, levels } = useCoordinationLevel()

  const col = useCollection<Accompaniment>(dataService.getAccompaniments, dataService.saveAccompaniment, dataService.deleteAccompaniment)
  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans)
  const dailyCol = useCollection<DailyPlan>(dataService.getDailyPlans)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses)

  const [teacherFilter, setTeacherFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Accompaniment | null>(null)

  const refsByTeacher = useMemo(() => {
    const map = new Map<string, RefOption[]>()
    const add = (teacherId: string, ref: RefOption) => {
      if (!map.has(teacherId)) map.set(teacherId, [])
      map.get(teacherId)?.push(ref)
    }
    plansCol.items.forEach((p) => add(p.teacherId, { kind: 'plan', id: p.id, label: `Plan: ${subjectById(p.subjectId)?.name ?? ''} · ${p.topic} · ${formatDate(p.date)}` }))
    dailyCol.items.forEach((p) => add(p.teacherId, { kind: 'daily', id: p.id, label: `Plan: ${subjectById(p.subjectId)?.name ?? ''} · ${p.tema} · ${formatDate(p.fecha)}` }))
    classesCol.items.forEach((c) => add(c.teacherId, { kind: 'class', id: c.id, label: `Clase: ${c.title} · ${formatDate(c.date)}` }))
    return map
  }, [plansCol.items, dailyCol.items, classesCol.items, subjectById])

  const filtered = useMemo(() => {
    const arr = col.items.filter((a) => a.level === level)
    return teacherFilter ? arr.filter((a) => a.teacherId === teacherFilter) : arr
  }, [col.items, level, teacherFilter])

  const openNew = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (a: Accompaniment) => { setEditing(a); setFormOpen(true) }
  const handleDelete = async (a: Accompaniment) => {
    if (!window.confirm('¿Desea eliminar este acompañamiento?')) return
    try { await col.remove(a.id) } catch { /* error del hook */ }
  }
  const handleSave = async (a: Accompaniment) => {
    await col.save({ ...a, createdAt: a.createdAt ?? new Date().toISOString() })
    setFormOpen(false)
  }

  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div>
      <PageHeader
        title="Acompañamiento a docentes"
        subtitle="Planifique, ejecute y registre el acompañamiento a cada docente de su nivel, tomando como base la planificación y/o la clase que imparte."
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Nuevo acompañamiento</Button>}
      />
      <div className={styles.controls}>
        <NivelSelector value={level} onChange={setLevel} levels={levels} />
      </div>

      <div className={styles.filterRow}>
        <Select value={teacherFilter} onChange={(_, d) => setTeacherFilter(d.value)} style={{ minWidth: '200px' }}>
          <option value="">Todos los docentes</option>
          {teachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
        </Select>
      </div>

      {sorted.length === 0 && !col.loading && (
        <EmptyStateView title="Sin acompañamientos" message="Registre el acompañamiento a los docentes de su nivel." icon={<HeartPulseRegular />} action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Nuevo acompañamiento</Button>} />
      )}

      {sorted.length > 0 && (
        <Table aria-label="Acompañamientos">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Docente</TableHeaderCell>
              <TableHeaderCell>Fase</TableHeaderCell>
              <TableHeaderCell>Tema</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a) => (
              <TableRow key={a.id}>
                <TableCell className={styles.cell}>{formatDate(a.date)}</TableCell>
                <TableCell className={styles.cell}><Text weight="semibold">{teacherById(a.teacherId)?.fullName ?? '—'}</Text></TableCell>
                <TableCell className={styles.cell}>{PHASES.find((p) => p.value === a.phase)?.label ?? a.phase}</TableCell>
                <TableCell className={styles.cell}>{a.topic}</TableCell>
                <TableCell className={styles.cell}><StatusBadge status={a.status} /></TableCell>
                <TableCell className={styles.cell}>
                  <Toolbar size="small" style={{ gap: '4px' }}>
                    <ToolbarButton icon={<OpenRegular />} onClick={() => openEdit(a)}>Editar</ToolbarButton>
                    <ToolbarButton icon={<DocumentRegular />} onClick={() => exportAcompanamientoWord(a, teacherById(a.teacherId)?.fullName ?? '')}>Word</ToolbarButton>
                    <ToolbarButton icon={<PrintRegular />} onClick={() => printAcompanamiento(a, teacherById(a.teacherId)?.fullName ?? '')}>PDF</ToolbarButton>
                    <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(a)}>Eliminar</ToolbarButton>
                  </Toolbar>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ModalForm open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Editar acompañamiento' : 'Nuevo acompañamiento'} subtitle={`Acompañamiento docente · ${level}`} width={760}>
        <AcompanamientoForm
          initial={editing}
          coordinatorId={user?.id ?? ''}
          level={level}
          teacherRefs={refsByTeacher}
          teachers={teachers}
          onSave={(a) => void handleSave(a)}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>
    </div>
  )
}

interface AcompanamientoFormProps {
  initial?: Accompaniment | null
  coordinatorId: string
  level: Accompaniment['level']
  teacherRefs: Map<string, RefOption[]>
  teachers: ReturnType<typeof useApp>['teachers']
  onSave: (a: Accompaniment) => void
  onCancel: () => void
}

function AcompanamientoForm({ initial, coordinatorId, level, teacherRefs, teachers, onSave, onCancel }: AcompanamientoFormProps) {
  const [form, setForm] = useState<Accompaniment>(() =>
    initial ?? {
      id: genId('acc'),
      coordinatorId,
      teacherId: '',
      level,
      date: todayIso(),
      topic: '',
      phase: 'planificacion',
      observations: '',
      strengths: '',
      improvements: '',
      recommendations: '',
      status: 'planificado',
      createdAt: new Date().toISOString(),
    })
  const [ref, setRef] = useState('')

  const set = <K extends keyof Accompaniment>(k: K, v: Accompaniment[K]) => setForm((f) => ({ ...f, [k]: v }))

  const refs = teacherRefs.get(form.teacherId) ?? []

  const submit = () => {
    if (!form.teacherId || !form.topic) {
      window.alert('Seleccione el docente e indique el tema del acompañamiento.')
      return
    }
    const next: Accompaniment = { ...form }
    if (ref) {
      const type = ref.split(':')[0]
      const id = ref.split(':')[1]
      if (type === 'class') { next.relatedClassId = id; next.relatedPlanId = undefined }
      else { next.relatedPlanId = id; next.relatedClassId = undefined }
    }
    onSave(next)
  }

  return (
    <div>
      <FieldRow>
        <FormField label="Docente" required>
          <Select value={form.teacherId} onChange={(_, d) => { set('teacherId', d.value); setRef('') }}>
            <option value="">Seleccione…</option>
            {teachers.map((t) => (<option key={t.id} value={t.id}>{t.fullName}</option>))}
          </Select>
        </FormField>
        <FormField label="Clase / planificación de referencia">
          <Select value={ref} onChange={(_, d) => setRef(d.value)} disabled={refs.length === 0}>
            <option value="">Sin referencia</option>
            {refs.map((r) => (<option key={`${r.kind}-${r.id}`} value={`${r.kind}:${r.id}`}>{r.label}</option>))}
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Fecha" required>
          <Input type="date" value={form.date} onChange={(_, d) => set('date', d.value)} />
        </FormField>
        <FormField label="Fase del acompañamiento">
          <Select value={form.phase} onChange={(_, d) => set('phase', d.value as Accompaniment['phase'])}>
            {PHASES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </Select>
        </FormField>
        <FormField label="Estado">
          <Select value={form.status} onChange={(_, d) => set('status', d.value as Accompaniment['status'])}>
            <option value="planificado">Planificado</option>
            <option value="realizado">Realizado</option>
            <option value="seguimiento">En seguimiento</option>
          </Select>
        </FormField>
      </FieldRow>
      <FormField label="Tema / objetivo del acompañamiento" required>
        <Input value={form.topic} onChange={(_, d) => set('topic', d.value)} placeholder="Ej. Verificación del desarrollo de la clase y uso de la planificación MINERD" />
      </FormField>
      <FormField label="Observaciones de la sesión">
        <Textarea value={form.observations} onChange={(_, d) => set('observations', d.value)} resize="vertical" rows={3} />
      </FormField>
      <FieldRow>
        <FormField label="Fortalezas observadas">
          <Textarea value={form.strengths} onChange={(_, d) => set('strengths', d.value)} resize="vertical" rows={3} />
        </FormField>
        <FormField label="Aspectos a mejorar">
          <Textarea value={form.improvements} onChange={(_, d) => set('improvements', d.value)} resize="vertical" rows={3} />
        </FormField>
      </FieldRow>
      <FormField label="Recomendaciones">
        <Textarea value={form.recommendations} onChange={(_, d) => set('recommendations', d.value)} resize="vertical" rows={3} />
      </FormField>
      <FieldRow>
        <FormField label="Compromiso acordado">
          <Input value={form.agreedFollowUp ?? ''} onChange={(_, d) => set('agreedFollowUp', d.value)} placeholder="Ej. Aplicar estrategia de trabajo cooperativo" />
        </FormField>
        <FormField label="Fecha de seguimiento">
          <Input type="date" value={form.followUpDate ?? ''} onChange={(_, d) => set('followUpDate', d.value)} />
        </FormField>
      </FieldRow>
      <FormActions onCancel={onCancel} onSubmit={submit} submitLabel={initial ? 'Actualizar' : 'Guardar'} />
    </div>
  )
}
