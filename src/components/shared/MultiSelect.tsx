import { useMemo, useState } from 'react'
import { Badge, Checkbox, Input, Text, makeStyles, tokens } from '@fluentui/react-components'
import { SearchRegular } from '@fluentui/react-icons'
import { FormField } from './form'

const useStyles = makeStyles({
  box: {
    border: '1px solid var(--borde)',
    borderRadius: '10px',
    background: 'var(--superficie)',
    overflow: 'hidden',
  },
  list: { maxHeight: '190px', overflowY: 'auto', padding: '4px 8px' },
  row: { display: 'flex', alignItems: 'center' },
  header: { padding: '8px 10px', borderBottom: '1px solid var(--borde)', display: 'flex', gap: '8px', alignItems: 'center' },
  footer: { padding: '6px 12px', borderTop: '1px solid var(--borde)', display: 'flex', gap: '6px', flexWrap: 'wrap', background: tokens.colorNeutralBackground2 },
  empty: { padding: '12px', color: 'var(--texto-suave)' },
})

export interface MultiSelectOption {
  id: string
  label: string
  detail?: string
}

interface MultiSelectProps {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  required?: boolean
  emptyMessage?: string
}

/**
 * Lista filtrable con selección múltiple (RM-005): buscador + casillas,
 * con resumen de lo seleccionado.
 */
export function MultiSelect({ label, options, selected, onChange, placeholder = 'Filtrar…', required, emptyMessage = 'Sin elementos en el catálogo.' }: MultiSelectProps) {
  const styles = useStyles()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.detail?.toLowerCase().includes(q)) : options
  }, [options, query])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <FormField label={label} required={required}>
      <div className={styles.box}>
        <div className={styles.header}>
          <Input
            appearance="filled-lighter"
            style={{ flex: 1 }}
            size="small"
            contentBefore={<SearchRegular />}
            placeholder={placeholder}
            value={query}
            onChange={(_, d) => setQuery(d.value)}
          />
          <Text size={200} style={{ color: 'var(--texto-suave)', whiteSpace: 'nowrap' }}>
            {selected.length} de {options.length}
          </Text>
        </div>
        <div className={styles.list}>
          {options.length === 0 && <div className={styles.empty}>{emptyMessage}</div>}
          {options.length > 0 && filtered.length === 0 && <div className={styles.empty}>Sin coincidencias para “{query}”.</div>}
          {filtered.map((o) => (
            <div key={o.id} className={styles.row}>
              <Checkbox
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
                label={o.detail ? `${o.label} · ${o.detail}` : o.label}
              />
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <div className={styles.footer}>
            {selected.map((id) => {
              const o = options.find((x) => x.id === id)
              return (
                <Badge key={id} appearance="tint" color="brand" style={{ cursor: 'pointer' }} onClick={() => toggle(id)} title="Quitar">
                  {o?.label ?? id} ✕
                </Badge>
              )
            })}
          </div>
        )}
      </div>
    </FormField>
  )
}
