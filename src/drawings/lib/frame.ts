import type { Ink, ModelPart, ModelSpec, Pen, Prim, Pt, ViewBox } from '../types'
import { bounds, primPts } from './geometry'
import { inRev } from './route'

/**
 * The single hand-off frame. planFrame() and frontFrame() turn a ModelSpec
 * into flat linework (polylines with pen, ink and opacity, plus filled
 * outlines). render/cad.ts draws it as SVG, and the scenes draw the same frame
 * as Line2 at the plan (or front) pose, so the swap from SVG to WebGL happens
 * on identical geometry. Isomorphic: no roughjs, no three, no DOM.
 */

export interface FrameLine {
  id: string
  pts: readonly Pt[]
  closed: boolean
  pen: Pen
  ink: Ink
  opacity: number
  /** Fillet radius for the SVG path (Line2 draws the corner points). */
  r?: number
  dash?: 'hidden' | 'center'
}

export interface FrameFill {
  id: string
  pts: readonly Pt[]
  /** A token name: 'deep' (blueprint-deep), 'paper', 'orange', … */
  ink: string
  opacity: number
}

export interface Frame {
  pose: 'plan' | 'front'
  viewBox: ViewBox
  fills: readonly FrameFill[]
  lines: readonly FrameLine[]
  /** Label anchors (part.anchor keys) in viewBox units. */
  anchors: Readonly<Record<string, Pt>>
}

const PEN_OF: Readonly<Record<ModelPart['kind'], Pen>> = {
  box: '050',
  cyl: '050',
  tank: '050',
  pipe: '070',
  flange: '050',
  valve: '050',
  card: '035',
  slot: '035',
}

const inkOf = (p: ModelPart): Ink =>
  p.material === 'orange' ? 'orange' : p.material === 'line' ? 'cyan-dim' : 'cyan'

const solid = (p: ModelPart) => p.kind !== 'pipe' && p.material !== 'line'

function outline(prim: Prim): { pts: Pt[]; closed: boolean; r?: number } {
  switch (prim.t) {
    case 'rect':
      return { pts: primPts(prim), closed: true }
    case 'circle':
      return { pts: primPts(prim, 48), closed: true }
    case 'poly':
      return { pts: [...prim.pts], closed: prim.closed ?? false, ...(prim.r ? { r: prim.r } : {}) }
    default:
      return { pts: primPts(prim), closed: false }
  }
}

const parts = (spec: ModelSpec, rev?: string) => spec.parts.filter((p) => !rev || inRev(p, rev))

/** The plan view of a model: each part's footprint, as drawn in the SVG plan and the 3D plan pose. */
export function planFrame(spec: ModelSpec, rev?: string): Frame {
  const fills: FrameFill[] = []
  const lines: FrameLine[] = []
  const anchors: Record<string, Pt> = {}
  for (const p of parts(spec, rev)) {
    p.prims.forEach((prim, i) => {
      const o = outline(prim)
      const id = p.prims.length > 1 ? `${p.id}.${i}` : p.id
      if (solid(p) && o.closed)
        fills.push({ id, pts: o.pts, ink: p.material === 'orange' ? 'orange' : 'deep', opacity: 1 })
      lines.push({
        id,
        pts: o.pts,
        closed: o.closed,
        pen: PEN_OF[p.kind],
        ink: inkOf(p),
        opacity: p.material === 'line' ? 0.55 : 1,
        ...(o.r ? { r: o.r } : {}),
      })
    })
    if (p.anchor) {
      const [x, y, w, h] = bounds(p.prims.flatMap((q) => primPts(q)))
      anchors[p.anchor] = [x + w / 2, y + h / 2]
    }
  }
  return { pose: 'plan', viewBox: spec.viewBox, fills, lines, anchors }
}

/**
 * The front elevation (S-03, section A–A): each part's x extent from z to
 * z + depth, with height measured up from the bottom of the viewBox.
 */
export function frontFrame(spec: ModelSpec, rev?: string): Frame {
  const [, vy, , vh] = spec.viewBox
  const base = vy + vh
  const fills: FrameFill[] = []
  const lines: FrameLine[] = []
  const anchors: Record<string, Pt> = {}
  for (const p of parts(spec, rev)) {
    const [x, , w] = bounds(p.prims.flatMap((q) => primPts(q)))
    const z0 = p.z ?? 0
    const top = base - (z0 + p.depth)
    const bottom = base - z0
    const pts: Pt[] = [
      [x, top],
      [x + w, top],
      [x + w, bottom],
      [x, bottom],
    ]
    if (solid(p))
      fills.push({ id: p.id, pts, ink: p.material === 'orange' ? 'orange' : 'deep', opacity: 1 })
    lines.push({ id: p.id, pts, closed: true, pen: PEN_OF[p.kind], ink: inkOf(p), opacity: 1 })
    if (p.anchor) anchors[p.anchor] = [x + w / 2, (top + bottom) / 2]
  }
  return { pose: 'front', viewBox: spec.viewBox, fills, lines, anchors }
}
