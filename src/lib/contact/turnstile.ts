/**
 * Cloudflare Turnstile siteverify (research §3.3), only when
 * TURNSTILE_SECRET_KEY is set. Requires success, action 'contact' and an
 * allowed hostname. A failure is shown to the visitor (retryable), not scored.
 */

export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileResult {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function verifyTurnstile(
  o: {
    secret: string
    response: string | undefined
    ip: string
    idempotencyKey?: string
    hosts: readonly string[]
  },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!o.response) return false
  try {
    const body = new URLSearchParams({ secret: o.secret, response: o.response })
    if (o.ip && o.ip !== 'unknown') body.set('remoteip', o.ip)
    if (o.idempotencyKey) body.set('idempotency_key', o.idempotencyKey)
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body, cache: 'no-store' })
    if (!res.ok) return false
    const r = (await res.json()) as TurnstileResult
    const host = (r.hostname ?? '').replace(/^www\./, '')
    return r.success === true && r.action === 'contact' && o.hosts.includes(host)
  } catch {
    return false
  }
}
