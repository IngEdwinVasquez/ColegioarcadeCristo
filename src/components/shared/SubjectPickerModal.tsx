import { useMemo, useState } from 'react'
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Input, Spinner, Text, useToastController } from '@fluentui/react-components'
import { AddRegular, CheckmarkCircleRegular, DeleteRegular, SearchRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId } from '../../utils/helpers'
import { graphErrorMessage } from '../../services/graph'
import type { GradeSection, Subject, TeacherAssignment } from '../../types'

/** Normaliza un nombre para comparar asignaturas sin acentos ni mayúsculas. */
const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

const COLORS = ['#0082AD', '#2AA9D8', '#0A7C66', '#B45309', '#7C3AED', '#BE123C', '#15803D', '#4338CA']

/**
 * Selector de asignaturas en ventana emergente: lista filtrable, crea nuevas y
 * permite eliminar solo las que NO tienen docente asignado.
 */
export function SubjectPickerModal({ open, onClose, selectedName, onPick }: {
  open: boolean
  onClose: () => void
  selectedName?: string
  onPick: (name: string) => void
}) {
  const toaster = useToastController()
  const { subjects, teachers, refreshCatalogs } = useApp()
  const assignmentsCol = useCollection<TeacherAssignment>(dataService.getTeacherAssignments)
  const gradesCol = useCollection<GradeSection>(dataService.getGrades)
  const [query, setQuery] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [busy, setBusy] = useState(false)

  /** Ids de asignaturas con docente asignado (no se pueden eliminar). */
  const asignadas = useMemo(() => {
    const set = new Set<string>()
    for (const t of teachers) for (const sid of t.subjects ?? []) set.add(sid)
    for (const a of assignmentsCol.items) if (a.subjectId) set.add(a.subjectId)
    for (const g of gradesCol.items) {
      if (!g.leadTeacherId || !g.asignatura) continue
      const s = subjects.find((x) => norm(x.name) === norm(g.asignatura ?? ''))
      if (s) set.add(s.id)
    }
    return set
  }, [teachers, assignmentsCol.items, gradesCol.items, subjects])

  const filtradas = subjects
    .filter((s) => !query || norm(s.name).includes(norm(query)))
    .sort((a, b) => a.name.localeCompare(b.name))

  const crear = async () => {
    const nombre = nuevo.trim()
    if (!nombre) return
    if (subjects.some((s) => norm(s.name) === norm(nombre))) {
      toaster.dispatchToast('Esa asignatura ya existe.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      await dataService.saveSubject({ id: genId('sub'), name: nombre, shortName: nombre.slice(0, 16), color: COLORS[subjects.length % COLORS.length] })
      await refreshCatalogs()
      setNuevo('')
      onPick(nombre)
      toaster.dispatchToast(`Asignatura «${nombre}» creada.`, { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const eliminar = async (s: Subject) => {
    if (asignadas.has(s.id)) {
      toaster.dispatchToast('No se puede eliminar: la asignatura tiene docente asignado.', { intent: 'error' })
      return
    }
    if (!window.confirm(`¿Eliminar la asignatura «${s.name}»? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    try {
      await dataService.deleteSubject(s.id)
      await refreshCatalogs()
      toaster.dispatchToast('Asignatura eliminada.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose() }}>
      <DialogSurface style={{ maxWidth: 560 }}>
        <DialogBody>
          <DialogTitle>Asignaturas</DialogTitle>
          <DialogContent>
            <Input
              contentBefore={<SearchRegular />}
              placeholder="Filtrar asignatura…"
              value={query}
              onChange={(_, d) => setQuery(d.value)}
              style={{ marginBottom: '10px', width: '100%' }}
            />
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--borde)', borderRadius: '8px' }}>
              {filtradas.length === 0 ? (
                <Text size={200} block style={{ padding: '12px', color: 'var(--texto-suave)' }}>
                  {subjects.length === 0 ? 'No hay asignaturas registradas. Crea la primera abajo.' : 'Ninguna asignatura coincide con el filtro.'}
                </Text>
              ) : (
                filtradas.map((s) => {
                  const asignada = asignadas.has(s.id)
                  const actual = !!selectedName && norm(selectedName) === norm(s.name)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--borde)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color ?? '#0082AD', flex: '0 0 auto' }} />
                      <Text style={{ flex: 1 }} weight={actual ? 'semibold' : 'regular'}>{s.name}</Text>
                      {actual && <CheckmarkCircleRegular style={{ color: '#2E7D32' }} />}
                      <Button size="small" appearance={actual ? 'primary' : 'secondary'} disabled={busy} onClick={() => { onPick(s.name); onClose() }}>Elegir</Button>
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        disabled={busy || asignada}
                        title={asignada ? 'No se puede eliminar: tiene docente asignado' : 'Eliminar asignatura'}
                        onClick={() => void eliminar(s)}
                      />
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
              <Input
                placeholder="Nombre de la nueva asignatura"
                value={nuevo}
                onChange={(_, d) => setNuevo(d.value)}
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter') void crear() }}
              />
              <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <AddRegular />} disabled={busy || !nuevo.trim()} onClick={() => void crear()}>
                Crear nueva asignatura
              </Button>
            </div>
            <Text size={200} block style={{ marginTop: '6px', color: 'var(--texto-suave)' }}>
              Solo se pueden eliminar asignaturas sin docente asignado.
            </Text>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>Cerrar</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
