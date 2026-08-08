import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, OpenRegular, SearchRegular, PlayRegular, DeleteRegular, CalendarTodayRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { PlanForm } from './PlanForm'
import type { ClassPlan, SchoolClassRecord } from '../../types'
import { formatDate, genId, relativeDay } from '../../utils/helpers'

const useStyles = makeStyles({
  toolbar: { marginBottom: '16px', gap: '12px', flexWrap: 'wrap' },
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
})

export function AnualPlanPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { subjects, grades, subjectById, gradeById, teacherById, role } = useApp()

  const plansCol = useCollection<ClassPlan>(dataService.getClassPlans, dataService.saveClassPlan, dataService.deleteClassPlan)
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses, dataService.saveClassRecord, dataService.deleteClassRecord)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassPlan | null>(null)
  const [visibleCount, setVisibleCount] = useState(30)

  const filtered = useMemo(() => {
    return plansCol.items
      .filter((p) => !subjectFilter || p.subjectId === subjectFilter)
      .filter((p) => !gradeFilter || p.gradeId === gradeFilter)
      .filter((p) => !search || p.topic.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [plansCol.items, subjectFilter, gradeFilter, search])

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (plan: ClassPlan) => {
    setEditing(plan)
    setFormOpen(true)
  }

  const handleSave = async (plan: ClassPlan) => {
    await plansCol.save(plan)
    setFormOpen(false)
  }

  const handleDelete = async (plan: ClassPlan) => {
    if (!window.confirm('¿Desea eliminar esta clase del plan anual?')) return
    try {
      await plansCol.remove(plan.id)
    } catch {
      /* error mostrado por el hook */
    }
  }

  const handleImpartir = async (plan: ClassPlan) => {
    const subject = subjectById(plan.subjectId)
    const record: SchoolClassRecord = {
      id: genId('class'),
      planId: plan.id,
      subjectId: plan.subjectId,
      teacherId: plan.teacherId,
      gradeId: plan.gradeId,
      date: plan.date,
      period: plan.period,
      title: `${subject?.name ?? ''} · ${plan.topic}`,
      status: 'en_progreso',
      before: {
        objectives: plan.objective,
        content: plan.content,
        activities: '',
        resources: plan.resources,
        cronograma: `${plan.period}: ${plan.topic}`,
      },
      during: { development: '', participation: '', observations: '' },
      after: { reflection: '', achieved: '', toImprove: '', report: '' },
      createdAt: new Date().toISOString(),
    }
    await classesCol.save(record)
    await plansCol.save({ ...plan, status: 'impartida', classId: record.id })
    navigate(`/${role === 'admin' ? 'administrativo' : 'docentes'}/clases/${record.id}`)
  }

  return (
    <div>
      <PageHeader
        title="Planificación Anual"
        subtitle="Cronograma de clases programadas por asignatura, grado y docente. Cada clase impartida se registra vinculada a este plan."
        actions={
          <Button appearance="primary" icon={<AddRegular />} onClick={openNew}>
            Nueva clase planificada
          </Button>
        }
      />

      <div className={styles.filterRow}>
        <Select value={subjectFilter} onChange={(_, d) => setSubjectFilter(d.value)} style={{ minWidth: '200px' }}>
          <option value="">Todas las asignaturas</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={gradeFilter} onChange={(_, d) => setGradeFilter(d.value)} style={{ minWidth: '160px' }}>
          <option value="">Todos los grados</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        <Input
          placeholder="Buscar por tema…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          contentBefore={<SearchRegular />}
          style={{ minWidth: '240px', flex: 1 }}
        />
      </div>

      <Table aria-label="Planificación anual">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Periodo</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Grado</TableHeaderCell>
            <TableHeaderCell>Tema</TableHeaderCell>
            <TableHeaderCell>Docente</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.slice(0, visibleCount).map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className={styles.cell}>
                <Text size={300} weight="semibold">{formatDate(plan.date)}</Text>
                <Text size={200} block style={{ color: tokens.colorNeutralForeground2 }}>{relativeDay(plan.date)}</Text>
              </TableCell>
              <TableCell className={styles.cell}>{plan.period}</TableCell>
              <TableCell className={styles.cell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: subjectById(plan.subjectId)?.color ?? '#999' }} />
                  {subjectById(plan.subjectId)?.name ?? plan.subjectId}
                </span>
              </TableCell>
              <TableCell className={styles.cell}>{gradeById(plan.gradeId)?.name ?? plan.gradeId}</TableCell>
              <TableCell className={styles.cell}>{plan.topic}</TableCell>
              <TableCell className={styles.cell}>{teacherById(plan.teacherId)?.fullName ?? '—'}</TableCell>
              <TableCell className={styles.cell}><StatusBadge status={plan.status} /></TableCell>
              <TableCell className={styles.cell}>
                <Toolbar size="small" style={{ gap: '4px' }}>
                  {plan.status !== 'impartida' && (
                    <ToolbarButton icon={<PlayRegular />} onClick={() => void handleImpartir(plan)}>Impartir</ToolbarButton>
                  )}
                  <ToolbarButton icon={<OpenRegular />} onClick={() => openEdit(plan)}>Editar</ToolbarButton>
                  <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(plan)}>Eliminar</ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filtered.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <Button appearance="outline" onClick={() => setVisibleCount((c) => c + 30)}>
            Mostrar más ({filtered.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      {!plansCol.loading && filtered.length === 0 && (
        <EmptyStateView
          title="No hay clases planificadas"
          message="Cree la planificación anual para empezar a registrar cada clase impartida."
          icon={<CalendarTodayRegular />}
          action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Crear planificación</Button>}
        />
      )}

      <ModalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar clase planificada' : 'Nueva clase planificada'}
        subtitle="Planificación anual · el docente asocia cada clase a este programa"
      >
        <PlanForm
          initial={editing}
          onSave={(plan) => void handleSave(plan)}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>
    </div>
  )
}
