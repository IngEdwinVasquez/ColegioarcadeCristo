import { appConfig } from '../config/appConfig'
import { sendMail, type MailRecipient } from './mail'

export interface NotificationRequest {
  to: MailRecipient[]
  cc?: MailRecipient[]
  subject: string
  /** Cuerpo en HTML */
  body: string
  important?: boolean
  /** Categoría del evento (la usa el flujo para enrutar/etiquetar) */
  category: 'comunicado' | 'admision' | 'asistencia' | 'actividad' | 'encuentro' | 'psicologia' | 'documento' | 'general'
  metadata?: Record<string, string | number | boolean>
}

export interface NotificationResult {
  channel: 'power-automate' | 'graph' | 'skipped'
  recipients: number
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function uniqueRecipients(recipients: Array<MailRecipient | undefined | null>): MailRecipient[] {
  const seen = new Set<string>()
  const out: MailRecipient[] = []
  for (const r of recipients) {
    const email = r?.email?.trim().toLowerCase()
    if (!email || !VALID_EMAIL.test(email) || seen.has(email)) continue
    seen.add(email)
    out.push({ email, name: r?.name })
  }
  return out
}

/**
 * Envío de notificaciones por correo.
 *
 * 1. Si está configurado `VITE_POWER_AUTOMATE_MAIL_URL`, se invoca el flujo de Power Automate
 *    ("Cuando se recibe una solicitud HTTP") que envía el correo desde el buzón institucional.
 *    Esquema del cuerpo: ver docs/POWERAUTOMATE.md.
 * 2. En caso contrario, se envía con Microsoft Graph desde el buzón del usuario conectado.
 */
export async function notify(request: NotificationRequest): Promise<NotificationResult> {
  const to = uniqueRecipients(request.to)
  const cc = uniqueRecipients(request.cc ?? [])
  if (to.length === 0) return { channel: 'skipped', recipients: 0 }

  const flowUrl = appConfig.automation.mailFlowUrl
  if (flowUrl) {
    const response = await fetch(flowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: appConfig.shortName,
        category: request.category,
        subject: request.subject,
        body: request.body,
        important: request.important ?? false,
        to: to.map((r) => r.email),
        cc: cc.map((r) => r.email),
        metadata: request.metadata ?? {},
        sentAt: new Date().toISOString(),
      }),
    })
    if (!response.ok) {
      throw new Error(`El flujo de Power Automate respondió ${response.status}`)
    }
    return { channel: 'power-automate', recipients: to.length }
  }

  await sendMail({ to, cc, subject: request.subject, body: request.body, important: request.important })
  return { channel: 'graph', recipients: to.length }
}

/** Plantilla HTML institucional para los correos. */
export function emailTemplate(title: string, contentHtml: string, footer?: string): string {
  const c = appConfig.colors
  return `
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:${c.azul};color:#fff;padding:18px 24px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">${appConfig.institution}</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">${title}</div>
  </div>
  <div style="padding:22px 24px;color:#111827;font-size:15px;line-height:1.6">${contentHtml}</div>
  <div style="background:#f3f4f6;padding:14px 24px;font-size:12px;color:#6b7280">
    ${footer ?? `${appConfig.contact.address} · ${appConfig.contact.phone} · ${appConfig.contact.email}`}
  </div>
</div>`
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}
