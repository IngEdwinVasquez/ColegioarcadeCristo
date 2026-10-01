import { useMemo, useState } from 'react'
import { Button, Input, Select, Spinner, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Textarea, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { EmptyStateView } from '../../components/shared/EmptyStateView'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId } from '../../utils/helpers'
import type { TicGestionItem, TicGestionTipo } from '../../types'

const TABS: Array<{ key: TicGestionTipo; label: string; detalle: string }> = [
  { key: 'club', label: 'Clubes Estudiantiles', detalle: 'Nivel / Grado' },
  { key: 'infraestructura', label: 'Infraestructura Física y Digital', detalle: 'Ubicación' },
  { key: 'm365', label: 'Proyecto Docente M365', detalle: 'Docente / Destinatario' },
]

const ESTADOS = ['Planificado', 'En ejecución', 'Completado', 'Pendiente']

const useStyles = makeStyles({
  bar: { display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' },
  cell: { verticalAlign: 'middle' },
})

/** Gestión del Departamento de Tecnología: Clubes Estudiantiles, Infraestructura y Proyecto Docente M365. */
export function GestionDepTecnologia() {
  const styles = useStyles()
  const toaster = useToastController()
  const col = useCollection<TicGestionItem>(dataService.getTicGestion, dataService.saveTicGestion, dataService.deleteTicGestion)
  const [tab, setTab] = useState<TicGestionTipo>('club')
  const [editing, setEditing] = useState<TicGestionItem | null>(null)
  const [open, setOpen] = useState(false)

  const activo = TABS.find((t) => t.key === tab)!
  const items = useMemo(
    () => col.items.filter((i) => i.tipo === tab).sort((a, b) => (a.titulo ?? '').localeCompare(b.titulo ?? '')),
    [col.items, tab],
  )

  const abrirNuevo = () => {
    const ahora = new Date().toISOString()
    setEditing({ id: genId('tg'), tipo: tab, titulo: '', descripcion: '', detalle: '', estado: 'Planificado', fecha: '', createdAt: ahora, updatedAt: ahora })
    setOpen(true)
  }
  const abrirEditar = (i: TicGestionItem) => { setEditing({ ...i }); setOpen(true) }

  const guardar = async () => {
    if (!editing || !editing.titulo.trim()) { toaster.dispatchToast('Indica el título.', { intent: 'error' }); return }
    try {
      await col.save({ ...editing, tipo: tab, updatedAt: new Date().toISOString() })
      setOpen(false)
      setEditing(null)
      toaster.dispatchToast('Guardado.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo guardar.', { intent: 'error' })
    }
  }

  const eliminar = async (i: TicGestionItem) => {
    if (!window.confirm(`¿Eliminar "${i.titulo}"?`)) return
    await col.remove(i.id)
    toaster.dispatchToast('Eliminado.', { intent: 'success' })
  }

  return (
    <div>
      <PageHeader
        title="Gestión Dep. Tecnología"
        subtitle="Administración de los proyectos de la Coordinación TIC: Clubes Estudiantiles, Infraestructura Física y Digital, y Proyecto Docente M365."
      />

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TicGestionTipo)} style={{ marginBottom: '14px' }}>
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key}>{t.label} ({col.items.filter((i) => i.tipo === t.key).length})</Tab>
        ))}
      </TabList>

      <div className={styles.bar}>
        <Button appearance="primary" icon={<AddRegular />} onClick={abrirNuevo}>Agregar</Button>
      </div>

      {col.loading ? (
        <Spinner label="Cargando…" />
      ) : items.length === 0 ? (
        <EmptyStateView title="Sin registros" message={`No hay elementos en ${activo.label}.`} />
      ) : (
        <Table aria-label={activo.label}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Título</TableHeaderCell>
              <TableHeaderCell>{activo.detalle}</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Descripción</TableHeaderCell>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className={styles.cell}><Text weight="semibold">{i.titulo}</Text></TableCell>
                <TableCell className={styles.cell}>{i.detalle || '—'}</TableCell>
                <TableCell className={styles.cell}>{i.estado || '—'}</TableCell>
                <TableCell className={styles.cell}>{i.descripcion || '—'}</TableCell>
                <TableCell className={styles.cell}>{i.fecha || '—'}</TableCell>
                <TableCell className={styles.cell}>
                  <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => abrirEditar(i)}>Editar</Button>
                  <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => void eliminar(i)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ModalForm
        open={open}
        onOpenChange={(o) => { if (!o) setOpen(false) }}
        title={`${editing && col.items.some((x) => x.id === editing.id) ? 'Editar' : 'Agregar'} · ${activo.label}`}
        width={560}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void guardar()}>Guardar</Button>
          </>
        }
      >
        {editing && (
          <>
            <FormField label="Título" required>
              <Input value={editing.titulo} onChange={(_, d) => setEditing({ ...editing, titulo: d.value })} />
            </FormField>
            <FieldRow>
              <FormField label={activo.detalle}>
                <Input value={editing.detalle ?? ''} onChange={(_, d) => setEditing({ ...editing, detalle: d.value })} />
              </FormField>
              <FormField label="Estado">
                <Select value={editing.estado ?? 'Planificado'} onChange={(_, d) => setEditing({ ...editing, estado: d.value })}>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </Select>
              </FormField>
            </FieldRow>
            <FormField label="Descripción">
              <Textarea value={editing.descripcion ?? ''} resize="vertical" onChange={(_, d) => setEditing({ ...editing, descripcion: d.value })} />
            </FormField>
            <FormField label="Fecha">
              <Input type="date" value={editing.fecha ?? ''} onChange={(_, d) => setEditing({ ...editing, fecha: d.value })} />
            </FormField>
          </>
        )}
      </ModalForm>
    </div>
  )
}
