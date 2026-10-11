import type { Prim } from '../types'
import { cubicAt, dist, polyLength, r2 } from './geometry'

/**
 * Path lengths in user units, from the clean geometry (no measuring library).
 * Lengths drive draw-on durations, flow speed (--len) and the draw-on order.
 */

export function primLength(p: Prim): number {
  switch (p.t) {
    case 'line':
      return dist(p.a, p.b)
    case 'rect':
      return 2 * (p.size[0] + p.size[1])
    case 'circle':
      return 2 * Math.PI * p.r
    case 'arc':
      return (Math.abs(p.to - p.from) * Math.PI * p.r) / 180
    case 'poly':
      return polyLength(p.pts, p.closed ?? false, p.r ?? 0)
    case 'cubic': {
      let len = 0
      let prev = p.a
      for (let i = 1; i <= 32; i++) {
        const q = cubicAt(p.a, p.c1, p.c2, p.b, i / 32)
        len += dist(prev, q)
        prev = q
      }
      return len
    }
    case 'path':
      return p.len
  }
}

/** Total length of several primitives, rounded to 2 decimals. */
export const totalLength = (prims: readonly Prim[]): number =>
  r2(prims.reduce((s, p) => s + primLength(p), 0))

/** Draw-on duration in ms for a stroke of `len` user units: clamp(min, 160 + 0.9 len, max). */
export function drawDuration(len: number, min = 240, max = 380): number {
  return Math.round(Math.min(max, Math.max(min, 160 + 0.9 * len)))
}

/**
 * The draw-on order: an index per part, in reading order (top to bottom, then
 * left to right, on the part's first point), so the pencil sketches like a hand.
 */
export function drawOrder<T extends { id: string; key: readonly [number, number] }>(
  items: readonly T[],
): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => a.key[1] - b.key[1] || a.key[0] - b.key[0] || (a.id < b.id ? -1 : 1),
  )
  return new Map(sorted.map((it, i) => [it.id, i]))
}
