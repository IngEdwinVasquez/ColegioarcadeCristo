import { useMemo, useState } from 'react'
import { Badge, Button, Input, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController } from '@fluentui/react-components'
import { CheckmarkCircleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId, todayIso } from '../../utils/helpers'
import type { AttendanceDayNote, AttendanceRecord, GradeSection } from '../../types'

/** Lista de días hábiles (lunes a viernes) entre dos fechas ISO (incluidas). */
function diasHabiles(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  while (d <= fin) {
    const dow = d.getDay() // 0=dom, 6=sáb
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * Historial de asistencia de un aula: días con pase de lista, días sin pase de
 * lista (uno por uno) con opción de marcar feriado y comentario. Excluye sábados y domingos.
 */
export function HistorialAsistenciaModal({ open, onClose, course, totalEstudiantes }: {
  open: boolean
  onClose: () => void
  course: GradeSection | null
  totalEstudiantes: number
}) {
  const toaster = useToastController()
  const attCol = useCollection<AttendanceRecord>(dataService.getAttendance, dataService.saveAttendance)
  const notesCol = useCollection<AttendanceDayNote>(dataService.getAttendanceNotes, dataService.saveAttendanceNote, dataService.deleteAttendanceNote)
  const [desde, setDesde] = useState(`${new Date().getFullYear()}-08-01`)
  const [comentario, setComentario] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const hoy = todayIso()
  const dias = useMemo(() => diasHabiles(desde, hoy), [desde, hoy])

  const recDe = (fecha: string) => (course ? attCol.items.find((a) => a.gradeId === course.id && a.date === fecha && !a.subjectId) : undefined)
  const noteDe = (fecha: string) => (course ? notesCol.items.find((n) => n.gradeId === course.id && n.date === fecha) : undefined)

  const marcarFeriado = async (fecha: string, feriado: boolean, texto?: string) => {
    if (!course) return
    setBusy(fecha)
    try {
      const prev = noteDe(fecha)
      const next: AttendanceDayNote = {
        id: prev?.id ?? genId('adn'),
        gradeId: course.id,
        date: fecha,
        feriado,
        comentario: texto ?? prev?.comentario,
        updatedAt: new Date().toISOString(),
      }
      await notesCol.save(next)
      toaster.dispatchToast(feriado ? 'Día marcado como feriado.' : 'Día desmarcado como feriado.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo guardar.', { intent: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const guardarComentario = async (fecha: string) => {
    if (!course) return
    setBusy(fecha)
    try {
      const prev = noteDe(fecha)
      const next: AttendanceDayNote = {
        id: prev?.id ?? genId('adn'),
        gradeId: course.id,
        date: fecha,
        feriado: prev?.feriado ?? false,
        comentario: (comentario[fecha] ?? prev?.comentario ?? '').trim() || undefined,
        updatedAt: new Date().toISOString(),
      }
      await notesCol.save(next)
      toaster.dispatchToast('Comentario guardado.', { intent: 'success' })
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo guardar.', { intent: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const resumen = (rec: AttendanceRecord) => {
    let p = 0
    let a = 0
    let x = 0
    for (const e of rec.entries) { if (e.status === 'presente') p++; else if (e.status === 'justificado') x++; else a++ }
    return `P: ${p} · A: ${a} · E: ${x}`
  }

  return (
    <ModalForm
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={`Historial de asistencia · ${course?.name ?? ''}`}
      subtitle="Días con y sin pase de lista. Marca los feriados y agrega comentarios. Sábados y domingos están excluidos."
      width={900}
      actions={<Button appearance="secondary" onClick={onClose}>Cerrar</Button>}
    >
      <FormField label="Desde">
        <Input type="date" value={desde} max={hoy} onChange={(_, d) => setDesde(d.value)} style={{ maxWidth: '200px' }} />
      </FormField>
      <Text size={200} block style={{ margin: '4px 0 10px', color: 'var(--texto-suave)' }}>
        {dias.length} día(s) hábil(es) · {attCol.items.filter((a) => a.gradeId === course?.id && !a.subjectId).length} con pase de lista · {totalEstudiantes} estudiante(s)
      </Text>
      <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Fecha</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
              <TableHeaderCell>Registro / Comentario</TableHeaderCell>
              <TableHeaderCell>Acciones</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dias.slice().reverse().map((fecha) => {
              const rec = recDe(fecha)
              const note = noteDe(fecha)
              return (
                <TableRow key={fecha}>
                  <TableCell><Text weight="semibold">{fecha}</Text></TableCell>
                  <TableCell>
                    {rec
                      ? <Badge appearance="filled" color="success">Pase de lista</Badge>
                      : note?.feriado
                        ? <Badge appearance="filled" color="warning">Feriado</Badge>
                        : <Badge appearance="filled" color="danger">Sin pase de lista</Badge>}
                  </TableCell>
                  <TableCell>
                    {rec ? (
                      <Text size={200}>{resumen(rec)} · {rec.takenBy || '—'}</Text>
                    ) : (
                      <Input
                        value={comentario[fecha] ?? note?.comentario ?? ''}
                        onChange={(_, d) => setComentario((m) => ({ ...m, [fecha]: d.value }))}
                        placeholder="Comentario (opcional)"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {rec ? (
                      <Text size={200} style={{ color: 'var(--texto-suave)' }}>—</Text>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <Button size="small" appearance={note?.feriado ? 'primary' : 'secondary'} icon={<CheckmarkCircleRegular />} disabled={busy === fecha} onClick={() => void marcarFeriado(fecha, !note?.feriado)}>
                          {note?.feriado ? 'Quitar feriado' : 'Marcar feriado'}
                        </Button>
                        <Button size="small" appearance="secondary" disabled={busy === fecha} onClick={() => void guardarComentario(fecha)}>Guardar nota</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </ModalForm>
  )
}
