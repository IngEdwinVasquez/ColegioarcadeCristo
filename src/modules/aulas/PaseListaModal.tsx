import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, useToastController } from '@fluentui/react-components'
import { CheckmarkCircleRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField, FieldRow } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { genId, todayIso } from '../../utils/helpers'
import type { AttendanceEntry, AttendanceRecord, AttendanceStatus, GradeSection } from '../../types'

const STATUS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'presente', label: 'Presente' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'justificado', label: 'Justificado' },
]

interface Alumno { id: string; fullName: string }

/**
 * Pase de lista diario de un aula (curso). Registra la asistencia de todos los
 * estudiantes y forma parte del registro de asistencia del año escolar.
 */
export function PaseListaModal({ open, onClose, course, estudiantes, periodId, tomadoPor, subjectId = '', subjectName }: {
  open: boolean
  onClose: () => void
  course: GradeSection | null
  estudiantes: Alumno[]
  periodId: string
  tomadoPor: string
  subjectId?: string
  subjectName?: string
}) {
  const toaster = useToastController()
  const col = useCollection<AttendanceRecord>(dataService.getAttendance, dataService.saveAttendance)
  const [fecha, setFecha] = useState(todayIso())
  const [entries, setEntries] = useState<Record<string, { status: AttendanceStatus; note: string }>>({})
  const [saving, setSaving] = useState(false)

  const existente = useMemo(
    () => (course ? col.items.find((a) => a.gradeId === course.id && a.date === fecha && (a.subjectId ?? '') === subjectId) : undefined),
    [col.items, course, fecha, subjectId],
  )

  // Inicializa las marcas de la fecha seleccionada.
  useEffect(() => {
    if (!open || !course) return
    const base: Record<string, { status: AttendanceStatus; note: string }> = {}
    for (const s of estudiantes) {
      const prev = existente?.entries.find((e) => e.studentId === s.id)
      base[s.id] = { status: prev?.status ?? 'presente', note: prev?.note ?? '' }
    }
    setEntries(base)
  }, [open, course, fecha, existente, estudiantes])

  const set = (id: string, patch: Partial<{ status: AttendanceStatus; note: string }>) =>
    setEntries((m) => ({ ...m, [id]: { ...(m[id] ?? { status: 'presente', note: '' }), ...patch } }))

  const marcarTodos = (status: AttendanceStatus) => {
    const base: Record<string, { status: AttendanceStatus; note: string }> = {}
    for (const s of estudiantes) base[s.id] = { status, note: entries[s.id]?.note ?? '' }
    setEntries(base)
  }

  const guardar = async () => {
    if (!course) return
    setSaving(true)
    try {
      const lista: AttendanceEntry[] = estudiantes.map((s) => ({ studentId: s.id, status: entries[s.id]?.status ?? 'presente', note: entries[s.id]?.note || undefined }))
      const rec: AttendanceRecord = {
        id: existente?.id ?? genId('att'),
        classId: '',
        subjectId,
        gradeId: course.id,
        date: fecha,
        period: periodId,
        entries: lista,
        takenBy: tomadoPor,
        takenAt: new Date().toISOString(),
      }
      await col.save(rec)
      toaster.dispatchToast(existente ? 'Pase de lista actualizado.' : 'Pase de lista guardado.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(e instanceof Error ? e.message : 'No se pudo guardar el pase de lista.', { intent: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const resumen = useMemo(() => {
    const c = { presente: 0, ausente: 0, tarde: 0, justificado: 0 }
    for (const s of estudiantes) c[entries[s.id]?.status ?? 'presente']++
    return c
  }, [entries, estudiantes])

  return (
    <ModalForm
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={subjectName ? `Pase de lista · ${subjectName}` : `Pase de lista · ${course?.name ?? ''}`}
      subtitle={subjectName ? `Asistencia por asignatura (${subjectName}) · ${course?.name ?? ''}. Registro del docente.` : 'Asistencia diaria del aula. Se registra en el historial de asistencia del año escolar.'}
      width={820}
      actions={
        <>
          <Button appearance="secondary" onClick={onClose} disabled={saving}>Cerrar</Button>
          <Button appearance="primary" icon={saving ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={saving} onClick={() => void guardar()}>
            {saving ? 'Guardando…' : existente ? 'Guardar cambios' : 'Guardar pase de lista'}
          </Button>
        </>
      }
    >
      <FieldRow>
        <FormField label="Fecha">
          <Input type="date" value={fecha} onChange={(_, d) => setFecha(d.value)} max={todayIso()} />
        </FormField>
        <FormField label="Resumen">
          <Text size={200} block>Presentes: {resumen.presente} · Ausentes: {resumen.ausente} · Tardanzas: {resumen.tarde} · Justificados: {resumen.justificado}</Text>
        </FormField>
      </FieldRow>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {STATUS.map((s) => (
          <Button key={s.value} size="small" appearance="secondary" onClick={() => marcarTodos(s.value)}>Marcar todos «{s.label}»</Button>
        ))}
      </div>
      {estudiantes.length === 0 ? (
        <Text size={200} style={{ color: 'var(--texto-suave)' }}>Este curso no tiene estudiantes matriculados.</Text>
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Estudiante</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Nota</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estudiantes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Text weight="semibold">{s.fullName}</Text></TableCell>
                  <TableCell>
                    <Select value={entries[s.id]?.status ?? 'presente'} onChange={(_, d) => set(s.id, { status: d.value as AttendanceStatus })}>
                      {STATUS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={entries[s.id]?.note ?? ''} onChange={(_, d) => set(s.id, { note: d.value })} placeholder="Nota (opcional)" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {existente && (
        <Text size={200} block style={{ color: 'var(--texto-suave)', marginTop: '8px' }}>
          Ya existe un pase de lista para esta fecha (registrado por {existente.takenBy || '—'}). Puedes modificarlo y guardar.
        </Text>
      )}
    </ModalForm>
  )
}
