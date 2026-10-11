import type { Prim, Pt, ViewBox } from '../types'

/**
 * Pure geometry for the drawing pipeline: rounding, seeds, path data for
 * primitives, footprints and bounds. Isomorphic (no roughjs, no DOM, no three)
 * and deterministic: the same input always gives the same string.
 */

/** Round to 2 decimals, and never print -0. */
export const r2 = (n: number): number => {
  const v = Math.round(n * 100) / 100
  return Object.is(v, -0) ? 0 : v
}

/** A number as path data: 2 decimals, no trailing zeros. */
export const num = (n: number): string => String(r2(n))

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
export const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
export const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1])
export const lerp = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]

/** FNV-1a 32-bit hash of a string; never 0 (roughjs treats seed 0 as random). */
export function seedFrom(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h === 0 ? 1 : h
}

/** mulberry32: a small seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rad = (deg: number) => (deg * Math.PI) / 180
const onCircle = (c: Pt, r: number, deg: number): Pt => [
  c[0] + r * Math.cos(rad(deg)),
  c[1] + r * Math.sin(rad(deg)),
]

/** Corner points of a rect, clockwise from the top left. */
export function rectPts(at: Pt, size: readonly [number, number]): Pt[] {
  const [x, y] = at
  const [w, h] = size
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/**
 * The SVG path data of one primitive, clean (CAD). Polylines with r > 0 get
 * filleted corners (quarter arcs of radius r, clamped to half of each leg).
 */
export function primD(p: Prim): string {
  switch (p.t) {
    case 'line':
      return `M${num(p.a[0])} ${num(p.a[1])}L${num(p.b[0])} ${num(p.b[1])}`
    case 'rect': {
      const [x, y] = p.at
      const [w, h] = p.size
      return `M${num(x)} ${num(y)}H${num(x + w)}V${num(y + h)}H${num(x)}Z`
    }
    case 'circle': {
      const [cx, cy] = p.c
      const r = p.r
      return `M${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 0 ${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 0 ${num(cx - r)} ${num(cy)}Z`
    }
    case 'arc': {
      const a = onCircle(p.c, p.r, p.from)
      const b = onCircle(p.c, p.r, p.to)
      const sweep = p.to > p.from ? 1 : 0
      const large = Math.abs(p.to - p.from) > 180 ? 1 : 0
      return `M${num(a[0])} ${num(a[1])}A${num(p.r)} ${num(p.r)} 0 ${large} ${sweep} ${num(b[0])} ${num(b[1])}`
    }
    case 'cubic':
      return `M${num(p.a[0])} ${num(p.a[1])}C${num(p.c1[0])} ${num(p.c1[1])} ${num(p.c2[0])} ${num(p.c2[1])} ${num(p.b[0])} ${num(p.b[1])}`
    case 'path':
      return p.d
    case 'poly':
      return polyD(p.pts, p.closed ?? false, p.r ?? 0)
  }
}

/** Fillet geometry for the corner at b between a→b→c: trimmed points and the arc. */
function fillet(a: Pt, b: Pt, c: Pt, r: number) {
  const l1 = dist(a, b)
  const l2 = dist(b, c)
  const u1 = scale(sub(a, b), 1 / (l1 || 1))
  const u2 = scale(sub(c, b), 1 / (l2 || 1))
  const cos = u1[0] * u2[0] + u1[1] * u2[1]
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)))
  if (angle < 1e-3 || Math.PI - angle < 1e-3) return null
  const t = Math.min(r / Math.tan(angle / 2), l1 / 2, l2 / 2)
  const rr = t * Math.tan(angle / 2)
  const p1 = add(b, scale(u1, t))
  const p2 = add(b, scale(u2, t))
  const cross = u1[0] * u2[1] - u1[1] * u2[0]
  return { p1, p2, rr, sweep: cross < 0 ? 1 : 0, arcLen: rr * (Math.PI - angle) }
}

function polyD(pts: readonly Pt[], closed: boolean, r: number): string {
  if (pts.length < 2) return ''
  if (r <= 0 || pts.length < 3) {
    const [h, ...rest] = pts
    return `M${num(h![0])} ${num(h![1])}${rest.map((q) => `L${num(q[0])} ${num(q[1])}`).join('')}${closed ? 'Z' : ''}`
  }
  let d = `M${num(pts[0]![0])} ${num(pts[0]![1])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const f = fillet(pts[i - 1]!, pts[i]!, pts[i + 1]!, r)
    if (!f) {
      d += `L${num(pts[i]![0])} ${num(pts[i]![1])}`
      continue
    }
    d += `L${num(f.p1[0])} ${num(f.p1[1])}A${num(f.rr)} ${num(f.rr)} 0 0 ${f.sweep} ${num(f.p2[0])} ${num(f.p2[1])}`
  }
  const last = pts[pts.length - 1]!
  return `${d}L${num(last[0])} ${num(last[1])}${closed ? 'Z' : ''}`
}

/** Exact length of a filleted polyline. */
export function polyLength(pts: readonly Pt[], closed = false, r = 0): number {
  const all = closed && pts.length > 2 ? [...pts, pts[0]!] : pts
  let len = 0
  for (let i = 1; i < all.length; i++) len += dist(all[i - 1]!, all[i]!)
  if (r > 0)
    for (let i = 1; i < all.length - 1; i++) {
      const f = fillet(all[i - 1]!, all[i]!, all[i + 1]!, r)
      if (f) len += f.arcLen - dist(f.p1, all[i]!) - dist(all[i]!, f.p2)
    }
  return len
}

/** Points along a primitive (corners for polylines, n samples for curves), for roughjs and iso. */
export function primPts(p: Prim, n = 24): Pt[] {
  switch (p.t) {
    case 'line':
      return [p.a, p.b]
    case 'rect':
      return rectPts(p.at, p.size)
    case 'poly':
      return [...p.pts]
    case 'circle':
      return Array.from({ length: n }, (_, i) => onCircle(p.c, p.r, (360 * i) / n))
    case 'arc':
      return Array.from({ length: n + 1 }, (_, i) =>
        onCircle(p.c, p.r, p.from + ((p.to - p.from) * i) / n),
      )
    case 'cubic':
      return Array.from({ length: n + 1 }, (_, i) => cubicAt(p.a, p.c1, p.c2, p.b, i / n))
    case 'path':
      return []
  }
}

export function cubicAt(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const m = 1 - t
  const k0 = m * m * m
  const k1 = 3 * m * m * t
  const k2 = 3 * m * t * t
  const k3 = t * t * t
  return [
    k0 * a[0] + k1 * c1[0] + k2 * c2[0] + k3 * b[0],
    k0 * a[1] + k1 * c1[1] + k2 * c2[1] + k3 * b[1],
  ]
}

/** Is the primitive a closed shape? */
export const isClosed = (p: Prim): boolean =>
  p.t === 'rect' || p.t === 'circle' || (p.t === 'poly' && Boolean(p.closed))

/** The bounding box of a set of points as a ViewBox. */
export function bounds(pts: readonly Pt[]): ViewBox {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return pts.length ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, 0, 0]
}

/** Translate and scale a primitive (symbols placed in a drawing). */
export function placePrim(p: Prim, at: Pt, k = 1): Prim {
  const T = (q: Pt): Pt => [at[0] + q[0] * k, at[1] + q[1] * k]
  switch (p.t) {
    case 'line':
      return { t: 'line', a: T(p.a), b: T(p.b) }
    case 'rect':
      return { t: 'rect', at: T(p.at), size: [p.size[0] * k, p.size[1] * k] }
    case 'poly':
      return { ...p, pts: p.pts.map(T), ...(p.r ? { r: p.r * k } : {}) }
    case 'circle':
      return { t: 'circle', c: T(p.c), r: p.r * k }
    case 'arc':
      return { ...p, c: T(p.c), r: p.r * k }
    case 'cubic':
      return { t: 'cubic', a: T(p.a), c1: T(p.c1), c2: T(p.c2), b: T(p.b) }
    case 'path':
      return { t: 'path', d: transformD(p.d, at, k), len: p.len * k }
  }
}

/** Translate and scale absolute path data (M L H V C Q A Z only; relative commands throw). */
export function transformD(d: string, at: Pt, k: number): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  let out = ''
  let cmd = ''
  let args: number[] = []
  const flush = () => {
    if (!cmd) return
    const X = (v: number) => num(at[0] + v * k)
    const Y = (v: number) => num(at[1] + v * k)
    const S = (v: number) => num(v * k)
    let s = ''
    switch (cmd) {
      case 'M':
      case 'L':
      case 'C':
      case 'Q':
        for (let i = 0; i < args.length; i += 2)
          s += `${i ? ' ' : ''}${X(args[i]!)} ${Y(args[i + 1]!)}`
        break
      case 'H':
        s = args.map(X).join(' ')
        break
      case 'V':
        s = args.map(Y).join(' ')
        break
      case 'A':
        for (let i = 0; i < args.length; i += 7)
          s += `${i ? ' ' : ''}${S(args[i]!)} ${S(args[i + 1]!)} ${args[i + 2]} ${args[i + 3]} ${args[i + 4]} ${X(args[i + 5]!)} ${Y(args[i + 6]!)}`
        break
      case 'Z':
        break
      default:
        throw new Error(`transformD: unsupported command ${cmd}`)
    }
    out += cmd + s
  }
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      flush()
      cmd = t
      args = []
    } else args.push(Number(t))
  }
  flush()
  return out
}
