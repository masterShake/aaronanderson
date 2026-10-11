import { mulberry32, seedFrom } from '../lib/geometry'
import { drawDuration } from '../lib/length'

/**
 * Seeded pencil timing (pages-drawings §7.3): jitter, durations, the second
 * pass, and crossAt() for anything synchronised with the scan bar. Pure.
 */

/** Seeded jitter in ms, in [-amp, amp], for one element. */
export function jitter(id: string, amp = 30): number {
  return Math.round((mulberry32(seedFrom(id))() * 2 - 1) * amp)
}

/** Start time, duration and second-pass timing for one pencil stroke. */
export function pencilTiming(id: string, start: number, len: number) {
  const dur = drawDuration(len)
  const t = Math.max(0, start + jitter(id))
  return { t, d: dur, t2: t + 40, d2: Math.round(dur * 0.9) }
}

/** Machine ease (cubic-bezier(.65,0,.35,1)) approximated by smoothstep, as the CSS calc() does. */
export const easeMachine = (s: number): number => s * s * (3 - 2 * s)

/**
 * When the scan bar (0 → 110% over `dur` from `t0`, eased) crosses x (0 to 1
 * of the width): bisection on ease(s) × 1.1 = x, 24 iterations.
 */
export function crossAt(xFrac: number, t0: number, dur: number, ease = easeMachine): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (ease(mid) * 1.1 < xFrac) lo = mid
    else hi = mid
  }
  return Math.round(t0 + ((lo + hi) / 2) * dur)
}
