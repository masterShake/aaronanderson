import type { Scheduler } from './scheduler'

/**
 * The static Content-Security-Policy, built once at config time from the
 * booking link. No nonces, so every page stays static.
 */

export interface CspInput {
  isDev: boolean
  onVercel: boolean
  scheduler: Scheduler | null
  turnstile: boolean
  vercelToolbar: boolean
}

export function buildCsp(i: CspInput): string {
  const s = i.scheduler?.csp ?? { script: [], frame: [], font: [], img: [], connect: [] }
  const cf = i.turnstile ? ['https://challenges.cloudflare.com'] : []
  const tb = (...h: string[]) => (i.vercelToolbar ? h : [])
  const d: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...(i.isDev ? ["'unsafe-eval'"] : []),
      ...s.script,
      ...cf,
      ...tb('https://vercel.live'),
    ],
    'style-src': ["'self'", "'unsafe-inline'", ...tb('https://vercel.live')],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      ...s.img,
      ...tb('https://vercel.live', 'https://vercel.com'),
    ],
    'font-src': ["'self'", ...s.font, ...tb('https://vercel.live', 'https://assets.vercel.com')],
    'connect-src': [
      "'self'",
      ...s.connect,
      ...tb('https://vercel.live', 'wss://ws-us3.pusher.com'),
    ],
    'frame-src': [...s.frame, ...cf, ...tb('https://vercel.live')],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  if (d['frame-src'].length === 0) d['frame-src'] = ["'none'"]
  const parts = Object.entries(d).map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`)
  // Never on http://localhost.
  if (i.onVercel) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}
