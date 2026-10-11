import type { Prim, Pt } from '../types'
import { mulberry32, num } from '../lib/geometry'
import type { Rect } from '../lib/route'

/**
 * Revision and HOLD clouds: scallops of about r = 7 along a rect, count =
 * round(perimeter / 14), each bulging outward. One path per cloud, so it draws
 * on in one stroke. Deterministic; a seed varies the scallop sizes slightly so
 * clouds look drawn, not stamped.
 */

function perimeterPoint(r: Rect, d: number): Pt {
  const { x, y, w, h } = r
  const p = 2 * (w + h)
  let t = ((d % p) + p) % p
  if (t < w) return [x + t, y]
  t -= w
  if (t < h) return [x + w, y + t]
  t -= h
  if (t < w) return [x + w - t, y + h]
  t -= w
  return [x, y + h - t]
}

export interface CloudOptions {
  /** Scallop radius (default 7). */
  r?: number
  seed?: number
}

/** The cloud around a rect as one 'path' primitive (with its length). */
export function cloudPrim(rect: Rect, o: CloudOptions = {}): Prim {
  const r = o.r ?? 7
  const per = 2 * (rect.w + rect.h)
  const n = Math.max(6, Math.round(per / (2 * r)))
  const step = per / n
  const rand = mulberry32(o.seed ?? 1)
  const c: Pt = [rect.x + rect.w / 2, rect.y + rect.h / 2]
  const pts = Array.from({ length: n + 1 }, (_, i) => perimeterPoint(rect, i * step))
  let d = `M${num(pts[0]![0])} ${num(pts[0]![1])}`
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const vx = m[0] - c[0]
    const vy = m[1] - c[1]
    // outward normal: the side normal on straight runs, the centre ray at corners
    const sx = b[0] - a[0]
    const sy = b[1] - a[1]
    let nx = sy
    let ny = -sx
    if (nx * vx + ny * vy < 0) {
      nx = -nx
      ny = -ny
    }
    const nl = Math.hypot(nx, ny) || 1
    const bulge = step * (0.55 + 0.12 * (rand() - 0.5))
    const k = (bulge * 1.33) / nl
    const c1: Pt = [a[0] + sx * 0.05 + nx * k, a[1] + sy * 0.05 + ny * k]
    const c2: Pt = [a[0] + sx * 0.95 + nx * k, a[1] + sy * 0.95 + ny * k]
    d += `C${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(b[0])} ${num(b[1])}`
    len += step * 1.45
  }
  return { t: 'path', d, len: Math.round(len * 100) / 100 }
}

/** The Δ revision tag (a 16-unit triangle) at a point; its digit is HTML. */
export function deltaTag(at: Pt, size = 16): Prim {
  const h = (size * Math.sqrt(3)) / 2
  return {
    t: 'poly',
    pts: [
      [at[0], at[1] - h / 2],
      [at[0] + size / 2, at[1] + h / 2],
      [at[0] - size / 2, at[1] + h / 2],
    ],
    closed: true,
  }
}
