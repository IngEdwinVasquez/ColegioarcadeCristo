import { useEffect, useMemo, useState } from 'react'
import { Combobox, Option, Spinner, Text } from '@fluentui/react-components'
import { PersonRegular } from '@fluentui/react-icons'
import { FormField } from './form'
import { entraEmail, getDirectoryUsers } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'
import type { EntraUser } from '../../services/entraUsers'

interface EntraUserPickerProps {
  label?: string
  value?: string
  /** Ids ya vinculados a otra ficha del mismo tipo (se muestran deshabilitados) */
  takenIds?: string[]
  onChange: (user: EntraUser | null) => void
  hint?: string
}

/**
 * Selector obligatorio de cuenta de Microsoft 365 (Entra ID) con búsqueda por nombre o correo.
 */
export function EntraUserPicker({ label = 'Cuenta de Microsoft 365 (Entra ID)', value, takenIds = [], onChange, hint }: EntraUserPickerProps) {
  const [users, setUsers] = useState<EntraUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getDirectoryUsers()
      .then((list) => {
        if (active) setUsers(list)
      })
      .catch((err: unknown) => {
        if (active) setError(graphErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const selected = useMemo(() => users.find((u) => u.id === value), [users, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? users.filter((u) => (u.displayName ?? '').toLowerCase().includes(q) || entraEmail(u).includes(q)) : users
    return list.slice(0, 60)
  }, [users, query])

  const labelOf = (u: EntraUser) => `${u.displayName ?? entraEmail(u)} · ${entraEmail(u)}`

  return (
    <FormField label={label} required>
      <Combobox
        placeholder={loading ? 'Cargando directorio…' : 'Buscar por nombre o correo…'}
        value={selected ? labelOf(selected) : query}
        selectedOptions={value ? [value] : []}
        onInput={(e) => {
          setQuery((e.target as HTMLInputElement).value)
          if (value) onChange(null)
        }}
        onOptionSelect={(_, data) => {
          const user = users.find((u) => u.id === data.optionValue)
          setQuery('')
          onChange(user ?? null)
        }}
        disabled={loading || !!error}
        expandIcon={loading ? <Spinner size="tiny" /> : <PersonRegular />}
        freeform
      >
        {filtered.map((u) => (
          <Option key={u.id} value={u.id} text={labelOf(u)} disabled={takenIds.includes(u.id) && u.id !== value}>
            {labelOf(u)}
            {takenIds.includes(u.id) && u.id !== value ? ' (ya vinculado)' : ''}
          </Option>
        ))}
        {!loading && filtered.length === 0 && (
          <Option value="__none" disabled text="Sin resultados">
            Sin resultados en el directorio
          </Option>
        )}
      </Combobox>
      {error && <Text size={200} style={{ color: '#B42318' }}>No se pudo leer el directorio: {error}</Text>}
      {!error && (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>
          {hint ?? 'Obligatorio. La cuenta recibirá el rol correspondiente al guardar. Si la persona aún no tiene cuenta, créela primero en Microsoft Entra ID.'}
        </Text>
      )}
    </FormField>
  )
}
