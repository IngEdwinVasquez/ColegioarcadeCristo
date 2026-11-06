import { useEffect, useMemo, useState } from 'react'
import { Button, Combobox, Input, Option, Spinner, Text } from '@fluentui/react-components'
import { AddRegular, PersonRegular } from '@fluentui/react-icons'
import { FormField } from './form'
import { ModalForm } from './ModalForm'
import { entraEmail, getDirectoryUsers } from '../../services/userLinks'
import { createEntraUser, M365_DOMAIN, type EntraUser } from '../../services/entraUsers'
import { graphErrorMessage } from '../../services/graph'

interface EntraUserPickerProps {
  label?: string
  value?: string
  /** Ids ya vinculados a otra ficha del mismo tipo (se muestran deshabilitados) */
  takenIds?: string[]
  /** Nombre de la persona (para sugerir el correo al crear la cuenta). */
  defaultName?: string
  onChange: (user: EntraUser | null) => void
  hint?: string
}

const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Sugiere nombre.apellido@dominio a partir del nombre completo. */
function sugerirCorreo(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return ''
  const primerNombre = parts[0]
  // Con 4 palabras se asume "nombre nombre apellido apellido" → primer nombre + primer apellido.
  const primerApellido = parts.length >= 4 ? parts[2] : parts[1]
  return `${norm(primerNombre)}.${norm(primerApellido)}@${M365_DOMAIN}`
}

/** Genera una contraseña temporal válida. */
function passwordTemporal(): string {
  const r = Math.random().toString(36).slice(2, 8)
  return `Arca${r.charAt(0).toUpperCase()}${r.slice(1)}!7`
}

/**
 * Selector obligatorio de cuenta de Microsoft 365 (Entra ID) con búsqueda por nombre o correo.
 * Permite además crear una cuenta nueva (aparece en «Usuarios activos» de Microsoft 365).
 */
export function EntraUserPicker({ label = 'Cuenta de Microsoft 365 (Entra ID)', value, takenIds = [], defaultName, onChange, hint }: EntraUserPickerProps) {
  const [users, setUsers] = useState<EntraUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [pass, setPass] = useState('')
  const [creando, setCreando] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  const abrirCrear = () => {
    const n = defaultName ?? query
    setNombre(n)
    setCorreo(sugerirCorreo(n))
    setPass(passwordTemporal())
    setCreateError(null)
    setCreateOpen(true)
  }

  const crear = async () => {
    if (!nombre.trim() || !correo.trim() || !pass) {
      setCreateError('Indica el nombre, el correo y la contraseña temporal.')
      return
    }
    setCreando(true)
    setCreateError(null)
    try {
      const user = await createEntraUser({
        displayName: nombre.trim(),
        mailNickname: correo.split('@')[0],
        userPrincipalName: correo.trim().toLowerCase(),
        password: pass,
        usageLocation: 'DO',
      })
      const list = await getDirectoryUsers(true)
      setUsers(list)
      onChange(user)
      setCreateOpen(false)
    } catch (e) {
      setCreateError(graphErrorMessage(e))
    } finally {
      setCreando(false)
    }
  }

  return (
    <>
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
            {hint ?? 'Obligatorio. La cuenta recibirá el rol correspondiente al guardar. Si la persona aún no tiene cuenta, créela aquí.'}
          </Text>
        )}
      </FormField>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '-2px' }}>
        <Button size="small" appearance="secondary" icon={<AddRegular />} onClick={abrirCrear} disabled={creando}>
          Crear cuenta nueva en Microsoft 365
        </Button>
        <a href="https://admin.cloud.microsoft/?source=applauncher#/users" target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--azul)' }}>
          Abrir Usuarios activos de Microsoft 365
        </a>
      </div>

      <ModalForm
        open={createOpen}
        onOpenChange={(o) => { if (!o) setCreateOpen(false) }}
        title="Crear cuenta en Microsoft 365"
        subtitle={`Se creará en «Usuarios activos» con el correo nombre.apellido@${M365_DOMAIN}.`}
        width={520}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setCreateOpen(false)} disabled={creando}>Cancelar</Button>
            <Button appearance="primary" icon={creando ? <Spinner size="tiny" /> : <AddRegular />} disabled={creando} onClick={() => void crear()}>
              {creando ? 'Creando…' : 'Crear y seleccionar'}
            </Button>
          </>
        }
      >
        <FormField label="Nombre completo" required>
          <Input value={nombre} onChange={(_, d) => { setNombre(d.value); setCorreo(sugerirCorreo(d.value)) }} placeholder="Nombre y apellidos" />
        </FormField>
        <FormField label="Correo (nombre.apellido@dominio)" required hint="Puedes ajustarlo si la sugerencia no es la correcta.">
          <Input value={correo} onChange={(_, d) => setCorreo(d.value)} placeholder={`nombre.apellido@${M365_DOMAIN}`} />
        </FormField>
        <FormField label="Contraseña temporal" required hint="El usuario deberá cambiarla al iniciar sesión. Compártela de forma segura.">
          <Input value={pass} onChange={(_, d) => setPass(d.value)} />
        </FormField>
        {createError && <Text size={200} block style={{ color: '#B42318' }}>{createError}</Text>}
        <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
          Requiere el permiso «User.ReadWrite.All» con consentimiento de administrador. Si falla, puedes crear la cuenta directamente en Usuarios activos de Microsoft 365.
        </Text>
      </ModalForm>
    </>
  )
}
