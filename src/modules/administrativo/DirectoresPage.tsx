import { useMemo } from 'react'
import { Input, Text, makeStyles, useToastController } from '@fluentui/react-components'
import { PageHeader } from '../../components/shared/PageHeader'
import { EntityCrud, type CrudColumn } from '../../components/shared/EntityCrud'
import { FormField } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { EntraUserPicker } from '../../components/shared/EntraUserPicker'
import { entraEmail, getDirectoryUsers, linkUserRole, unlinkUserRole } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'
import type { Persona } from '../../types'
import { genId } from '../../utils/helpers'

const useStyles = makeStyles({
  hint: { marginBottom: '16px', color: 'var(--texto-suave)', fontSize: '13px' },
})

export function DirectoresPage() {
  const styles = useStyles()
  const toaster = useToastController()
  const personasCol = useCollection<Persona>(dataService.getPersonas, dataService.savePersona, dataService.deletePersona)

  const directores = useMemo(() => personasCol.items.filter((p) => p.tipo === 'director'), [personasCol.items])
  const takenUsers = directores.map((p) => p.userId ?? '').filter(Boolean)

  const requireAccount = async (userId: string | undefined) => {
    if (!userId) {
      toaster.dispatchToast('Seleccione la cuenta de Microsoft 365 del director: es obligatoria.', { intent: 'error' })
      throw new Error('Cuenta requerida')
    }
    const account = (await getDirectoryUsers()).find((u) => u.id === userId)
    if (!account) {
      toaster.dispatchToast('La cuenta seleccionada ya no existe en el directorio.', { intent: 'error' })
      throw new Error('Cuenta no encontrada')
    }
    return account
  }

  const saveDirector = async (p: Persona) => {
    if (!p.fullName.trim()) {
      toaster.dispatchToast('Complete el nombre del director.', { intent: 'error' })
      throw new Error('Datos incompletos')
    }
    const account = await requireAccount(p.userId)
    try {
      const previous = personasCol.items.find((x) => x.id === p.id)
      if (previous?.userId && previous.userId !== account.id) await unlinkUserRole(previous.userId, 'admin')
      await linkUserRole(account, 'admin')
      await personasCol.save({ ...p, tipo: 'director', email: entraEmail(account), createdAt: p.createdAt ?? new Date().toISOString() })
      toaster.dispatchToast(`Director guardado y cuenta ${entraEmail(account)} vinculada con rol Administrativo`, { intent: 'success' })
    } catch (error) {
      toaster.dispatchToast(`No se pudo guardar: ${graphErrorMessage(error)}`, { intent: 'error' })
      throw error
    }
  }

  const deleteDirector = async (id: string) => {
    const d = personasCol.items.find((x) => x.id === id)
    await unlinkUserRole(d?.userId, 'admin')
    await personasCol.remove(id)
  }

  const columns: CrudColumn<Persona>[] = [
    { header: 'Director', render: (p) => <Text weight="semibold">{p.fullName}</Text> },
    { header: 'Correo', render: (p) => p.email || '—' },
    { header: 'Cuenta M365', render: (p) => p.email ? 'Vinculada' : <Text size={200} style={{ color: '#B42318' }}>Sin vincular</Text> },
  ]

  return (
    <div>
      <PageHeader
        title="Directores"
        subtitle="Registro de la dirección del centro educativo (rol Administrativo). Cada director se vincula a una cuenta de Microsoft 365."
      />
      <Text size={200} className={styles.hint} block>Añada aquí a los directores para darles acceso al portal Administrativo / Dirección.</Text>
      <EntityCrud<Persona>
        title="Directores"
        items={directores}
        loading={personasCol.loading}
        columns={columns}
        searchText={(p) => `${p.fullName} ${p.email}`}
        newLabel="Registrar director"
        createDefault={() => ({ id: genId('p'), fullName: '', email: '', userId: undefined, tipo: 'director', createdAt: new Date().toISOString() })}
        renderForm={(p, set) => (
          <div>
            <FormField label="Nombre completo" required>
              <Input value={p.fullName} onChange={(_, d) => set({ ...p, fullName: d.value })} />
            </FormField>
            <EntraUserPicker
              value={p.userId}
              takenIds={takenUsers}
              onChange={(u) => set({ ...p, userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? p.fullName })}
              hint="Obligatorio. La cuenta recibirá el rol Administrativo (Dirección)."
            />
          </div>
        )}
        onSave={saveDirector}
        onDelete={deleteDirector}
        emptyMessage="Registre a los directores del centro."
      />
    </div>
  )
}
