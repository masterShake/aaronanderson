import type { Prim, Pt } from '../types'
import { primPts } from './geometry'

/**
 * Label collision check (_finish B5, kit M4), usable in unit tests and in
 * Playwright (pure; no DOM). Give it a figure state: the label boxes and the
 * drawing's edges, in one coordinate space (viewBox units, or CSS px from
 * getBoundingClientRect), and it reports:
 *   - label/label: two labels overlap;
 *   - label/edge:  a drawn line crosses a label;
 *   - label/frame: a label leaves the frame.
 * A label may sit inside its own object: edges whose id is the label's
 * `owner` are skipped unless they cross the label itself.
 */

export interface LabelBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Edge id (or id prefix ending in '.') of the object this label names. */
  owner?: string
}

export interface Edge {
  id: string
  a: Pt
  b: Pt
}

export interface Overlap {
  kind: 'label-label' | 'label-edge' | 'label-frame'
  a: string
  b: string
}

export interface CollideOptions {
  /** Clearance each label needs around its text (default 0). */
  pad?: number
}

type Box = { x: number; y: number; w: number; h: number }

const grow = (r: Box, p: number): Box => ({
  x: r.x - p,
  y: r.y - p,
  w: r.w + 2 * p,
  h: r.h + 2 * p,
})

const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Does segment a–b pass through the open rect r (Liang–Barsky)? */
export function segmentHitsBox(a: Pt, b: Pt, r: Box): boolean {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q > 0
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
    return true
  }
  const ok =
    clip(-dx, a[0] - r.x) &&
    clip(dx, r.x + r.w - a[0]) &&
    clip(-dy, a[1] - r.y) &&
    clip(dy, r.y + r.h - a[1])
  // a strictly positive length inside the rect (touching an edge is not a hit)
  return ok && t1 - t0 > 1e-9 && (t1 - t0) * Math.hypot(dx, dy) > 1e-6
}

/** The straight edges of primitives (curves are flattened), tagged with an id. */
export function edgesOf(id: string, prims: readonly Prim[]): Edge[] {
  const out: Edge[] = []
  for (const p of prims) {
    const pts = p.t === 'line' ? [p.a, p.b] : primPts(p, 24)
    const closed = p.t === 'rect' || p.t === 'circle' || (p.t === 'poly' && p.closed)
    const n = pts.length
    for (let i = 1; i < n + (closed ? 1 : 0); i++) out.push({ id, a: pts[i - 1]!, b: pts[i % n]! })
  }
  return out
}

const owns = (owner: string | undefined, edge: string) =>
  !!owner && (edge === owner || (owner.endsWith('.') && edge.startsWith(owner)))

/**
 * Every overlap in one figure state. Label/label pairs are reported once
 * (a < b in input order); label/edge once per label and edge id.
 */
export function labelCollisions(
  state: { labels: readonly LabelBox[]; edges?: readonly Edge[]; frame?: Box },
  o: CollideOptions = {},
): Overlap[] {
  const pad = o.pad ?? 0
  const out: Overlap[] = []
  const L = state.labels
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++)
      if (boxesOverlap(grow(L[i]!, pad), L[j]!))
        out.push({ kind: 'label-label', a: L[i]!.id, b: L[j]!.id })
  for (const l of L) {
    const r = grow(l, pad)
    const seen = new Set<string>()
    for (const e of state.edges ?? []) {
      if (seen.has(e.id)) continue
      if (owns(l.owner, e.id) && !segmentHitsBox(e.a, e.b, l)) continue
      if (segmentHitsBox(e.a, e.b, r)) {
        seen.add(e.id)
        out.push({ kind: 'label-edge', a: l.id, b: e.id })
      }
    }
    const f = state.frame
    if (f && (l.x < f.x || l.y < f.y || l.x + l.w > f.x + f.w || l.y + l.h > f.y + f.h))
      out.push({ kind: 'label-frame', a: l.id, b: 'frame' })
  }
  return out
}
