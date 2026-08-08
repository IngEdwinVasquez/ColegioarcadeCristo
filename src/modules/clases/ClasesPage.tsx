import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, makeStyles, tokens } from '@fluentui/react-components'
import { AddRegular, NotebookRegular, OpenRegular, SearchRegular, CalendarCheckmarkRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { ClaseForm } from './ClaseForm'
import type { SchoolClassRecord } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
  countBadge: { background: `${tokens.colorBrandBackground}1a`, color: tokens.colorBrandForeground1, borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 },
})

export function ClasesPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { subjects, grades, subjectById, gradeById, teacherById, role } = useApp()
  const classesCol = useCollection<SchoolClassRecord>(dataService.getClasses, dataService.saveClassRecord, dataService.deleteClassRecord)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const filtered = useMemo(() => {
    return classesCol.items
      .filter((c) => !subjectFilter || c.subjectId === subjectFilter)
      .filter((c) => !gradeFilter || c.gradeId === gradeFilter)
      .filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [classesCol.items, subjectFilter, gradeFilter, search])

  const basePath = role === 'admin' ? '/administrativo' : '/docentes'
  const completed = filtered.filter((c) => c.status === 'completada').length
  const pending = filtered.filter((c) => c.status !== 'completada').length

  return (
    <div>
      <PageHeader
        title="Repositorio de Clases Impartidas"
        subtitle="Registro integral de cada clase: ANTES (planificación), DURANTE (desarrollo) y DESPUÉS (reflexión e informe). Vinculado a la planificación anual."
        actions={
          <>
            <span className={styles.countBadge}>{classesCol.items.length} registros</span>
            <Button appearance="primary" icon={<AddRegular />} onClick={() => setFormOpen(true)}>
              Nueva clase
            </Button>
          </>
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
          placeholder="Buscar por título…"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          contentBefore={<SearchRegular />}
          style={{ minWidth: '240px', flex: 1 }}
        />
      </div>

      <Text size={300} block style={{ marginBottom: '12px' }}>
        Completadas: <strong>{completed}</strong> · En proceso / programadas: <strong>{pending}</strong>
      </Text>

      <Table aria-label="Clases impartidas">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Asignatura</TableHeaderCell>
            <TableHeaderCell>Grado</TableHeaderCell>
            <TableHeaderCell>Clase</TableHeaderCell>
            <TableHeaderCell>Docente</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((clase) => (
            <TableRow key={clase.id}>
              <TableCell className={styles.cell}>
                <Text size={300} weight="semibold">{formatDate(clase.date)}</Text>
                <Text size={200} block style={{ color: tokens.colorNeutralForeground2 }}>{clase.period}</Text>
              </TableCell>
              <TableCell className={styles.cell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: subjectById(clase.subjectId)?.color ?? '#999' }} />
                  {subjectById(clase.subjectId)?.name ?? clase.subjectId}
                </span>
              </TableCell>
              <TableCell className={styles.cell}>{gradeById(clase.gradeId)?.name ?? clase.gradeId}</TableCell>
              <TableCell className={styles.cell}>{clase.title}</TableCell>
              <TableCell className={styles.cell}>{teacherById(clase.teacherId)?.fullName ?? '—'}</TableCell>
              <TableCell className={styles.cell}><StatusBadge status={clase.status} /></TableCell>
              <TableCell className={styles.cell}>
                <Toolbar size="small">
                  <ToolbarButton icon={<OpenRegular />} onClick={() => navigate(`${basePath}/clases/${clase.id}`)}>Abrir</ToolbarButton>
                  {clase.status !== 'completada' && (
                    <ToolbarButton icon={<CalendarCheckmarkRegular />} onClick={() => navigate(`${basePath}/clases/${clase.id}?tomar=1`)}>Asistencia</ToolbarButton>
                  )}
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!classesCol.loading && filtered.length === 0 && (
        <EmptyStateView
          title="No hay clases registradas"
          message="Cada clase impartida se registra aquí con su planificación, desarrollo e informe. Puede crearlas desde la planificación anual o manualmente."
          icon={<NotebookRegular />}
          action={<Button appearance="primary" icon={<AddRegular />} onClick={() => setFormOpen(true)}>Registrar clase</Button>}
        />
      )}

      <ModalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Nueva clase"
        subtitle="Registre una clase manual o a partir de la planificación anual"
      >
        <ClaseForm
          onSave={async (record) => {
            await classesCol.save(record)
            setFormOpen(false)
          }}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>
    </div>
  )
}
