import { useMemo, useState } from 'react'
import { Button, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController, Badge } from '@fluentui/react-components'
import { EditRegular, ArrowSyncRegular, PersonAddRegular, LinkSquareRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { ROLE_LABELS, type Role } from '../../types/roles'
import { useLocalList } from '../../hooks/useLocalList'
import { listEntraUsers, type EntraUser } from '../../services/entraUsers'

interface RoleAssignment {
  id: string
  userId: string
  roles: Role[]
  teacherId?: string
  studentId?: string
}

interface UserRow {
  id: string
  displayName: string
  email: string
  roles: Role[]
  source: 'demo' | 'entra'
}

const ROLE_COLORS: Record<Role, string> = {
  docente: '#103F7E',
  estudiante: '#C62828',
  padre: '#15803D',
  admin: '#6B21A8',
}

export function UsuariosPage() {
  const toaster = useToastController()
  const { users: demoUsers, mode, students, teachers } = useApp()
  const assignments = useLocalList<RoleAssignment>('arca_role_assignments')

  const [entraUsers, setEntraUsers] = useState<EntraUser[]>([])
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [formRoles, setFormRoles] = useState<Role[]>([])
  const [formTeacher, setFormTeacher] = useState('')
  const [formStudent, setFormStudent] = useState('')

  const rows: UserRow[] = useMemo(() => {
    const base = demoUsers.map((u): UserRow => ({ id: u.id, displayName: u.displayName, email: u.email, roles: u.roles, source: 'demo' }))
    for (const e of entraUsers) {
      if (!base.some((b) => b.email === (e.mail ?? e.userPrincipalName))) {
        base.push({ id: e.id, displayName: e.displayName ?? '—', email: e.mail ?? e.userPrincipalName ?? '', roles: [], source: 'entra' })
      }
    }
    return base.map((row) => {
      const a = assignments.items.find((x) => x.userId === row.id)
      return a ? { ...row, roles: a.roles } : row
    })
  }, [demoUsers, entraUsers, assignments.items])

  const syncEntra = async () => {
    setSyncing(true)
    try {
      const list = await listEntraUsers()
      setEntraUsers(list)
      toaster.dispatchToast(`${list.length} usuarios sincronizados desde Entra ID`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo sincronizar: ${error instanceof Error ? error.message : 'error'}`, { intent: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const openEdit = (row: UserRow) => {
    const a = assignments.items.find((x) => x.userId === row.id)
    setEditing(row)
    setFormRoles(a?.roles ?? row.roles)
    setFormTeacher(a?.teacherId ?? '')
    setFormStudent(a?.studentId ?? '')
  }

  const save = () => {
    if (!editing) return
    assignments.add({ id: `${editing.id}-roles`, userId: editing.id, roles: formRoles, teacherId: formTeacher, studentId: formStudent })
    toaster.dispatchToast(`Roles asignados a ${editing.displayName}`, { intent: 'success' })
    setEditing(null)
  }

  const toggleRole = (r: Role) => {
    setFormRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  const addLocalUser = () => {
    window.alert('En modo demostración los usuarios se definen en el código (seed). En producción, cree los usuarios en el centro de administración de Microsoft Entra ID y luego pulse “Sincronizar desde Entra ID”.')
  }

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Los usuarios se administran desde Microsoft Entra ID (directorio institucional). Aquí los sincroniza y les asigna los roles del sistema."
        actions={
          <>
            {mode === 'm365' && (
              <>
                <Button appearance="primary" icon={<ArrowSyncRegular />} onClick={() => void syncEntra()} disabled={syncing}>
                  {syncing ? 'Sincronizando…' : 'Sincronizar desde Entra ID'}
                </Button>
                <Button
                  appearance="outline"
                  icon={<PersonAddRegular />}
                  onClick={() => window.open('https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade/~/AllUsers', '_blank')}
                >
                  Crear usuario en Entra
                </Button>
              </>
            )}
            {mode === 'demo' && (
              <Button appearance="outline" icon={<PersonAddRegular />} onClick={addLocalUser}>
                Añadir usuario demo
              </Button>
            )}
          </>
        }
      />

      {mode === 'demo' && (
        <Text size={300} block style={{ marginBottom: '12px', color: 'var(--texto-suave)' }}>
          Modo demostración: se muestran usuarios de ejemplo. En producción, pulse “Sincronizar desde Entra ID” para traer los usuarios del directorio institucional.
        </Text>
      )}

      <Table aria-label="Usuarios">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Usuario</TableHeaderCell>
            <TableHeaderCell>Correo</TableHeaderCell>
            <TableHeaderCell>Roles</TableHeaderCell>
            <TableHeaderCell>Origen</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Text weight="semibold">{row.displayName}</Text>
              </TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {row.roles.length === 0 && <Text size={200} style={{ color: 'var(--texto-suave)' }}>Sin rol</Text>}
                  {row.roles.map((r) => (
                    <Badge key={r} appearance="filled" color="informative" style={{ background: ROLE_COLORS[r] }}>
                      {ROLE_LABELS[r]}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              <TableCell>
                <Badge appearance="tint" color={row.source === 'entra' ? 'success' : 'warning'}>
                  {row.source === 'entra' ? 'Entra ID' : 'Demo'}
                </Badge>
              </TableCell>
              <TableCell>
                <Toolbar size="small">
                  <ToolbarButton icon={<EditRegular />} onClick={() => openEdit(row)}>Asignar roles</ToolbarButton>
                </Toolbar>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={`Roles · ${editing?.displayName ?? ''}`}
        subtitle="Asignación de roles de acceso a los portales"
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button appearance="primary" onClick={save}>Guardar roles</Button>
          </>
        }
      >
        <FormField label="Roles de acceso">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <Button
                key={r}
                size="small"
                appearance={formRoles.includes(r) ? 'primary' : 'secondary'}
                onClick={() => toggleRole(r)}
              >
                {ROLE_LABELS[r]}
              </Button>
            ))}
          </div>
        </FormField>
        <FormField label="Vincular a docente (si aplica)">
          <Select value={formTeacher} onChange={(_, d) => setFormTeacher(d.value)}>
            <option value="">Sin vincular</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.fullName}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Vincular a estudiante (si aplica)">
          <Select value={formStudent} onChange={(_, d) => setFormStudent(d.value)}>
            <option value="">Sin vincular</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </Select>
        </FormField>
        {mode === 'm365' && (
          <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
            <LinkSquareRegular /> En producción, la creación de usuarios se realiza en el centro de administración de Microsoft Entra ID; aquí solo se asignan roles.
          </Text>
        )}
      </ModalForm>
    </div>
  )
}
