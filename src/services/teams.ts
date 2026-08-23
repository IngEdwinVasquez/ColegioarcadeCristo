import { graphRequest } from './graph'
import { appConfig } from '../config/appConfig'
import type { VirtualMeeting } from '../types'

export interface TeamsMeetingResult {
  eventId: string
  joinUrl: string
  webLink: string
}

interface GraphEvent {
  id: string
  webLink: string
  onlineMeeting?: { joinUrl?: string } | null
  onlineMeetingUrl?: string | null
}

function toGraphDateTime(date: string, time: string) {
  return { dateTime: `${date}T${time || '00:00'}:00`, timeZone: appConfig.timeZone }
}

function buildEventBody(meeting: VirtualMeeting, attendeeEmails: string[], description?: string) {
  return {
    subject: meeting.title,
    body: { contentType: 'HTML', content: description ?? `<p>Encuentro programado desde la intranet de ${appConfig.appName}.</p>` },
    start: toGraphDateTime(meeting.date, meeting.startTime),
    end: toGraphDateTime(meeting.date, meeting.endTime || meeting.startTime),
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    attendees: attendeeEmails.map((address) => ({ emailAddress: { address }, type: 'required' })),
    categories: ['Intranet Arca de Cristo'],
  }
}

/**
 * Crea una reunión de Microsoft Teams (evento de calendario con reunión en línea)
 * en el calendario del usuario conectado y envía las invitaciones a los participantes.
 * Requiere el permiso delegado Calendars.ReadWrite.
 */
export async function createTeamsMeeting(meeting: VirtualMeeting, attendeeEmails: string[], description?: string): Promise<TeamsMeetingResult> {
  const event = await graphRequest<GraphEvent>('/me/events', 'POST', buildEventBody(meeting, attendeeEmails, description))
  return {
    eventId: event.id,
    joinUrl: event.onlineMeeting?.joinUrl ?? event.onlineMeetingUrl ?? '',
    webLink: event.webLink,
  }
}

/** Actualiza fecha/hora/título/invitados de una reunión existente. */
export async function updateTeamsMeeting(eventId: string, meeting: VirtualMeeting, attendeeEmails: string[]): Promise<void> {
  const { isOnlineMeeting: _online, onlineMeetingProvider: _provider, ...patch } = buildEventBody(meeting, attendeeEmails)
  await graphRequest(`/me/events/${eventId}`, 'PATCH', patch)
}

/** Cancela (elimina) la reunión en el calendario del organizador. */
export async function cancelTeamsMeeting(eventId: string, comment?: string): Promise<void> {
  try {
    await graphRequest(`/me/events/${eventId}/cancel`, 'POST', { comment: comment ?? 'Encuentro cancelado desde la intranet.' })
  } catch {
    await graphRequest(`/me/events/${eventId}`, 'DELETE')
  }
}
