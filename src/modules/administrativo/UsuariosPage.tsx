import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Toolbar, ToolbarButton, useToastController } from '@fluentui/react-components'
import { EditRegular, ArrowSyncRegular, PersonAddRegular, LinkSquareRegular, SearchRegular } from '@fluentui/react-icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import { ROLE_LABELS, type Role } from '../../types/roles'
import { dataService } from '../../services/dataService'
import { listEntraUsers, type EntraUser } from '../../services/entraUsers'
import { graphErrorMessage } from '../../services/graph'
import type { User } from '../../types'

interface UserRow {
  id: string
  displayName: string
  email: string
  roles: Role[]
  teacherId?: string
  studentId?: string
  jobTitle?: string
  inDirectory: boolean
  registered: boolean
}

const ROLE_COLORS: Record<Role, string> = {
  docente: '#0095C8',
  estudiante: '#C8102E',
  padre: '#15803D',
  admin: '#6B21A8',
  psicologia: '#AD1457',
  tecnologia: '#161616',
}

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

export function UsuariosPage() {
  const toaster = useToastController()
  const { users, students, teachers, refreshCatalogs, user: me } = useApp()

  const [entraUsers, setEntraUsers] = useState<EntraUser[]>([])
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [formRoles, setFormRoles] = useState<Role[]>([])
  const [formTeacher, setFormTeacher] = useState('')
  const [formStudent, setFormStudent] = useState('')
  const [saving, setSaving] = useState(false)

  const syncEntra = async (silent = false) => {
    setSyncing(true)
    try {
      const list = await listEntraUsers()
      setEntraUsers(list)
      if (!silent) toaster.dispatchToast(`${list.length} usuarios leídos desde Entra ID`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo leer el directorio: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    void syncEntra(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows: UserRow[] = useMemo(() => {
    const map = new Map<string, UserRow>()
    for (const u of users) {
      map.set(u.id, { id: u.id, displayName: u.displayName, email: u.email, roles: u.roles, teacherId: u.teacherId, studentId: u.studentId, jobTitle: u.jobTitle, inDirectory: false, registered: true })
    }
    for (const e of entraUsers) {
      const email = (e.mail ?? e.userPrincipalName ?? '').toLowerCase()
      const existing = map.get(e.id) ?? [...map.values()].find((r) => sameEmail(r.email, email))
      if (existing) {
        existing.inDirectory = true
        if (!existing.jobTitle && e.jobTitle) existing.jobTitle = e.jobTitle
      } else {
        map.set(e.id, { id: e.id, displayName: e.displayName ?? email, email, roles: [], jobTitle: e.jobTitle ?? undefined, inDirectory: true, registered: false })
      }
    }
    const q = query.trim().toLowerCase()
    return [...map.values()]
      .filter((r) => !q || r.displayName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [users, entraUsers, query])

  const openEdit = (row: UserRow) => {
    setEditing(row)
    setFormRoles(row.roles)
    setFormTeacher(row.teacherId ?? '')
    setFormStudent(row.studentId ?? '')
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const roles = new Set<Role>(formRoles)
      if (formTeacher) roles.add('docente')
      if (formStudent) roles.add('estudiante')
      const record: User = {
        id: editing.id,
        displayName: editing.displayName,
        email: editing.email,
        jobTitle: editing.jobTitle,
        roles: [...roles],
        teacherId: formTeacher || undefined,
        studentId: formStudent || undefined,
        updatedAt: new Date().toISOString(),
      }
      await dataService.saveUser(record)
      await refreshCatalogs()
      toaster.dispatchToast(`Roles guardados para ${editing.displayName}`, { intent: 'success' })
      setEditing(null)
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (r: Role) => {
    setFormRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  return (
    <div>
      <PageHeader
        title="Usuarios y roles"
        subtitle="Los usuarios se crean en Microsoft Entra ID (directorio institucional). Aquí se les asignan los roles de acceso a los portales y se vinculan con su ficha de docente o estudiante."
        actions={
          <>
            <Button appearance="primary" icon={syncing ? <Spinner size="tiny" /> : <ArrowSyncRegular />} onClick={() => void syncEntra()} disabled={syncing}>
              {syncing ? 'Leyendo directorio…' : 'Actualizar desde Entra ID'}
            </Button>
            <Button
              appearance="outline"
              icon={<PersonAddRegular />}
              onClick={() => window.open('https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade/~/AllUsers', '_blank', 'noopener')}
            >
              Crear usuario en Entra
            </Button>
          </>
        }
      />

      <div style={{ marginBottom: '12px', maxWidth: '360px' }}>
        <Input contentBefore={<SearchRegular />} placeholder="Buscar por nombre o correo…" value={query} onChange={(_, d) => setQuery(d.value)} />
      </div>

      <Table aria-label="Usuarios">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Usuario</TableHeaderCell>
            <TableHeaderCell>Correo</TableHeaderCell>
            <TableHeaderCell>Roles</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>Acciones</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Text weight="semibold" block>{row.displayName}{row.id === me?.id ? ' (usted)' : ''}</Text>
                {row.jobTitle && <Text size={200} style={{ color: 'var(--texto-suave)' }}>{row.jobTitle}</Text>}
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
                <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {row.inDirectory ? <Badge appearance="tint" color="success">Entra ID</Badge> : <Badge appearance="tint" color="warning">No está en el directorio</Badge>}
                  {row.registered && <Badge appearance="tint" color="brand">Ha iniciado sesión</Badge>}
                </span>
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
      {rows.length === 0 && !syncing && (
        <Text size={300} block style={{ marginTop: '12px', color: 'var(--texto-suave)' }}>
          No se encontraron usuarios. Pulse “Actualizar desde Entra ID” o cree los usuarios en el directorio.
        </Text>
      )}

      <ModalForm
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={`Roles · ${editing?.displayName ?? ''}`}
        subtitle="Asignación de roles de acceso a los portales"
        actions={
          <>
            <Button appearance="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button appearance="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar roles'}</Button>
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
        <Text size={200} block style={{ color: 'var(--texto-suave)' }}>
          <LinkSquareRegular /> Los roles se guardan en la lista <code>ARC_Users</code> de SharePoint y se aplican en el próximo inicio de sesión del usuario. Los docentes cuyo correo coincide con su ficha en “Personas” reciben el rol Docente automáticamente; los tutores registrados reciben el rol Padre / Tutor.
        </Text>
      </ModalForm>
    </div>
  )
}
