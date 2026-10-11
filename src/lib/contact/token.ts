import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * The form's time token (pages-drawings §8.2, research §3.2): `${ts}.${nonce}.${sig}`,
 * HMAC-SHA256 over an HKDF key. Issued by a server action on first focus, so a
 * static page still gets a fresh one. Valid from 3 s to 2 h after issue.
 *
 * FORM_TOKEN_SECRET is required in production: without it every token counts
 * as missing, and that is logged once per instance (critic risk 7). Outside
 * production it falls back to RESEND_API_KEY, then a dev-only constant.
 * No 'server-only' here: the unit tests import this file.
 */

export const TOKEN_MIN_MS = 3_000
export const TOKEN_MAX_MS = 2 * 3_600_000

export type TokenCheck =
  | { status: 'missing' }
  | { status: 'bad' }
  | { status: 'expired'; nonce: string }
  | { status: 'fast'; nonce: string }
  | { status: 'ok'; nonce: string }

export interface TokenEnv {
  /** FORM_TOKEN_SECRET. */
  secret?: string
  /** RESEND_API_KEY, used as the base outside production only. */
  fallback?: string
  production: boolean
  log?: (line: string) => void
}

export interface Tokens {
  /** A fresh token, or '' when no secret is available (production without FORM_TOKEN_SECRET). */
  issue(now?: number): string
  verify(token: string | undefined, now?: number): TokenCheck
}

export const MISSING_SECRET_LOG =
  '[contact] FORM_TOKEN_SECRET is not set; form tokens count as missing'

export function createTokens(env: TokenEnv): Tokens {
  const base =
    env.secret || (env.production ? undefined : env.fallback || 'dev-only-insecure-form-token')
  let warned = false
  let key: Buffer | null = null
  const getKey = (): Buffer | null => {
    if (!base) {
      if (!warned) {
        warned = true
        ;(env.log ?? console.warn)(MISSING_SECRET_LOG)
      }
      return null
    }
    key ??= Buffer.from(hkdfSync('sha256', base, 'actualengineer', 'form-token-v1', 32))
    return key
  }
  const sign = (k: Buffer, payload: string) => createHmac('sha256', k).update(payload).digest()

  return {
    issue(now = Date.now()) {
      const k = getKey()
      if (!k) return ''
      const payload = `${now}.${randomBytes(12).toString('base64url')}`
      return `${payload}.${sign(k, payload).toString('base64url')}`
    },
    verify(token, now = Date.now()) {
      const k = getKey()
      if (!k || !token) return { status: 'missing' }
      const [ts, nonce, sig, extra] = token.split('.')
      if (!ts || !nonce || !sig || extra !== undefined || !/^\d+$/.test(ts))
        return { status: 'bad' }
      const want = sign(k, `${ts}.${nonce}`)
      const got = Buffer.from(sig, 'base64url')
      if (got.length !== want.length || !timingSafeEqual(got, want)) return { status: 'bad' }
      const age = now - Number(ts)
      if (age < TOKEN_MIN_MS) return { status: 'fast', nonce }
      if (age > TOKEN_MAX_MS) return { status: 'expired', nonce }
      return { status: 'ok', nonce }
    },
  }
}
