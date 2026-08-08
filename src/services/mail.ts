import { graphRequest } from './graph'

export interface MailRecipient {
  email: string
  name?: string
}

export interface MailOptions {
  to: MailRecipient[]
  cc?: MailRecipient[]
  subject: string
  body: string
  important?: boolean
}

/**
 * Envío de correos institucionales mediante Microsoft Graph (Outlook).
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const message = {
    subject: options.subject,
    importance: options.important ? 'high' : 'normal',
    body: { contentType: 'html', content: options.body },
    toRecipients: options.to.map((r) => ({ emailAddress: { address: r.email, name: r.name } })),
    ccRecipients: (options.cc ?? []).map((r) => ({ emailAddress: { address: r.email, name: r.name } })),
  }
  await graphRequest('/me/sendMail', 'POST', { message, saveToSentItems: true })
}
