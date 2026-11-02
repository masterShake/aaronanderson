import { containsOpen, type Rect, type Vec2 } from '@/lib/geom/rect'

/**
 * One straight piece of a region's boundary. The region lies on the LEFT of a → b, so outer
 * boundaries run counter-clockwise and holes run clockwise. `owner` indexes the solid that the
 * region side of the piece belongs to.
 */
export interface OutlinePiece {
  a: Vec2
  b: Vec2
  owner: number
}

/** Off-grid probe distance: every coordinate is a multiple of 1/16″, so ±1/64″ never lands on an edge. */
const EPS = 1 / 64

/**
 * Exact boundary of (∪ solids) − (∪ cuts) for axis-aligned rectangles. Every boundary edge lies
 * on some rectangle edge, so it is enough to test each elementary span between neighbouring
 * breakpoints: it is boundary iff the region test differs on its two sides. Solids must not
 * overlap (walls never do), so each piece has exactly one owner.
 */
export function outline(solids: readonly Rect[], cuts: readonly Rect[] = []): OutlinePiece[] {
  const xs = uniqueSorted([...solids, ...cuts].flatMap((r) => [r[0], r[2]]))
  const ys = uniqueSorted([...solids, ...cuts].flatMap((r) => [r[1], r[3]]))
  const inside = (p: Vec2) => solids.some((r) => containsOpen(r, p)) && !cuts.some((c) => containsOpen(c, p))
  const ownerAt = (p: Vec2) => solids.findIndex((r) => containsOpen(r, p))

  const pieces: OutlinePiece[] = []
  for (const y of ys) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const xm = (xs[i] + xs[i + 1]) / 2
      const above = inside([xm, y + EPS])
      if (above === inside([xm, y - EPS])) continue
      // Walking +x keeps +y on the left.
      pieces.push(
        above
          ? { a: [xs[i], y], b: [xs[i + 1], y], owner: ownerAt([xm, y + EPS]) }
          : { a: [xs[i + 1], y], b: [xs[i], y], owner: ownerAt([xm, y - EPS]) },
      )
    }
  }
  for (const x of xs) {
    for (let i = 0; i + 1 < ys.length; i++) {
      const ym = (ys[i] + ys[i + 1]) / 2
      const left = inside([x - EPS, ym])
      if (left === inside([x + EPS, ym])) continue
      // Walking +y keeps −x on the left.
      pieces.push(
        left
          ? { a: [x, ys[i]], b: [x, ys[i + 1]], owner: ownerAt([x - EPS, ym]) }
          : { a: [x, ys[i + 1]], b: [x, ys[i]], owner: ownerAt([x + EPS, ym]) },
      )
    }
  }
  return mergeCollinear(pieces)
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

/** Join pieces that continue each other on the same line, in the same direction, with the same owner. */
function mergeCollinear(pieces: OutlinePiece[]): OutlinePiece[] {
  const byStart = new Map<string, OutlinePiece>()
  const key = (p: Vec2, dir: string, owner: number) => `${p[0]},${p[1]},${dir},${owner}`
  const dirOf = (q: OutlinePiece) => `${Math.sign(q.b[0] - q.a[0])},${Math.sign(q.b[1] - q.a[1])}`
  for (const q of pieces) byStart.set(key(q.a, dirOf(q), q.owner), q)

  const consumed = new Set<OutlinePiece>()
  const merged: OutlinePiece[] = []
  // Starting pieces are those with no predecessor ending at their start.
  const hasPredecessor = new Set<OutlinePiece>()
  for (const q of pieces) {
    const next = byStart.get(key(q.b, dirOf(q), q.owner))
    if (next) hasPredecessor.add(next)
  }
  for (const q of pieces) {
    if (hasPredecessor.has(q) || consumed.has(q)) continue
    let end = q
    consumed.add(q)
    for (;;) {
      const next = byStart.get(key(end.b, dirOf(q), q.owner))
      if (!next || consumed.has(next)) break
      consumed.add(next)
      end = next
    }
    merged.push({ a: q.a, b: end.b, owner: q.owner })
  }
  return merged
}

/** Length of an axis-aligned piece. */
export const pieceLength = (q: OutlinePiece): number => Math.abs(q.b[0] - q.a[0]) + Math.abs(q.b[1] - q.a[1])
