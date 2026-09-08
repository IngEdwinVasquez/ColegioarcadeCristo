import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Input, Select, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, OpenRegular, DeleteRegular, PeopleRegular, ArrowLeftRegular, CalendarLtrRegular, CalendarCheckmarkRegular, FolderRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow, FormActions } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { ClassPlan, DailyPlan, SchoolClassRecord } from '../../types'
import { formatDate, genId, todayIso, aulaLabel } from '../../utils/helpers'

const useStyles = makeStyles({
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' },
  cell: { verticalAlign: 'middle' },
  small: { color: tokens.colorNeutralForeground2 },
  roster: { display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '220px', overflowY: 'auto' },
  chip: { padding: '4px 12px', borderRadius: '999px', background: 'rgba(0,130,173,0.10)', color: '#0082AD', fontSize: '12.5px', fontWeight: 600 },
})

export function MisClasesPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const params = useParams()
  const { user, students, subjectById, gradeById, teacherById } = useApp()
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses, dataService.saveClassRecord, dataService.deleteClassRecord)
  const unidadesCol = useCollection<DailyPlan>(dataService.getDailyPlans)
  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans, dataService.saveClassPlan, dataService.deleteClassPlan)

  const subjectId = params.subjectId ?? ''
  const gradeId = params.gradeId ?? ''
  const section = decodeURIComponent(params.section ?? '')
  const navigateToClass = (id: string) => navigate(`/docentes/aulas/${gradeId}/${encodeURIComponent(section)}/${subjectId}/clase/${id}`)

  const teacher = teacherById(user?.teacherId)
  const subjectName = subjectById(subjectId)?.name ?? 'Asignatura'
  const gradeName = gradeById(gradeId)?.name ?? ''
  const aula = aulaLabel(gradeById(gradeId), section)

  const [createOpen, setCreateOpen] = useState(false)
  const [rosterTarget, setRosterTarget] = useState<SchoolClassRecord | null>(null)
  const [newDate, setNewDate] = useState(todayIso())
  const [newPeriod, setNewPeriod] = useState('07:45 - 08:30')
  const [newUnidadId, setNewUnidadId] = useState('')
  const [tab, setTab] = useState<'clases' | 'anual'>('clases')
  const [planOpen, setPlanOpen] = useState(false)
  const [planEditing, setPlanEditing] = useState<ClassPlan | null>(null)

  const classList = useMemo(() => classesCol.items.filter((c) => c.subjectId === subjectId && c.gradeId === gradeId).sort((a, b) => (a.date < b.date ? 1 : -1)), [classesCol.items, subjectId, gradeId])
  const planList = useMemo(() => plansCol.items.filter((p) => p.subjectId === subjectId && p.gradeId === gradeId).sort((a, b) => (a.date < b.date ? 1 : -1)), [plansCol.items, subjectId, gradeId])

  const unidades = useMemo(() => unidadesCol.items.filter((u) => u.subjectId === subjectId && u.gradeId === gradeId && u.tipo === 'unidad'), [unidadesCol.items, subjectId, gradeId])
  const classStudents = useMemo(() => students.filter((s) => s.gradeId === gradeId && (!section || s.section === section)), [students, gradeId, section])

  const seleccionada = unidades.find((u) => u.id === newUnidadId)

  const createClass = async () => {
    if (!newUnidadId || !newDate) { window.alert('Seleccione la Unidad de Aprendizaje y la fecha.'); return }
    const u = seleccionada!
    const records: SchoolClassRecord = {
      id: genId('class'),
      planId: '',
      subjectId, gradeId, teacherId: teacher?.id ?? '', date: newDate, period: newPeriod,
      title: u.tema, status: 'programada', unidadId: u.id,
      roster: classStudents.map((s) => s.id),
      before: { objectives: u.competenciasEspecificas.join(', ') || u.tema, content: u.contenidos.conceptuales, activities: `${u.actividades.inicio}\n${u.actividades.desarrollo}\n${u.actividades.cierre}`, resources: (u.recursos.length ? u.recursos : (u.materiales ?? [])).join(', '), cronograma: `${newPeriod}: ${u.tema}` },
      during: { development: '', participation: '', observations: '' },
      after: { reflection: '', achieved: '', toImprove: '', report: '' },
      createdAt: new Date().toISOString(),
    }
    await classesCol.save(records)
    setCreateOpen(false)
    setNewUnidadId('')
  }

  const addStudent = (id: string) => {
    if (!rosterTarget) return
    const current = rosterTarget.roster ?? []
    if (current.includes(id)) return
    void classesCol.save({ ...rosterTarget, roster: [...current, id] }).then(() => setRosterTarget(null))
  }
  const removeStudent = (id: string) => {
    if (!rosterTarget) return
    const current = rosterTarget.roster ?? []
    void classesCol.save({ ...rosterTarget, roster: current.filter((x) => x !== id) }).then(() => setRosterTarget(null))
  }

  return (
    <div>
      <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(`/docentes/aulas/${gradeId}/${encodeURIComponent(section)}`)} style={{ marginBottom: '12px' }}>Volver a la asignatura</Button>
      <PageHeader
        title={`Mis Clases · ${subjectName}`}
        subtitle={`${aula} · Cree clases a partir de las Unidades de Aprendizaje de su Planificación Anual.`}
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={() => { setNewUnidadId(unidades[0]?.id ?? ''); setCreateOpen(true) }}>Crear clase</Button>}
      />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Button appearance="outline" size="small" icon={<CalendarLtrRegular />} onClick={() => navigate('/docentes/planificaciones')}>Planificación Anual</Button>
        <Button appearance="outline" size="small" icon={<CalendarLtrRegular />} onClick={() => navigate('/docentes/planificador')}>Planificador semanal</Button>
        <Button appearance="outline" size="small" icon={<CalendarCheckmarkRegular />} onClick={() => navigate('/docentes/asistencia')}>Asistencia</Button>
        <Button appearance="outline" size="small" icon={<FolderRegular />} onClick={() => navigate('/docentes/recursos')}>Recursos</Button>
      </div>

      <div className={styles.controls}>
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>{classList.length} clase(s) · {classStudents.length} estudiante(s) del aula</Text>
      </div>

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as typeof tab)} style={{ marginBottom: '16px' }}>
        <Tab value="clases">Mis Clases ({classList.length})</Tab>
        <Tab value="anual">Planificación Anual ({planList.length})</Tab>
      </TabList>

      {tab === 'clases' && (
      <>
      {classList.length === 0 && !classesCol.loading && (
        <EmptyStateView title="Sin clases" message="Cree una clase seleccionando una Unidad de Aprendizaje de su Planificación Anual." icon={<CalendarLtrRegular />} action={<Button appearance="primary" icon={<AddRegular />} onClick={() => setCreateOpen(true)}>Crear clase</Button>} />
      )}

      {classList.length > 0 && (
        <Table aria-label="Mis clases">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Unidad / Tema</TableHeaderCell>
              <TableHeaderCell>Estudiantes</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classList.map((c) => (
              <TableRow key={c.id}>
                <TableCell className={styles.cell}>
                  <Text size={300} weight="semibold">{formatDate(c.date)}</Text>
                  <Text size={200} block className={styles.small}>{c.period}</Text>
                </TableCell>
                <TableCell className={styles.cell}>{c.title}</TableCell>
                <TableCell className={styles.cell}><span className={styles.chip}>{c.roster?.length ?? 0} estudiantes</span></TableCell>
                <TableCell className={styles.cell}><StatusBadge status={c.status} /></TableCell>
                <TableCell className={styles.cell}>
                  <Toolbar size="small" style={{ gap: '4px' }}>
                    <ToolbarButton icon={<OpenRegular />} onClick={() => navigateToClass(c.id)}>Abrir</ToolbarButton>
                    <ToolbarButton icon={<PeopleRegular />} onClick={() => setRosterTarget(c)}>Estudiantes</ToolbarButton>
                    <ToolbarButton icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar esta clase?')) void classesCol.remove(c.id) }}>Eliminar</ToolbarButton>
                  </Toolbar>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      </>
      )}

      {tab === 'anual' && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => { setPlanEditing(null); setPlanOpen(true) }}>Nueva clase del cronograma</Button>
          </div>
          {planList.length === 0 && <EmptyStateView title="Sin planificación anual" message="Registre las clases programadas del cronograma anual de esta asignatura." icon={<CalendarLtrRegular />} />}
          {planList.length > 0 && (
            <Table aria-label="Planificación anual">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Periodo</TableHeaderCell>
                  <TableHeaderCell>Tema</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className={styles.cell}>{formatDate(p.date)}</TableCell>
                    <TableCell className={styles.cell}>{p.period}</TableCell>
                    <TableCell className={styles.cell}>{p.topic}</TableCell>
                    <TableCell className={styles.cell}><StatusBadge status={p.status} /></TableCell>
                    <TableCell className={styles.cell}>
                      <Toolbar size="small" style={{ gap: '4px' }}>
                        <ToolbarButton icon={<OpenRegular />} onClick={() => { setPlanEditing(p); setPlanOpen(true) }}>Editar</ToolbarButton>
                        <ToolbarButton icon={<DeleteRegular />} onClick={() => { if (window.confirm('¿Eliminar esta clase del cronograma?')) void plansCol.remove(p.id) }}>Eliminar</ToolbarButton>
                      </Toolbar>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <ModalForm open={planOpen} onOpenChange={setPlanOpen} title={planEditing ? 'Editar clase del cronograma' : 'Nueva clase del cronograma'} subtitle={`${subjectName} · ${gradeName}`} width={560}>
        <CronogramaForm initial={planEditing} subjectId={subjectId} gradeId={gradeId} teacherId={teacher?.id ?? ''} onSave={(p) => { void plansCol.save(p); setPlanOpen(false) }} onCancel={() => setPlanOpen(false)} />
      </ModalForm>

      <ModalForm open={createOpen} onOpenChange={setCreateOpen} title="Crear clase" subtitle={`${subjectName} · ${gradeName}${section ? ` · ${section}` : ''}`} width={620}>
        <FormField label="Unidad de Aprendizaje" required>
          <Select value={newUnidadId} onChange={(_, d) => setNewUnidadId(d.value)}>
            <option value="">Seleccione…</option>
            {unidades.map((u) => (<option key={u.id} value={u.id}>{u.tema}</option>))}
          </Select>
        </FormField>
        <FieldRow>
          <FormField label="Fecha" required>
            <Input type="date" value={newDate} onChange={(_, d) => setNewDate(d.value)} />
          </FormField>
          <FormField label="Periodo / Hora">
            <Input value={newPeriod} onChange={(_, d) => setNewPeriod(d.value)} />
          </FormField>
        </FieldRow>
        <FormActions onSubmit={() => void createClass()} onCancel={() => setCreateOpen(false)} submitLabel="Crear clase" />
      </ModalForm>

      <ModalForm open={!!rosterTarget} onOpenChange={(o) => !o && setRosterTarget(null)} title="Estudiantes de la clase" subtitle={rosterTarget?.title ?? ''} width={520}>
        {rosterTarget && (
          <div>
            <Text size={300} block style={{ marginBottom: '10px' }}>Agregar / quitar estudiantes del aula:</Text>
            <div className={styles.roster}>
              {classStudents.map((s) => (
                <span key={s.id} className={styles.chip} onClick={() => (rosterTarget.roster ?? []).includes(s.id) ? removeStudent(s.id) : addStudent(s.id)} style={{ cursor: 'pointer', background: (rosterTarget.roster ?? []).includes(s.id) ? 'rgba(0,130,173,0.22)' : 'rgba(0,130,173,0.10)' }}>
                  {(rosterTarget.roster ?? []).includes(s.id) ? '✓ ' : '+ '}{s.fullName}
                </span>
              ))}
              {classStudents.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>No hay estudiantes en este curso/sección.</Text>}
            </div>
          </div>
        )}
      </ModalForm>
    </div>
  )
}

function CronogramaForm({ initial, subjectId, gradeId, teacherId, onSave, onCancel }: { initial: ClassPlan | null; subjectId: string; gradeId: string; teacherId: string; onSave: (p: ClassPlan) => void; onCancel: () => void }) {
  const [form, setForm] = useState<ClassPlan>(() => initial ?? { id: genId('plan'), subjectId, teacherId, gradeId, date: todayIso(), period: '07:45 - 08:30', topic: '', objective: '', content: '', strategy: '', resources: '', evaluation: '', status: 'planificada' })
  const set = <K extends keyof ClassPlan>(k: K, v: ClassPlan[K]) => setForm((f) => ({ ...f, [k]: v }))
  const submit = () => {
    if (!form.topic || !form.date) { window.alert('Complete el tema y la fecha.'); return }
    onSave(form)
  }
  return (
    <div>
      <FieldRow>
        <FormField label="Fecha" required>
          <Input type="date" value={form.date} onChange={(_, d) => set('date', d.value)} />
        </FormField>
        <FormField label="Periodo / Hora">
          <Input value={form.period} onChange={(_, d) => set('period', d.value)} />
        </FormField>
      </FieldRow>
      <FormField label="Tema de la clase" required>
        <Input value={form.topic} onChange={(_, d) => set('topic', d.value)} placeholder="Ej. Los números enteros" />
      </FormField>
      <FormField label="Objetivo">
        <Input value={form.objective} onChange={(_, d) => set('objective', d.value)} />
      </FormField>
      <FormField label="Contenido">
        <Input value={form.content} onChange={(_, d) => set('content', d.value)} />
      </FormField>
      <FormField label="Recursos">
        <Input value={form.resources} onChange={(_, d) => set('resources', d.value)} />
      </FormField>
      <FormActions onSubmit={submit} onCancel={onCancel} submitLabel={initial ? 'Actualizar' : 'Guardar'} />
    </div>
  )
}
