import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Input, Label, Select, Text, Textarea, useToastController, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowLeftRegular, AddRegular, SaveRegular, VideoRegular, CheckmarkCircleRegular, ClipboardTaskRegular } from '@fluentui/react-icons'
import { useApp } from '../../context/useApp'
import { dataService } from '../../services/dataService'
import { useCollection } from '../../hooks/useCollection'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'
import type { MeetingAgreement, VirtualMeeting } from '../../types'
import { formatDate, genId } from '../../utils/helpers'

const useStyles = makeStyles({
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginTop: '16px' },
  card: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  agreementRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 160px 120px 40px',
    gap: '8px',
    alignItems: 'center',
    '@media (max-width: 820px)': { gridTemplateColumns: '1fr' },
  },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
})

export function EncuentroDetail() {
  const styles = useStyles()
  const { id } = useParams()
  const navigate = useNavigate()
  const toaster = useToastController()
  const { teacherById, role, teachers } = useApp()

  const meetingsCol = useCollection<VirtualMeeting>(dataService.getMeetings, dataService.saveMeeting, dataService.deleteMeeting)
  const meeting = useMemo(() => meetingsCol.items.find((m) => m.id === id), [meetingsCol.items, id])

  const [record, setRecord] = useState<NonNullable<VirtualMeeting['record']> | null>(null)
  const [agreements, setAgreements] = useState<MeetingAgreement[]>([])
  const [saving, setSaving] = useState(false)
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])

  useEffect(() => {
    if (meeting) {
      const rec = meeting.record ?? { agenda: '', minutes: '', agreements: [], attendees: meeting.attendees }
      setRecord(rec)
      setAgreements(rec.agreements ?? [])
      setAttendeeIds(rec.attendees ?? meeting.attendees)
    }
  }, [meeting])

  const basePath = role === 'admin' ? '/administrativo' : '/docentes'

  if (!meeting) return <Text>Buscando encuentro…</Text>

  const updateAgreement = (idx: number, patch: Partial<MeetingAgreement>) => {
    setAgreements((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  const addAgreement = () => {
    setAgreements((prev) => [...prev, { id: genId('agr'), description: '', ownerId: '', dueDate: '', status: 'pendiente' }])
  }

  const toggleAttendee = (tid: string) => {
    setAttendeeIds((prev) => (prev.includes(tid) ? prev.filter((a) => a !== tid) : [...prev, tid]))
  }

  const save = async () => {
    if (!record) return
    setSaving(true)
    try {
      await meetingsCol.save({
        ...meeting,
        status: 'realizado',
        record: { ...record, agreements, attendees: attendeeIds },
      })
      toaster.dispatchToast("Acta del encuentro guardada", { intent: "success" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={meeting.title}
        subtitle={`${formatDate(meeting.date)} · ${meeting.startTime} - ${meeting.endTime} · ${meeting.platform}`}
        actions={
          <div className={styles.actions}>
            <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(`${basePath}/encuentros`)}>Volver</Button>
            <StatusBadge status={meeting.status} />
            {meeting.link && (
              <Button appearance="outline" icon={<VideoRegular />} onClick={() => window.open(meeting.link, '_blank')}>Unirse</Button>
            )}
            <Button appearance="primary" icon={<SaveRegular />} onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar acta'}
            </Button>
          </div>
        }
      />

      <div className={styles.grid}>
        <Card className={styles.card} style={{ gridColumn: '1 / -1' }}>
          <Text weight="semibold" size={400}>📝 Registro del encuentro</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Label size="small">Agenda / temas a tratar</Label>
              <Textarea value={record?.agenda ?? ''} onChange={(_, d) => setRecord({ ...(record ?? { minutes: '', agreements: [], attendees: [] }), agenda: d.value })} resize="vertical" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Label size="small">Acta / resumen de lo tratado durante el encuentro</Label>
              <Textarea value={record?.minutes ?? ''} onChange={(_, d) => setRecord({ ...(record ?? { agenda: '', agreements: [], attendees: [] }), minutes: d.value })} resize="vertical" style={{ minHeight: '140px' }} />
            </div>
          </div>
        </Card>

        <Card className={styles.card}>
          <Text weight="semibold" size={400}>👥 Asistentes al encuentro</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {teachers.map((t) => (
              <Button key={t.id} size="small" appearance={attendeeIds.includes(t.id) ? 'primary' : 'secondary'} onClick={() => toggleAttendee(t.id)}>
                {t.fullName}
              </Button>
            ))}
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            Organizador: {teacherById(meeting.organizerId)?.fullName ?? '—'}
          </Text>
        </Card>

        <Card className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight="semibold" size={400}>
              <ClipboardTaskRegular /> Acuerdos y planificación futura
            </Text>
            <Button appearance="subtle" size="small" icon={<AddRegular />} onClick={addAgreement}>Agregar acuerdo</Button>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            De los acuerdos derivan actividades y compromisos para las próximas semanas.
          </Text>
          {agreements.length === 0 && <Text size={300}>No hay acuerdos registrados.</Text>}
          {agreements.map((a, idx) => (
            <div key={a.id} className={styles.agreementRow} style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, paddingTop: '10px' }}>
              <Input value={a.description} onChange={(_, d) => updateAgreement(idx, { description: d.value })} placeholder="Descripción del acuerdo" />
              <Select value={a.ownerId ?? ''} onChange={(_, d) => updateAgreement(idx, { ownerId: d.value })}>
                <option value="">Responsable</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </Select>
              <Input type="date" value={a.dueDate ?? ''} onChange={(_, d) => updateAgreement(idx, { dueDate: d.value })} />
              <Select value={a.status} onChange={(_, d) => updateAgreement(idx, { status: d.value as MeetingAgreement['status'] })}>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completado">Completado</option>
              </Select>
            </div>
          ))}
          {agreements.some((a) => a.description) && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                Completados: <strong>{agreements.filter((a) => a.status === 'completado').length}</strong> / {agreements.length}
              </Text>
              <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
