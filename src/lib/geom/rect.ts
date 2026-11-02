import type { Inch } from '@/lib/units'

export type Vec2 = readonly [x: Inch, y: Inch]
/** Axis-aligned rectangle, x0 < x1 and y0 < y1. */
export type Rect = readonly [x0: Inch, y0: Inch, x1: Inch, y1: Inch]
export type Axis = 'x' | 'y'

export const width = (r: Rect): Inch => r[2] - r[0]
export const height = (r: Rect): Inch => r[3] - r[1]
export const area = (r: Rect): number => width(r) * height(r)
export const center = (r: Rect): Vec2 => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]

/** The long side of a wall-like rectangle: 'x' for E–W, 'y' for N–S. */
export const longAxis = (r: Rect): Axis => (width(r) >= height(r) ? 'x' : 'y')

/** Open interior test: points on the boundary are outside. */
export const containsOpen = (r: Rect, [x, y]: Vec2): boolean =>
  x > r[0] && x < r[2] && y > r[1] && y < r[3]

export const containsClosed = (r: Rect, [x, y]: Vec2): boolean =>
  x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]

/** Rectangle `inner` lies inside `outer` (boundaries may touch). */
export const insideRect = (inner: Rect, outer: Rect, tol = 0): boolean =>
  inner[0] >= outer[0] - tol &&
  inner[1] >= outer[1] - tol &&
  inner[2] <= outer[2] + tol &&
  inner[3] <= outer[3] + tol

/** Interiors overlap (touching edges do not count). */
export const overlaps = (a: Rect, b: Rect): boolean =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

export const intersection = (a: Rect, b: Rect): Rect | null =>
  overlaps(a, b)
    ? [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]
    : null

export const bounds = (rects: readonly Rect[]): Rect => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r[0])
    y0 = Math.min(y0, r[1])
    x1 = Math.max(x1, r[2])
    y1 = Math.max(y1, r[3])
  }
  return [x0, y0, x1, y1]
}

export const boundsOfPoints = (pts: readonly Vec2[]): Rect =>
  bounds(pts.map(([x, y]) => [x, y, x, y] as const))

export const expand = (r: Rect, d: Inch): Rect => [r[0] - d, r[1] - d, r[2] + d, r[3] + d]

export const translate = (r: Rect, dx: Inch, dy: Inch): Rect => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]

/** The four corners counter-clockwise from (x0, y0). */
export const corners = (r: Rect): Vec2[] => [
  [r[0], r[1]],
  [r[2], r[1]],
  [r[2], r[3]],
  [r[0], r[3]],
]

/** Interval of `r` along an axis, and across it. */
export const along = (r: Rect, axis: Axis): readonly [Inch, Inch] =>
  axis === 'x' ? [r[0], r[2]] : [r[1], r[3]]
export const across = (r: Rect, axis: Axis): readonly [Inch, Inch] =>
  axis === 'x' ? [r[1], r[3]] : [r[0], r[2]]

/** Build a rectangle from intervals along and across an axis. */
export const fromAxis = (axis: Axis, s: readonly [Inch, Inch], t: readonly [Inch, Inch]): Rect =>
  axis === 'x' ? [s[0], t[0], s[1], t[1]] : [t[0], s[0], t[1], s[1]]

/** Split `r` along `axis` by removing the given intervals (assumed sorted, inside, disjoint). */
export function subtractIntervals(r: Rect, axis: Axis, cuts: readonly (readonly [Inch, Inch])[]): Rect[] {
  const [s0, s1] = along(r, axis)
  const t = across(r, axis)
  const pieces: Rect[] = []
  let cursor = s0
  for (const [c0, c1] of [...cuts].sort((a, b) => a[0] - b[0])) {
    if (c0 > cursor) pieces.push(fromAxis(axis, [cursor, c0], t))
    cursor = Math.max(cursor, c1)
  }
  if (s1 > cursor) pieces.push(fromAxis(axis, [cursor, s1], t))
  return pieces
}

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(b[0] - a[0], b[1] - a[1])

export const lerp2 = (a: Vec2, b: Vec2, k: number): Vec2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
