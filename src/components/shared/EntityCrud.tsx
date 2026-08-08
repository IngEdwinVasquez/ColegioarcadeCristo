import { useMemo, useState, type ReactNode } from 'react'
import { Button, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, EditRegular, SearchRegular } from '@fluentui/react-icons'
import { PageHeader } from './PageHeader'
import { ModalForm } from './ModalForm'
import { EmptyStateView } from './EmptyStateView'

const useStyles = makeStyles({
  toolbar: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  search: { minWidth: '240px', flex: '1 1 260px' },
  cell: { verticalAlign: 'middle' },
})

export interface CrudColumn<T> {
  header: string
  render: (item: T) => ReactNode
  hideMobile?: boolean
}

interface EntityCrudProps<T extends { id: string }> {
  title: string
  subtitle?: string
  items: T[]
  loading?: boolean
  columns: CrudColumn<T>[]
  createDefault: () => T
  renderForm: (value: T, setValue: (next: T) => void) => ReactNode
  onSave: (item: T) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  newLabel?: string
  saveLabel?: string
  searchText?: (item: T) => string
  filterRow?: ReactNode
  emptyMessage?: string
}

export function EntityCrud<T extends { id: string }>({
  title,
  subtitle,
  items,
  loading = false,
  columns,
  createDefault,
  renderForm,
  onSave,
  onDelete,
  newLabel = 'Nuevo',
  saveLabel = 'Guardar',
  searchText,
  filterRow,
  emptyMessage,
}: EntityCrudProps<T>) {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!query || !searchText) return items
    const q = query.toLowerCase()
    return items.filter((i) => searchText(i).toLowerCase().includes(q))
  }, [items, query, searchText])

  const openNew = () => {
    setEditing(createDefault())
    setOpen(true)
  }
  const openEdit = (item: T) => {
    setEditing({ ...item })
    setOpen(true)
  }

  const submit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await onSave(editing)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button appearance="primary" icon={<AddRegular />} onClick={openNew}>
            {newLabel}
          </Button>
        }
      />

      <div className={styles.toolbar}>
        {filterRow}
        {searchText && (
          <Input
            className={styles.search}
            placeholder="Buscar…"
            value={query}
            onChange={(_, d) => setQuery(d.value)}
            contentBefore={<SearchRegular />}
          />
        )}
      </div>

      <Table aria-label={title}>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHeaderCell key={c.header}>{c.header}</TableHeaderCell>
            ))}
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id}>
              {columns.map((c) => (
                <TableCell key={c.header} className={styles.cell}>{c.render(item)}</TableCell>
              ))}
              <TableCell className={styles.cell}>
                <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => openEdit(item)}>
                  Editar
                </Button>
                {onDelete && (
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<DeleteRegular />}
                    onClick={() => {
                      if (window.confirm('¿Desea eliminar este registro?')) void onDelete(item.id)
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!loading && filtered.length === 0 && (
        <EmptyStateView title="Sin registros" message={emptyMessage ?? 'No hay datos que mostrar.'} />
      )}

      <ModalForm
        open={open}
        onOpenChange={setOpen}
        title={editing && items.some((i) => i.id === editing.id) ? `Editar · ${title}` : `${newLabel} · ${title}`}
        width={720}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void submit()} disabled={saving}>
              {saving ? 'Guardando…' : saveLabel}
            </Button>
          </>
        }
      >
        {editing && renderForm(editing, setEditing)}
      </ModalForm>
    </div>
  )
}
