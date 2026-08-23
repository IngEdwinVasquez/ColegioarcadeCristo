import { useMemo, useState } from 'react'
import { Badge, Button, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, makeStyles } from '@fluentui/react-components'
import { EditRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { PORTALS } from '../../portals/portals'
import { ROLE_LABELS } from '../../types/roles'
import type { Role } from '../../types/roles'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import type { RoleMeta } from '../../types'

const DEFAULT_DESCRIPTIONS: Record<Role, string> = {
  docente: 'Acceso al portal docente: planificación, clases, asistencia, aulas y encuentros.',
  estudiante: 'Acceso al campus virtual: clases, actividades, calificaciones y asistencia.',
  padre: 'Acceso al portal de familias: progreso académico, asistencia y comunicaciones.',
  admin: 'Acceso al portal administrativo: dirección, admisiones, académico y catálogos.',
  psicologia: 'Acceso al portal de Psicología y Orientación: ventanilla, casos de seguimiento y talleres.',
  tecnologia: 'Acceso al portal de Tecnología: personas, cuentas de Microsoft 365, usuarios y roles.',
}

const ROLE_COLORS: Record<Role, string> = {
  docente: '#0095C8',
  estudiante: '#C8102E',
  padre: '#15803D',
  admin: '#6B21A8',
  psicologia: '#AD1457',
  tecnologia: '#161616',
}

export function RolesPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const { users } = useApp()
  const meta = useCollection<RoleMeta>(dataService.getRoleMeta, dataService.saveRoleMeta)

  const [editing, setEditing] = useState<Role | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  const roles = useMemo(() => (Object.keys(ROLE_LABELS) as Role[]), [])

  const usersByRole = useMemo(() => {
    const map = new Map<Role, string[]>()
    for (const r of roles) map.set(r, [])
    for (const u of users) {
      for (const r of u.roles) {
        const list = map.get(r)
        if (list && !list.includes(u.displayName)) list.push(u.displayName)
      }
    }
    return map
  }, [users, roles])

  const openEdit = (r: Role) => {
    const m = meta.items.find((x) => x.id === r)
    setEditing(r)
    setLabel(m?.label ?? ROLE_LABELS[r])
    setDescription(m?.description ?? DEFAULT_DESCRIPTIONS[r])
  }

  const save = async () => {
    if (!editing) return
    try {
      await meta.save({ id: editing, label: label.trim() || ROLE_LABELS[editing], description })
      toaster.dispatchToast('Rol actualizado', { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Mantenimiento de roles"
        subtitle="Defina los roles de acceso del sistema y revise qué usuarios los tienen asignados. La creación de usuarios se realiza en Microsoft Entra ID."
      />

      <Table aria-label="Roles">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Rol</TableHeaderCell>
            <TableHeaderCell>Portal</TableHeaderCell>
            <TableHeaderCell>Descripción</TableHeaderCell>
            <TableHeaderCell>Usuarios</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => {
            const m = meta.items.find((x) => x.id === r)
            return (
              <TableRow key={r}>
                <TableCell>
                  <Badge appearance="filled" style={{ background: ROLE_COLORS[r], color: '#fff' }}>
                    {m?.label ?? ROLE_LABELS[r]}
                  </Badge>
                </TableCell>
                <TableCell>{PORTALS.find((p) => p.role === r)?.title ?? '—'}</TableCell>
                <TableCell>{m?.description ?? DEFAULT_DESCRIPTIONS[r]}</TableCell>
                <TableCell>
                  <Toolbar size="small">
                    <ToolbarButton icon={<EditRegular />} onClick={() => openEdit(r)}>Editar</ToolbarButton>
                  </Toolbar>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className={styles.summary}>
        <Text weight="semibold" size={400}>Usuarios por rol</Text>
        {roles.map((r) => (
          <div key={r} className={styles.roleGroup}>
            <Badge appearance="filled" style={{ background: ROLE_COLORS[r], color: '#fff' }}>{ROLE_LABELS[r]}</Badge>
            <Text size={300} style={{ color: 'var(--texto-suave)' }}>
              {usersByRole.get(r)?.length ?? 0} usuario(s) · {usersByRole.get(r)?.join(', ') || 'Sin asignaciones'}
            </Text>
          </div>
        ))}
      </div>

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={`Editar rol · ${editing ?? ''}`}
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void save()}>Guardar</Button>
          </>
        }
      >
        <FormField label="Nombre del rol">
          <Input value={label} onChange={(_, d) => setLabel(d.value)} />
        </FormField>
        <FormField label="Descripción">
          <Input value={description} onChange={(_, d) => setDescription(d.value)} />
        </FormField>
        <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
          La asignación de roles a usuarios se realiza en el módulo “Usuarios y roles” del portal de Tecnología.
        </Text>
      </ModalForm>
    </div>
  )
}

const useStyles = makeStyles({
  summary: { marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '10px' },
  roleGroup: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
})
