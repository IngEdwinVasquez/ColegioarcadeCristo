import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Spinner, Text, Textarea, useToastController } from '@fluentui/react-components'
import { CheckmarkCircleRegular, DocumentPdfRegular, ImageRegular, PersonRegular } from '@fluentui/react-icons'
import { ModalForm } from '../../components/shared/ModalForm'
import { FormField } from '../../components/shared/form'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { uploadAndShare } from '../../services/onedrive'
import { genId, todayIso } from '../../utils/helpers'
import { graphErrorMessage } from '../../services/graph'
import type { StaffAttendanceRecord, StaffAttendanceStatus } from '../../types'

/**
 * Reporte de asistencia del personal: el usuario indica si está presente o
 * ausente; si está ausente puede subir la evidencia (documento/imagen).
 */
export function StaffAttendanceModal({ open, onClose, personId, personName, kind, date, onSaved }: {
  open: boolean
  onClose: () => void
  personId: string
  personName: string
  kind: 'docente' | 'persona'
  date?: string
  onSaved?: () => void
}) {
  const toaster = useToastController()
  const col = useCollection<StaffAttendanceRecord>(dataService.getStaffAttendance, dataService.saveStaffAttendance, dataService.deleteStaffAttendance)
  const [fecha, setFecha] = useState(date ?? todayIso())
  const [status, setStatus] = useState<StaffAttendanceStatus>('presente')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const existente = useMemo(
    () => col.items.find((a) => a.personId === personId && a.date === fecha),
    [col.items, personId, fecha],
  )

  useEffect(() => {
    if (!open) return
    setFecha(date ?? todayIso())
    setStatus(existente?.status ?? 'presente')
    setNote(existente?.note ?? '')
    setFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, personId])

  const guardar = async () => {
    if (status === 'ausente_evidencia' && !file && !existente?.evidenceRef) {
      toaster.dispatchToast('Debes subir el documento o la imagen de la evidencia para registrar la ausencia.', { intent: 'error' })
      return
    }
    setBusy(true)
    try {
      let evidenceRef = existente?.evidenceRef
      let evidenceName = existente?.evidenceName
      let evidenceUrl = existente?.evidenceUrl
      if (status !== 'presente' && file) {
        const ref = await uploadAndShare(`AsistenciaPersonal/${fecha.slice(0, 4)}`, file)
        evidenceRef = ref.id
        evidenceName = ref.name
        evidenceUrl = ref.webUrl
      }
      const rec: StaffAttendanceRecord = {
        id: existente?.id ?? genId('satt'),
        personId,
        personName,
        kind,
        date: fecha,
        status,
        evidenceRef,
        evidenceName,
        evidenceUrl,
        note: note.trim() || undefined,
        reportedBy: personName,
        auto: false,
        updatedAt: new Date().toISOString(),
      }
      await col.save(rec)
      onSaved?.()
      toaster.dispatchToast('Asistencia registrada.', { intent: 'success' })
      onClose()
    } catch (e) {
      toaster.dispatchToast(graphErrorMessage(e), { intent: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Mi asistencia"
      subtitle="Reporta si estás presente o ausente. Si estás ausente, adjunta la evidencia (documento o imagen)."
      width={560}
      actions={
        <>
          <Button appearance="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button appearance="primary" icon={busy ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />} disabled={busy} onClick={() => void guardar()}>
            {busy ? 'Guardando…' : 'Registrar asistencia'}
          </Button>
        </>
      }
    >
      <FormField label="Fecha">
        <Input type="date" value={fecha} max={todayIso()} onChange={(_, d) => setFecha(d.value)} />
      </FormField>
      <FormField label="Estado">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button appearance={status === 'presente' ? 'primary' : 'secondary'} icon={<CheckmarkCircleRegular />} onClick={() => setStatus('presente')}>Presente</Button>
          <Button appearance={status !== 'presente' ? 'primary' : 'secondary'} icon={<PersonRegular />} onClick={() => setStatus('ausente_evidencia')}>Ausente (con evidencia)</Button>
        </div>
      </FormField>
      {status !== 'presente' && (
        <>
          <FormField label="Evidencia (documento o imagen)" hint="Permanece activo hasta que subas el documento o la imagen.">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="staff-ev" type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button size="small" icon={file?.type.startsWith('image/') ? <ImageRegular /> : <DocumentPdfRegular />} onClick={() => document.getElementById('staff-ev')?.click()}>Subir evidencia</Button>
              {file ? <Text size={200}>{file.name}</Text> : existente?.evidenceName ? <Text size={200}>Actual: {existente.evidenceName}</Text> : <Text size={200} style={{ color: '#B42318' }}>Falta la evidencia</Text>}
            </div>
          </FormField>
          <FormField label="Motivo / nota">
            <Textarea value={note} resize="vertical" onChange={(_, d) => setNote(d.value)} placeholder="Motivo de la ausencia…" />
          </FormField>
        </>
      )}
    </ModalForm>
  )
}
