import type { TokenCheck } from './token'

/**
 * Submissions are scored, not hard-rejected (pages-drawings §8.2 step 6):
 * a score of 2 or more is dropped quietly (the visitor still sees "sent");
 * 1 or more is delivered with "[possible spam]" in the subject.
 */

export type Signal = 'honeypot' | 'token-missing' | 'token-bad' | 'token-fast' | 'links'

export const WEIGHTS: Readonly<Record<Signal, number>> = {
  honeypot: 2,
  'token-missing': 0.5,
  'token-bad': 1,
  'token-fast': 1,
  links: 1,
}

export const DROP_AT = 2
export const FLAG_AT = 1
export const MAX_LINKS = 2

const LINK = /\bhttps?:\/\/|\bwww\./gi

export const countLinks = (text: string) => (text.match(LINK) ?? []).length

export interface Scored {
  score: number
  signals: Signal[]
  verdict: 'send' | 'flag' | 'drop'
}

export function scoreSubmission(i: {
  honeypot: string | undefined
  token: TokenCheck
  message: string
}): Scored {
  const signals: Signal[] = []
  if (i.honeypot && i.honeypot.trim() !== '') signals.push('honeypot')
  if (i.token.status === 'missing') signals.push('token-missing')
  // a bad signature and an expired token weigh the same
  if (i.token.status === 'bad' || i.token.status === 'expired') signals.push('token-bad')
  if (i.token.status === 'fast') signals.push('token-fast')
  if (countLinks(i.message) > MAX_LINKS) signals.push('links')
  const score = signals.reduce((s, x) => s + WEIGHTS[x], 0)
  return {
    score,
    signals,
    verdict: score >= DROP_AT ? 'drop' : score >= FLAG_AT ? 'flag' : 'send',
  }
}
