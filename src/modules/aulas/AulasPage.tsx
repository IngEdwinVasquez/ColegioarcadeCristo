import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, SearchRegular, ClipboardTaskRegular, StarRegular, DeleteRegular, OpenRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { ActividadForm } from './ActividadForm'
import { CalificacionesModal } from './CalificacionesModal'
import type { Activity } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  typeChip: { padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
})

const TYPE_LABELS: Record<string, string> = {
  tarea: 'Tarea',
  quiz: 'Quiz',
  proyecto: 'Proyecto',
  evaluacion: 'Evaluación',
  lectura: 'Lectura',
  foro: 'Foro',
}

export function AulasPage() {
  const styles = useStyles()
  const [params] = useSearchParams()
  const { subjects, grades, subjectById, gradeById } = useApp()
  const activitiesCol = useCollection<Activity>(dataService.getActivities, dataService.saveActivity, dataService.deleteActivity)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [calificar, setCalificar] = useState<Activity | null>(null)

  useEffect(() => {
    const classId = params.get('classId')
    if (classId) {
      void dataService.getClasses().then((classes) => {
        const clase = classes.find((c) => c.id === classId)
        if (clase) {
          setSubjectFilter(clase.subjectId)
          setGradeFilter(clase.gradeId)
        }
      })
    }
  }, [params])

  const filtered = useMemo(() => {
    return activitiesCol.items
      .filter((a) => !subjectFilter || a.subjectId === subjectFilter)
      .filter((a) => !gradeFilter || a.gradeId === gradeFilter)
      .filter((a) => !search || a.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
  }, [activitiesCol.items, subjectFilter, gradeFilter, search])

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: Activity) => {
    setEditing(a)
    setFormOpen(true)
  }
  const handleSave = async (activity: Activity) => {
    await activitiesCol.save(activity)
    setFormOpen(false)
  }
  const handleDelete = async (a: Activity) => {
    if (!window.confirm('¿Desea eliminar esta actividad y sus calificaciones?')) return
    try {
      await activitiesCol.remove(a.id)
    } catch {
      /* error del hook */
    }
  }

  return (
    <div>
      <PageHeader
        title="Aulas Virtuales"
        subtitle="Publique actividades para los estudiantes, registre la entrega y califique cada actividad. Las calificaciones alimentan el seguimiento académico."
        actions={
          <Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Nueva actividad</Button>
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
          placeholder="Buscar actividad…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          contentBefore={<SearchRegular />}
          style={{ minWidth: '240px', flex: 1 }}
        />
      </div>

      <Table aria-label="Actividades del aula virtual">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Actividad</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Grado</TableHeaderCell>
            <TableHeaderCell>Valor</TableHeaderCell>
            <TableHeaderCell>Publicada</TableHeaderCell>
            <TableHeaderCell>Entrega</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((a) => (
            <TableRow key={a.id}>
              <TableCell className={styles.cell}>
                <Text size={300} weight="semibold" block>{a.title}</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{a.description.slice(0, 60)}…</Text>
                {a.attachments?.length > 0 && (
                  <Text size={200} block style={{ color: tokens.colorNeutralForeground2 }}>
                    📎 {a.attachments.length} adjunto(s) en OneDrive
                  </Text>
                )}
              </TableCell>
              <TableCell className={styles.cell}>
                <span className={styles.typeChip} style={{ background: '#eef2f7', color: tokens.colorNeutralForeground1 }}>
                  {TYPE_LABELS[a.type] ?? a.type}
                </span>
              </TableCell>
              <TableCell className={styles.cell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: subjectById(a.subjectId)?.color ?? '#999' }} />
                  {subjectById(a.subjectId)?.shortName ?? a.subjectId}
                </span>
              </TableCell>
              <TableCell className={styles.cell}>{gradeById(a.gradeId)?.name ?? a.gradeId}</TableCell>
              <TableCell className={styles.cell}>{a.points} pts</TableCell>
              <TableCell className={styles.cell}>{formatDate(a.publishDate)}</TableCell>
              <TableCell className={styles.cell}>{formatDate(a.dueDate)}</TableCell>
              <TableCell className={styles.cell}><StatusBadge status={a.status} /></TableCell>
              <TableCell className={styles.cell}>
                <Toolbar size="small">
                  <ToolbarButton icon={<StarRegular />} onClick={() => setCalificar(a)}>Calificar</ToolbarButton>
                  <ToolbarButton icon={<OpenRegular />} onClick={() => openEdit(a)}>Editar</ToolbarButton>
                  <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(a)}>Eliminar</ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!activitiesCol.loading && filtered.length === 0 && (
        <EmptyStateView
          title="Sin actividades"
          message="Publique la primera actividad del aula virtual para que los estudiantes puedan entregarla."
          icon={<ClipboardTaskRegular />}
          action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Crear actividad</Button>}
        />
      )}

      <ModalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar actividad' : 'Nueva actividad'}
        subtitle="Aula virtual · actividad y asignación para los estudiantes"
      >
        <ActividadForm
          initial={editing}
          onSave={(a) => void handleSave(a)}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>

      {calificar && (
        <CalificacionesModal activity={calificar} open onOpenChange={(o) => { if (!o) setCalificar(null) }} />
      )}
    </div>
  )
}
