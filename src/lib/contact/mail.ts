/**
 * Sends one contact message through Resend (research §2). The client is
 * passed in (actions.ts creates `new Resend(key)` lazily; the unit tests pass
 * a fake), so the SDK never reaches a client chunk: import this file only from
 * src/app/contact/actions.ts. The idempotency key is the SECOND argument; a
 * key inside the payload is silently dropped by resend 6.32.1.
 *
 * Without RESEND_API_KEY outside production it logs a line and reports sent;
 * in production a missing key, CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL is
 * not_configured. Never logs personal data.
 */

export interface MailPayload {
  from: string
  to: string[]
  replyTo: string
  subject: string
  text: string
}

export interface MailClient {
  emails: {
    send(
      payload: MailPayload,
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>
  }
}

export interface MailEnv {
  apiKey?: string
  /** CONTACT_TO_EMAIL, a comma list. */
  to?: string
  /** CONTACT_FROM_EMAIL. */
  from?: string
  production: boolean
}

export interface ContactMail {
  replyTo: string
  subject: string
  text: string
}

export type MailResult =
  | { ok: true; id: string; logged: boolean }
  | { ok: false; reason: 'not_configured' | 'send_failed' }

/** Resend's test addresses, used outside production when the env leaves them out. */
export const DEV_TO = 'delivered@resend.dev'
export const DEV_FROM = 'Actual Engineer <onboarding@resend.dev>'

export const recipients = (to: string | undefined) =>
  (to ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export async function sendContactMail(
  m: ContactMail,
  idempotencyKey: string,
  env: MailEnv,
  makeClient: (apiKey: string) => MailClient | Promise<MailClient>,
  log: (line: string, data?: Record<string, unknown>) => void = console.info,
): Promise<MailResult> {
  const to = recipients(env.to)
  if (env.production && (!env.apiKey || !to.length || !env.from)) {
    log('[contact] mail is not configured', {
      apiKey: Boolean(env.apiKey),
      to: to.length,
      from: Boolean(env.from),
    })
    return { ok: false, reason: 'not_configured' }
  }
  if (!env.apiKey) {
    log('[contact] RESEND_API_KEY is not set; message logged, not sent', {
      idempotencyKey,
      chars: m.text.length,
    })
    return { ok: true, id: 'dev-log', logged: true }
  }
  try {
    const client = await makeClient(env.apiKey)
    const { data, error } = await client.emails.send(
      {
        from: env.from || DEV_FROM,
        to: to.length ? to : [DEV_TO],
        replyTo: m.replyTo,
        subject: m.subject,
        text: m.text,
      },
      { idempotencyKey },
    )
    if (error || !data) {
      log('[contact] send failed', { name: error?.name ?? 'unknown' })
      return { ok: false, reason: 'send_failed' }
    }
    return { ok: true, id: data.id, logged: false }
  } catch {
    log('[contact] send threw')
    return { ok: false, reason: 'send_failed' }
  }
}
