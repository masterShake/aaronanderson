'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { contact, contactMail } from '@/content/pages/contact'
import { services } from '@/content/services'
import { site } from '@/content/site'
import { IS_PRODUCTION } from '@/lib/env'
import type { ContactState } from '@/lib/contact/fields'
import { createTokens, type Tokens } from '@/lib/contact/token'
import { limiterFromEnv, type Limiter } from '@/lib/contact/rate-limit'
import { verifyTurnstile } from '@/lib/contact/turnstile'
import { sendContactMail, type MailClient } from '@/lib/contact/mail'
import { runContact } from '@/lib/contact/pipeline'
import type { ContactInput } from '@/lib/contact/schema'
import type { Scored } from '@/lib/contact/score'

/**
 * The contact form's server actions (pages-drawings §8.2). The page stays
 * static: headers() is read only in here, at request time. Resend is created
 * lazily inside the send, so no SDK code reaches a client chunk.
 */

let tokens: Tokens | null = null
let limiter: Limiter | null = null

const getTokens = () =>
  (tokens ??= createTokens({
    secret: process.env.FORM_TOKEN_SECRET,
    fallback: process.env.RESEND_API_KEY,
    production: IS_PRODUCTION,
  }))
const getLimiter = () => (limiter ??= limiterFromEnv(process.env))

/** A fresh time token for the form, fetched on first focus. */
export async function issueFormToken(): Promise<string> {
  return getTokens().issue()
}

const sheetLabel = (id: string) => {
  const s = services.find((x) => x.id === id)
  return s ? `${s.id} ${s.name}` : contactMail.notSure
}

const fill = (t: string, v: Record<string, string>) =>
  t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

function compose(d: ContactInput, scored: Scored) {
  const f = contact.form.fields
  const subject = fill(contactMail.subject, {
    name: d.name,
    company: d.company || contactMail.noCompany,
    sheet: sheetLabel(d.sheet),
  })
  const text = [
    `${f.name.label}: ${d.name}`,
    `${f.email.label}: ${d.email}`,
    `${f.company.label}: ${d.company || contactMail.noCompany}`,
    `${f.sheet.label} ${sheetLabel(d.sheet)}`,
    contactMail.divider,
    d.message,
    contactMail.divider,
    `${contactMail.signals}: ${scored.signals.join(', ') || contactMail.none} (${scored.score})`,
  ].join('\n')
  return {
    replyTo: d.email,
    subject: scored.verdict === 'flag' ? `${contactMail.possibleSpam} ${subject}` : subject,
    text,
  }
}

const makeResend = async (key: string): Promise<MailClient> => {
  const { Resend } = await import('resend')
  return new Resend(key) as unknown as MailClient
}

export async function submitContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const h = await headers()
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
  const host = new URL(site.url).host
  const { state, log } = await runContact(Object.fromEntries(fd), {
    message: { min: contact.form.fields.message.min, max: contact.form.fields.message.max },
    ip,
    tokens: getTokens(),
    limiter: getLimiter(),
    turnstile: turnstileSecret
      ? (response, nonce) =>
          verifyTurnstile({
            secret: turnstileSecret,
            response,
            ip,
            idempotencyKey: nonce,
            hosts: IS_PRODUCTION ? [host] : [host, 'localhost', '127.0.0.1'],
          })
      : undefined,
    compose,
    send: (m, key) =>
      sendContactMail(
        m,
        key,
        {
          apiKey: process.env.RESEND_API_KEY,
          to: process.env.CONTACT_TO_EMAIL,
          from: process.env.CONTACT_FROM_EMAIL,
          production: IS_PRODUCTION,
        },
        makeResend,
      ),
  })
  after(() => console.info('[contact]', log))
  return state
}
