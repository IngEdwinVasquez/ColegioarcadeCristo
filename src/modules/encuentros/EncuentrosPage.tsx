import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Toolbar, ToolbarButton, makeStyles } from '@fluentui/react-components'
import { AddRegular, OpenRegular, DeleteRegular, CalendarRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { ModalForm } from '../../components/shared/ModalForm'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { EncuentroForm } from './EncuentroForm'
import type { VirtualMeeting } from '../../types'
import { formatDate } from '../../utils/helpers'

const useStyles = makeStyles({
  filterRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  cell: { verticalAlign: 'middle' },
})

export function EncuentrosPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { teacherById, role } = useApp()
  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings, dataService.saveMeeting, dataService.deleteMeeting)
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VirtualMeeting | null>(null)

  const filtered = useMemo(() => {
    return meetingsCol.items
      .filter((m) => !statusFilter || m.status === statusFilter)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [meetingsCol.items, statusFilter])

  const basePath = role === 'admin' ? '/administrativo' : '/docentes'

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const handleSave = async (meeting: VirtualMeeting) => {
    await meetingsCol.save(meeting)
    setFormOpen(false)
  }
  const handleDelete = async (m: VirtualMeeting) => {
    if (!window.confirm('¿Desea eliminar este encuentro?')) return
    try {
      await meetingsCol.remove(m.id)
    } catch {
      /* error del hook */
    }
  }

  return (
    <div>
      <PageHeader
        title="Encuentros Virtuales"
        subtitle="Registro de reuniones y encuentros virtuales: agenda, acta de lo tratado, acuerdos y planificación de actividades futuras derivadas del encuentro."
        actions={
          <Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Programar encuentro</Button>
        }
      />

      <div className={styles.filterRow}>
        <Select value={statusFilter} onChange={(_, d) => setStatusFilter(d.value)} style={{ minWidth: '180px' }}>
          <option value="">Todos los estados</option>
          <option value="programado">Programado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </div>

      <Table aria-label="Encuentros virtuales">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Hora</TableHeaderCell>
            <TableHeaderCell>Título</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Organizador</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((m) => (
            <TableRow key={m.id}>
              <TableCell className={styles.cell}>{formatDate(m.date)}</TableCell>
              <TableCell className={styles.cell}>{m.startTime} - {m.endTime}</TableCell>
              <TableCell className={styles.cell}>{m.title}</TableCell>
              <TableCell className={styles.cell}>{m.type}</TableCell>
              <TableCell className={styles.cell}>{teacherById(m.organizerId)?.fullName ?? '—'}</TableCell>
              <TableCell className={styles.cell}><StatusBadge status={m.status} /></TableCell>
              <TableCell className={styles.cell}>
                <Toolbar size="small">
                  <ToolbarButton icon={<OpenRegular />} onClick={() => navigate(`${basePath}/encuentros/${m.id}`)}>Abrir / Acta</ToolbarButton>
                  <ToolbarButton icon={<DeleteRegular />} onClick={() => void handleDelete(m)}>Eliminar</ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!meetingsCol.loading && filtered.length === 0 && (
        <EmptyStateView
          title="Sin encuentros registrados"
          message="Programe y registre los encuentros virtuales con su acta y acuerdos para el seguimiento."
          icon={<CalendarRegular />}
          action={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Programar encuentro</Button>}
        />
      )}

      <ModalForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar encuentro' : 'Programar encuentro'}
        subtitle="Encuentro virtual · programación y registro"
      >
        <EncuentroForm
          initial={editing}
          onSave={(m) => void handleSave(m)}
          onCancel={() => setFormOpen(false)}
        />
      </ModalForm>
    </div>
  )
}
