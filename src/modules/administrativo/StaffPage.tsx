import { useMemo, useState } from 'react'
import { Input, Select, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField, FieldRow } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { EntraUserPicker } from '../../components/shared/EntraUserPicker'
import { entraEmail, getDirectoryUsers, linkUserRole, unlinkUserRole } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'
import type { Persona, PersonaTipo } from '../../types'
import { genId } from '../../utils/helpers'
import type { Role } from '../../types/roles'

const useStyles = makeStyles({
  hint: { marginBottom: '16px', color: 'var(--texto-suave)', fontSize: '13px' },
})

export const STAFF_TIPOS: Record<string, { label: string; tipo: PersonaTipo; rol: Role; plural: string; desc: string }> = {
  directores: { label: 'Director', tipo: 'director', rol: 'admin', plural: 'Directores', desc: 'Registro de la dirección del centro educativo (rol Administrativo).' },
  administradores: { label: 'Administrador', tipo: 'administrador', rol: 'admin', plural: 'Administradores', desc: 'Personal de administración del centro (rol Administrativo).' },
  siger: { label: 'SIGER', tipo: 'siger', rol: 'admin', plural: 'SIGER', desc: 'Personal responsable del sistema SIGER (rol Administrativo).' },
  apoyo: { label: 'Personal de apoyo', tipo: 'apoyo', rol: 'admin', plural: 'Personal de apoyo', desc: 'Personal de apoyo institucional (rol Administrativo).' },
}

/** Página genérica de personal institucional, parametrizada por tipo. */
export function StaffPage({ kind }: { kind: keyof typeof STAFF_TIPOS }) {
  const styles = useStyles()
  const toaster = useToastController()
  const cfg = STAFF_TIPOS[kind]
  const personasCol = useCollection<Persona>(dataService.getPersonas, dataService.savePersona, dataService.deletePersona)

  const items = useMemo(() => personasCol.items.filter((p) => p.tipo === cfg.tipo), [personasCol.items, cfg.tipo])
  const takenUsers = items.map((p) => p.userId ?? '').filter(Boolean)

  const [tipoFilter, setTipoFilter] = useState(cfg.tipo)

  const requireAccount = async (userId: string | undefined) => {
    if (!userId) {
      toaster.dispatchToast(`Seleccione la cuenta de Microsoft 365 del ${cfg.label.toLowerCase()}.`, { intent: 'error' })
      throw new Error('Cuenta requerida')
    }
    const account = (await getDirectoryUsers()).find((u) => u.id === userId)
    if (!account) {
      toaster.dispatchToast('La cuenta seleccionada ya no existe en el directorio.', { intent: 'error' })
      throw new Error('Cuenta no encontrada')
    }
    return account
  }

  const saveItem = async (p: Persona) => {
    if (!p.fullName.trim()) {
      toaster.dispatchToast('Complete el nombre.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(p.userId)
    try {
      const previous = personasCol.items.find((x) => x.id === p.id)
      if (previous?.userId && previous.userId !== account.id) {
        const prevTipo = STAFF_TIPOS[Object.keys(STAFF_TIPOS).find((k) => STAFF_TIPOS[k].tipo === previous.tipo) as keyof typeof STAFF_TIPOS]
        await unlinkUserRole(previous.userId, prevTipo?.rol ?? 'admin')
      }
      await linkUserRole(account, cfg.rol)
      await personasCol.save({ ...p, tipo: tipoFilter, email: entraEmail(account), createdAt: p.createdAt ?? new Date().toISOString() })
      toaster.dispatchToast(`${cfg.label} guardado y cuenta ${entraEmail(account)} vinculada con rol ${cfg.rol}`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
      throw error
    }
  }

  const deleteItem = async (id: string) => {
    const d = personasCol.items.find((x) => x.id === id)
    await unlinkUserRole(d?.userId, cfg.rol)
    await personasCol.remove(id)
  }

  const columns: CrudColumn<Persona>[] = [
    { header: cfg.label, render: (p) => <Text weight="semibold">{p.fullName}</Text> },
    { header: 'Correo', render: (p) => p.email || '—' },
    { header: 'Cuenta M365', render: (p) => p.email ? 'Vinculada' : <Text size={200} style={{ color: '#B42318' }}>Sin vincular</Text> },
  ]

  return (
    <div>
      <PageHeader title={cfg.plural} subtitle={cfg.desc} />
      <Text size={200} className={styles.hint} block>Añada aquí al personal {cfg.plural.toLowerCase()}. Cada uno se vincula a una cuenta de Microsoft 365 y recibe el rol correspondiente.</Text>
      <EntityCrud<Persona>
        title={cfg.plural}
        items={items}
        loading={personasCol.loading}
        columns={columns}
        searchText={(p) => `${p.fullName} ${p.email}`}
        newLabel={`Registrar ${cfg.label.toLowerCase()}`}
        createDefault={() => ({ id: genId('p'), fullName: '', email: '', userId: undefined, tipo: cfg.tipo, createdAt: new Date().toISOString() })}
        renderForm={(p, set) => (
          <div>
            <FormField label="Nombre completo" required>
              <Input value={p.fullName} onChange={(_, d) => set({ ...p, fullName: d.value })} />
            </FormField>
            <EntraUserPicker
              value={p.userId}
              takenIds={takenUsers}
              onChange={(u) => set({ ...p, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? p.fullName })}
              hint={`Obligatorio. La cuenta recibirá el rol ${cfg.rol === 'admin' ? 'Administrativo' : cfg.rol}.`}
            />
            <FieldRow>
              <FormField label="Tipo">
                <Select value={tipoFilter} onChange={(_, d) => setTipoFilter(d.value as PersonaTipo)}>
                  {(Object.keys(STAFF_TIPOS) as Array<keyof typeof STAFF_TIPOS>).map((k) => (<option key={k} value={STAFF_TIPOS[k].tipo}>{STAFF_TIPOS[k].label}</option>))}
                </Select>
              </FormField>
            </FieldRow>
          </div>
        )}
        onSave={saveItem}
        onDelete={deleteItem}
        emptyMessage={`Registre al personal de ${cfg.plural.toLowerCase()}.`}
      />
    </div>
  )
}
