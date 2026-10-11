import { createHash } from 'node:crypto'
import type { ContactState, Values } from './fields'
import { parseContact, valuesFrom, type ContactInput } from './schema'
import type { Tokens } from './token'
import { scoreSubmission, type Scored } from './score'
import { withinLimits, type Limiter } from './rate-limit'
import type { ContactMail, MailResult } from './mail'

/**
 * The server action's steps (pages-drawings §8.2), with every outside thing
 * injected so the unit tests can run it: validate, rate-limit, Turnstile,
 * score, send. The mail sender is passed in (actions.ts wires mail.ts and
 * Resend), so this file never pulls the SDK anywhere. No 'server-only'.
 */

export interface PipelineDeps {
  message: { min: number; max: number }
  ip: string
  tokens: Tokens
  limiter: Limiter
  /** Set when TURNSTILE_SECRET_KEY is: resolves true when the response passes. */
  turnstile?: (response: string | undefined, nonce: string | undefined) => Promise<boolean>
  compose: (d: ContactInput, scored: Scored) => ContactMail
  send: (m: ContactMail, idempotencyKey: string) => Promise<MailResult>
  now?: number
}

/** What actions.ts logs after the response: no personal data. */
export interface PipelineLog {
  outcome: ContactState['status'] | 'dropped'
  score?: number
  signals?: string[]
  reason?: string
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** `contact/${nonce}` with a token; without one (no JS) a hash of email and message. */
export const idempotencyKey = (nonce: string | undefined, email: string, message: string) =>
  `contact/${nonce ?? sha256(email + message).slice(0, 32)}`

export async function runContact(
  raw: Record<string, FormDataEntryValue>,
  deps: PipelineDeps,
): Promise<{ state: ContactState; log: PipelineLog }> {
  const values: Values = valuesFrom(raw)
  const parsed = parseContact(raw, deps.message)
  if (!parsed.ok)
    return {
      state: { status: 'invalid', errors: parsed.errors, values },
      log: { outcome: 'invalid' },
    }
  const d = parsed.data

  if (!(await withinLimits(deps.limiter, deps.ip, sha256(d.email.toLowerCase()))))
    return {
      state: { status: 'error', formError: 'rate_limited', values },
      log: { outcome: 'error', reason: 'rate_limited' },
    }

  const token = deps.tokens.verify(d.ae_t, deps.now)
  const nonce = 'nonce' in token ? token.nonce : undefined

  if (deps.turnstile && !(await deps.turnstile(d['cf-turnstile-response'], nonce)))
    return {
      state: { status: 'error', formError: 'turnstile', values },
      log: { outcome: 'error', reason: 'turnstile' },
    }

  const scored = scoreSubmission({ honeypot: d.extra_notes, token, message: d.message })
  const sent: ContactState = {
    status: 'sent',
    name: d.name,
    company: d.company,
    at: deps.now ?? Date.now(),
  }
  if (scored.verdict === 'drop')
    return {
      state: sent,
      log: { outcome: 'dropped', score: scored.score, signals: scored.signals },
    }

  const r = await deps.send(deps.compose(d, scored), idempotencyKey(nonce, d.email, d.message))
  if (!r.ok)
    return {
      state: { status: 'error', formError: r.reason, values },
      log: { outcome: 'error', reason: r.reason, score: scored.score, signals: scored.signals },
    }
  return { state: sent, log: { outcome: 'sent', score: scored.score, signals: scored.signals } }
}
