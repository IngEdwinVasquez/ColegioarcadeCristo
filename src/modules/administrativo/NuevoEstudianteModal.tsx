import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Spinner, useToastController } from '@fluentui/react-components'
import { SaveRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { EntraUserPicker } from '../../components/shared/EntraUserPicker'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { entraEmail, getDirectoryUsers, linkUserRole } from '../../services/userLinks'
import { graphErrorMessage } from '../../services/graph'
import { genId } from '../../utils/helpers'
import { cursoNombre, ordenarCursos } from '../../utils/academic'
import type { Student } from '../../types'

const vacio = (gradeId = ''): Student => ({
  id: genId('s'),
  fullName: '',
  email: '',
  userId: undefined,
  gradeId,
  parentName: '',
  parentEmail: '',
  birthDate: '',
})

/**
 * Alta de estudiante con todos sus datos: cuenta de Microsoft 365 (o creación de
 * una nueva con correo nombre.apellido@arcadecristo.edu.do), curso, nacimiento y tutor.
 */
export function NuevoEstudianteModal({ open, onClose, onSaved }: {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const toaster = useToastController()
  const { grades, refreshCatalogs } = useApp()
  const studentsCol = useCollection<Student>(dataService.getStudents, dataService.saveStudent)
  const [form, setForm] = useState<Student>(() => vacio())
  const [saving, setSaving] = useState(false)

  const cursos = useMemo(() => ordenarCursos(grades), [grades])
  const takenIds = useMemo(() => studentsCol.items.map((s) => s.userId ?? '').filter(Boolean), [studentsCol.items])

  useEffect(() => {
    if (open) setForm(vacio(cursos[0]?.id ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (patch: Partial<Student>) => setForm((f) => ({ ...f, ...patch }))

  const guardar = async () => {
    if (!form.fullName.trim()) { toaster.dispatchToast('Escriba el nombre completo del estudiante.', { intent: 'error' }); return }
    if (!form.userId) { toaster.dispatchToast('Seleccione o cree la cuenta de Microsoft 365 del estudiante.', { intent: 'error' }); return }
    if (!form.gradeId) { toaster.dispatchToast('Seleccione el grado / curso.', { intent: 'error' }); return }
    setSaving(true)
    try {
      const account = (await getDirectoryUsers()).find((u) => u.id === form.userId)
      if (!account) { toaster.dispatchToast('La cuenta de Microsoft 365 seleccionada ya no existe.', { intent: 'error' }); return }
      await linkUserRole(account, 'estudiante', { studentId: form.id })
      await studentsCol.save({ ...form, email: entraEmail(account) })
      await refreshCatalogs()
      toaster.dispatchToast(`Estudiante creado y cuenta ${entraEmail(account)} vinculada con rol Estudiante.`, { intent: 'success' })
      onSaved?.()
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Nuevo estudiante"
      subtitle="Registre al estudiante, vincule (o cree) su cuenta de Microsoft 365 y asígnele su curso."
      width={640}
      actions={
        <>
          <Button appearance="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button appearance="primary" icon={saving ? <Spinner size="tiny" /> : <SaveRegular />} disabled={saving} onClick={() => void guardar()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <FormField label="Nombre completo" required>
        <Input value={form.fullName} onChange={(_, d) => set({ fullName: d.value })} placeholder="Nombre y apellidos" />
      </FormField>
      <EntraUserPicker
        value={form.userId}
        defaultName={form.fullName}
        takenIds={takenIds}
        onChange={(u) => set({ userId: u?.id, email: u ? entraEmail(u) : '', fullName: u?.displayName ?? form.fullName })}
        hint="Obligatorio. La cuenta recibirá el rol Estudiante y verá su Campus Virtual. Si no tiene cuenta, créela aquí."
      />
      <FieldRow>
        <FormField label="Grado / Curso" required>
          <Select value={form.gradeId} onChange={(_, d) => set({ gradeId: d.value })}>
            <option value="">Selecciona el curso…</option>
            {cursos.map((g) => <option key={g.id} value={g.id}>{cursoNombre(g)}</option>)}
          </Select>
        </FormField>
        <FormField label="Fecha de nacimiento">
          <Input type="date" value={form.birthDate ?? ''} onChange={(_, d) => set({ birthDate: d.value })} />
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Padre / Tutor">
          <Input value={form.parentName ?? ''} onChange={(_, d) => set({ parentName: d.value })} />
        </FormField>
        <FormField label="Correo del padre / tutor">
          <Input value={form.parentEmail ?? ''} onChange={(_, d) => set({ parentEmail: d.value })} />
        </FormField>
      </FieldRow>
    </ModalForm>
  )
}
