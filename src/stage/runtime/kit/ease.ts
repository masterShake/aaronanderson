import { EASE } from '@/motion/timing/global'

/**
 * CSS easing, solved the way browsers solve cubic-bezier(), so 3D poses and
 * CSS keyframes read the same curves from src/motion/timing (never literals).
 */

export type Ease = (t: number) => number

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x
      if (Math.abs(e) < 1e-7) return t
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= e / d
    }
    let lo = 0
    let hi = 1
    t = x
    while (lo < hi) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-7) return t
      if (x > v) lo = t
      else hi = t
      t = (lo + hi) / 2
      if (hi - lo < 1e-7) break
    }
    return t
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)))
}

/** Parses 'linear' or 'cubic-bezier(a,b,c,d)'. */
export function parseEase(css: string): Ease {
  const m = /cubic-bezier\(([^)]+)\)/.exec(css)
  if (!m) return (t) => Math.min(1, Math.max(0, t))
  const [a, b, c, d] = m[1]!.split(',').map(Number) as [number, number, number, number]
  return cubicBezier(a, b, c, d)
}

export const ease = {
  pencil: parseEase(EASE.pencil),
  machine: parseEase(EASE.machine),
  settle: parseEase(EASE.settle),
  ui: parseEase(EASE.ui),
  flow: parseEase(EASE.flow),
} as const

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
/** Progress of `t` through [a, b], clamped. */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
