import type { FallbackReason, Tier } from './types'

/**
 * The Stage's only ways to touch the tier. The head script sets still or svg;
 * the Stage may promote svg to webgl (setTier) or downgrade for the rest of the
 * session (downgrade). It never reads matchMedia or ?tier itself: those are in
 * data-rm and data-tier-force. Frozen after W0.
 */

const html = () => document.documentElement

export const getTier = (): Tier => (html().dataset.tier as Tier | undefined) ?? 'svg'
export const forcedTier = (): Tier | null => (html().dataset.tierForce as Tier | undefined) ?? null
/** The best tier this visit allows: svg after a downgrade or under reduced motion. */
export const tierMax = (): 'svg' | 'webgl' => (html().dataset.tierMax === 'svg' ? 'svg' : 'webgl')

/** Promote svg to webgl (only when tierMax allows), and notify React. */
export function setTier(t: Tier): void {
  if (t === 'webgl' && tierMax() !== 'webgl') return
  html().dataset.tier = t
  document.dispatchEvent(new CustomEvent('ae:state'))
}

/** One-way for this session: webgl becomes svg. The head script reads it on the next load. */
export function downgrade(reason: FallbackReason): void {
  try {
    sessionStorage.setItem('ae:tier', 'svg')
  } catch {}
  html().dataset.tierReason = reason
  html().dataset.tierMax = 'svg'
  if (getTier() === 'webgl') setTier('svg')
  else document.dispatchEvent(new CustomEvent('ae:state'))
}
