import { useMemo, useState } from 'react'
import { Badge, Button, Input, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { AddRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { PORTALS } from '../../portals/portals'
import { ROLE_LABELS, type Role } from '../../types/roles'
import { dataService } from '../../services/dataService'
import { graphErrorMessage } from '../../services/graph'
import type { RoleMeta } from '../../types'
import { RoleBadge } from './UsuariosPage'

const DEFAULT_DESCRIPTIONS: Record<Role, string> = {
  docente: 'Acceso al portal docente: planificación, clases, asistencia, aulas y encuentros.',
  estudiante: 'Acceso al campus virtual: clases, actividades, calificaciones y asistencia.',
  padre: 'Acceso al portal de familias: progreso académico, asistencia y comunicaciones.',
  admin: 'Acceso al portal administrativo: dirección, admisiones, académico y catálogos.',
  psicologia: 'Acceso al portal de Psicología y Orientación: ventanilla, casos de seguimiento y talleres.',
  tecnologia: 'Acceso al portal de Tecnología: personas, cuentas de Microsoft 365, usuarios y roles.',
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

export function RolesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { users, roleMeta, roleLabel, refreshCatalogs } = useApp()

  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [portal, setPortal] = useState<Role>('docente')
  const [saving, setSaving] = useState(false)

  const baseRoles = Object.keys(ROLE_LABELS) as Role[]
  const customRoles = useMemo(() => roleMeta.filter((m) => m.custom && !(m.id in ROLE_LABELS)), [roleMeta])

  /** Conteo de usuarios por rol, consistente con la lista real ARC_Users (RM-003). */
  const countByRole = useMemo(() => {
    const map = new Map<string, { count: number; names: string[] }>()
    for (const u of users) {
      for (const r of u.roles) {
        const entry = map.get(r) ?? { count: 0, names: [] }
        entry.count++
        if (entry.names.length < 6) entry.names.push(u.displayName)
        map.set(r, entry)
      }
    }
    return map
  }, [users])

  const openEditBase = (r: Role) => {
    const m = roleMeta.find((x) => x.id === r)
    setEditing({ id: r, isNew: false })
    setLabel(m?.label ?? ROLE_LABELS[r])
    setDescription(m?.description ?? DEFAULT_DESCRIPTIONS[r])
    setPortal(r)
  }

  const openEditCustom = (m: RoleMeta) => {
    setEditing({ id: m.id, isNew: false })
    setLabel(m.label ?? m.id)
    setDescription(m.description ?? '')
    setPortal((m.portal as Role) ?? 'docente')
  }

  const openNew = () => {
    setEditing({ id: '', isNew: true })
    setLabel('')
    setDescription('')
    setPortal('docente')
  }

  const save = async () => {
    if (!editing) return
    const cleanLabel = label.trim()
    if (!cleanLabel) {
      toaster.dispatchToast('Indique el nombre del rol.', { intent: 'error' })
      return
    }
    const isBase = !editing.isNew && editing.id in ROLE_LABELS
    const id = editing.isNew ? `rol-${slugify(cleanLabel)}` : editing.id
    if (editing.isNew && (id === 'rol-' || baseRoles.includes(id as Role) || roleMeta.some((m) => m.id === id))) {
      toaster.dispatchToast('Ya existe un rol con un nombre equivalente.', { intent: 'error' })
      return
    }
    setSaving(true)
    try {
      const record: RoleMeta = isBase
        ? { id, label: cleanLabel, description }
        : { id, label: cleanLabel, description, portal, custom: true }
      await dataService.saveRoleMeta(record)
      await refreshCatalogs()
      toaster.dispatchToast(editing.isNew ? `Rol "${cleanLabel}" creado` : 'Rol actualizado', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const removeCustom = async (m: RoleMeta) => {
    const affected = users.filter((u) => u.roles.includes(m.id as Role))
    const message = affected.length
      ? `El rol "${roleLabel(m.id)}" está asignado a ${affected.length} usuario(s); se les retirará. ¿Eliminar?`
      : `¿Eliminar el rol "${roleLabel(m.id)}"?`
    if (!window.confirm(message)) return
    try {
      // RM-003: sincronización — al eliminar el rol se retira de todos los usuarios.
      for (const u of affected) {
        await dataService.saveUser({ ...u, roles: u.roles.filter((r) => r !== m.id), updatedAt: new Date().toISOString() })
      }
      await dataService.deleteRoleMeta(m.id)
      await refreshCatalogs()
      toaster.dispatchToast('Rol eliminado y usuarios actualizados', { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo eliminar: ${graphErrorMessage(error)}`, { intent: 'error' })
    }
  }

  const renderRow = (id: string, portalTitle: string, desc: string, custom?: RoleMeta) => {
    const stats = countByRole.get(id)
    return (
      <TableRow key={id}>
        <TableCell><RoleBadge roleId={id} label={roleLabel(id)} /></TableCell>
        <TableCell>{portalTitle}</TableCell>
        <TableCell>{desc}</TableCell>
        <TableCell>
          <Text weight="semibold">{stats?.count ?? 0}</Text>
          {stats && stats.names.length > 0 && (
            <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
              {stats.names.join(', ')}{stats.count > stats.names.length ? '…' : ''}
            </Text>
          )}
        </TableCell>
        <TableCell>
          <Toolbar size="small">
            <ToolbarButton icon={<EditRegular />} onClick={() => (custom ? openEditCustom(custom) : openEditBase(id as Role))}>Editar</ToolbarButton>
            {custom && <ToolbarButton icon={<DeleteRegular />} onClick={() => void removeCustom(custom)}>Eliminar</ToolbarButton>}
          </Toolbar>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div>
      <PageHeader
        title="Mantenimiento de roles"
        subtitle="Roles del sistema y roles personalizados. Cada rol personalizado da acceso al portal que usted elija; los cambios de nombre se reflejan en todo el sistema."
        actions={<Button appearance="primary" icon={<AddRegular />} onClick={openNew}>Nuevo rol</Button>}
      />

      <Table aria-label="Roles">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Rol</TableHeaderCell>
            <TableHeaderCell>Portal de acceso</TableHeaderCell>
            <TableHeaderCell>Descripción</TableHeaderCell>
            <TableHeaderCell>Usuarios</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {baseRoles.map((r) => {
            const m = roleMeta.find((x) => x.id === r)
            return renderRow(r, PORTALS.find((p) => p.role === r)?.title ?? '—', m?.description ?? DEFAULT_DESCRIPTIONS[r])
          })}
          {customRoles.map((m) =>
            renderRow(m.id, `${PORTALS.find((p) => p.role === m.portal)?.title ?? '—'} (personalizado)`, m.description ?? '', m),
          )}
        </TableBody>
      </Table>

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={editing?.isNew ? 'Nuevo rol' : `Editar rol · ${editing ? roleLabel(editing.id) : ''}`}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        <FieldRow>
          <FormField label="Nombre del rol" required>
            <Input value={label} onChange={(_, d) => setLabel(d.value)} placeholder="Ej. Coordinación Pedagógica" />
          </FormField>
          {(editing?.isNew || !(editing?.id ?? '') || !((editing?.id ?? '') in ROLE_LABELS)) && (
            <FormField label="Portal al que da acceso" required>
              <Select value={portal} onChange={(_, d) => setPortal(d.value as Role)}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>{PORTALS.find((p) => p.role === r)?.title ?? ROLE_LABELS[r]}</option>
                ))}
              </Select>
            </FormField>
          )}
        </FieldRow>
        <FormField label="Descripción">
          <Input value={description} onChange={(_, d) => setDescription(d.value)} />
        </FormField>
        <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
          El nombre se aplica en Usuarios y roles, en los distintivos y en los filtros. Los roles del sistema no pueden eliminarse; los personalizados sí (se retiran automáticamente de los usuarios que los tengan).
        </Text>
      </ModalForm>

      <div className={styles.summary}>
        <Badge appearance="tint" color="informative">{baseRoles.length} roles del sistema</Badge>
        <Badge appearance="tint" color="brand">{customRoles.length} personalizados</Badge>
        <Badge appearance="tint" color="success">{users.filter((u) => u.roles.length > 0).length} usuarios con acceso</Badge>
      </div>
    </div>
  )
}

const useStyles = makeStyles({
  summary: { marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' },
})
