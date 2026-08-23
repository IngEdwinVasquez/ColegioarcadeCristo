import { useState } from 'react'
import { Button, Checkbox, Input, Select, Text } from '@fluentui/react-components'
import { VideoRegular } from '@fluentui/react-icons'
import { FormActions, FormField, FieldRow } from '../../components/shared/form'
import { useApp } from '../../context/useApp'
import type { VirtualMeeting } from '../../types'
import { genId, todayIso } from '../../utils/helpers'
import { createTeamsMeeting, updateTeamsMeeting } from '../../services/teams'
import { graphErrorMessage } from '../../services/graph'

interface EncuentroFormProps {
  initial?: VirtualMeeting | null
  onSave: (meeting: VirtualMeeting) => void | Promise<void>
  onCancel: () => void
}

export function EncuentroForm({ initial, onSave, onCancel }: EncuentroFormProps) {
  const { teachers, user } = useApp()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<VirtualMeeting>(() => {
    if (initial) return { ...initial }
    return {
      id: genId('mtg'),
      title: '',
      date: todayIso(),
      startTime: '15:00',
      endTime: '16:30',
      organizerId: user?.teacherId ?? teachers[0]?.id ?? '',
      attendees: [],
      type: 'coordinacion',
      platform: 'Microsoft Teams',
      link: '',
      status: 'programado',
      createdAt: new Date().toISOString(),
    }
  })

  const [attendeeIds, setAttendeeIds] = useState<string[]>(form.attendees)
  const [createTeams, setCreateTeams] = useState(!initial?.eventId)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const set = <K extends keyof VirtualMeeting>(key: K, value: VirtualMeeting[K]) => setForm((f) => ({ ...f, [key]: value }))

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
      setForm((f) => ({ ...f, attendees: next }))
      return next
    })
  }

  const submit = async () => {
    if (!form.title || !form.date) {
      window.alert('Complete los campos obligatorios: título y fecha.')
      return
    }
    setSaving(true)
    setTeamsError(null)
    let next: VirtualMeeting = { ...form, attendees: attendeeIds }
    if (next.platform === 'Microsoft Teams' && next.status !== 'cancelado') {
      const emails = attendeeIds.map((id) => teachers.find((t) => t.id === id)?.email ?? '').filter(Boolean)
      try {
        if (next.eventId) {
          await updateTeamsMeeting(next.eventId, next, emails)
        } else if (createTeams) {
          const created = await createTeamsMeeting(next, emails)
          next = { ...next, eventId: created.eventId, link: created.joinUrl || next.link || created.webLink }
        }
      } catch (error) {
        setTeamsError(`No se pudo crear la reunión de Teams: ${graphErrorMessage(error)}. El encuentro se guardará sin enlace.`)
      }
    }
    await onSave(next)
    setSaving(false)
  }

  return (
    <div>
      <FormField label="Título del encuentro" required>
        <Input value={form.title} onChange={(_, d) => set('title', d.value)} placeholder="Ej. Reunión de coordinación pedagógica" />
      </FormField>
      <FieldRow>
        <FormField label="Fecha" required>
          <Input type="date" value={form.date} onChange={(_, d) => set('date', d.value)} />
        </FormField>
        <FormField label="Tipo">
          <Select value={form.type} onChange={(_, d) => set('type', d.value as VirtualMeeting['type'])}>
            <option value="coordinacion">Coordinación</option>
            <option value="consejo">Consejo de docentes</option>
            <option value="junta">Junta pedagógica</option>
            <option value="reunion_padres">Reunión con padres</option>
            <option value="capacitacion">Capacitación</option>
            <option value="otros">Otros</option>
          </Select>
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Hora de inicio">
          <Input type="time" value={form.startTime} onChange={(_, d) => set('startTime', d.value)} />
        </FormField>
        <FormField label="Hora de fin">
          <Input type="time" value={form.endTime} onChange={(_, d) => set('endTime', d.value)} />
        </FormField>
      </FieldRow>
      <FieldRow>
        <FormField label="Plataforma">
          <Select value={form.platform} onChange={(_, d) => set('platform', d.value)}>
            <option value="Microsoft Teams">Microsoft Teams</option>
            <option value="Google Meet">Google Meet</option>
            <option value="Zoom">Zoom</option>
            <option value="Presencial">Presencial</option>
          </Select>
        </FormField>
        <FormField label="Enlace (opcional)">
          <Input value={form.link ?? ''} onChange={(_, d) => set('link', d.value)} placeholder="https://…" disabled={form.platform === 'Microsoft Teams' && createTeams && !form.eventId} />
        </FormField>
      </FieldRow>
      {form.platform === 'Microsoft Teams' && !form.eventId && (
        <Checkbox
          checked={createTeams}
          onChange={(_, d) => setCreateTeams(!!d.checked)}
          label={<span><VideoRegular /> Crear la reunión en Microsoft Teams y enviar las invitaciones de calendario a los participantes</span>}
        />
      )}
      {form.eventId && (
        <Text size={200} block style={{ color: 'var(--texto-suave)', marginBottom: '8px' }}>
          Reunión de Teams creada. Al guardar se actualizará el evento en el calendario de los invitados.
        </Text>
      )}
      {teamsError && <Text size={200} block style={{ color: '#B42318', marginBottom: '8px' }}>{teamsError}</Text>}
      <FormField label="Organizador">
        <Select value={form.organizerId} onChange={(_, d) => set('organizerId', d.value)}>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.fullName}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Participantes (invitados)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {teachers.map((t) => (
            <Button
              key={t.id}
              size="small"
              appearance={attendeeIds.includes(t.id) ? 'primary' : 'secondary'}
              onClick={() => toggleAttendee(t.id)}
            >
              {t.fullName}
            </Button>
          ))}
        </div>
      </FormField>
      <FormField label="Estado">
        <Select value={form.status} onChange={(_, d) => set('status', d.value as VirtualMeeting['status'])}>
          <option value="programado">Programado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </FormField>
      <FormActions onCancel={onCancel} onSubmit={() => void submit()} saving={saving} submitLabel={initial ? 'Actualizar encuentro' : 'Programar encuentro'} />
    </div>
  )
}
