import type { Part, Prim, Pt, SvgNode } from '../types'
import type { Frame } from '../lib/frame'
import { primD } from '../lib/geometry'
import { primLength } from '../lib/length'
import { pencil } from './pencil'
import { seedFrom } from '../lib/geometry'
import type { PresetId } from '../kit/rough'

/**
 * The clean CAD layer: primitives as exact paths (right-angle routes with
 * 12-unit bends come from lib/route), port circles, and planFrame() drawn as
 * SVG. Also turns symbol Parts into SvgNodes in either variant.
 */

export interface CadPath {
  d: string
  len: number
}

/** One clean path for a list of primitives. */
export function cad(prims: readonly Prim[]): CadPath {
  return {
    d: prims.map(primD).join(''),
    len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  }
}

/** The class list for a stroke. */
export function strokeCls(o: {
  pen?: Part['pen']
  ink?: string
  fill?: string
  draw?: boolean
  dash?: string
  extra?: string
}): string {
  return [
    o.draw === false ? '' : 'draw',
    o.pen ? `p-${o.pen}` : '',
    o.pen && o.ink ? `i-${o.ink}` : '',
    o.fill && o.fill !== 'none' ? `f-${o.fill}` : '',
    o.dash ? `d-${o.dash}` : '',
    o.extra ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

const pathNode = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})

/** A group of nodes for one drawing element (a tool, a route), so CSS can highlight it. */
export const group = (part: string, children: readonly SvgNode[], cls?: string): SvgNode => ({
  el: 'g',
  part,
  ...(cls ? { cls } : {}),
  children,
})

/** Port circles (r = 3, filled with the panel) at each point. */
export function portCircles(pts: readonly Pt[], part: string, i: number, ink = 'cyan'): SvgNode[] {
  return pts.map((c, j) =>
    pathNode(
      primD({ t: 'circle', c, r: 3 }),
      2 * Math.PI * 3,
      `${part}.port${j}`,
      i,
      strokeCls({ pen: '035', ink, fill: 'panel', draw: false }),
    ),
  )
}

/**
 * Symbol parts as SVG nodes. 'clean' draws exact paths; 'pencil' roughens the
 * same primitives (seeded per part) and keeps a clean fill underneath.
 */
export function partsNodes(
  parts: readonly Part[],
  o: { variant: 'clean' | 'pencil'; seed: string; i: number; preset?: PresetId; ink?: string },
): SvgNode[] {
  const out: SvgNode[] = []
  for (const p of parts) {
    const ink = o.ink ?? p.ink
    if (p.fill && p.fill !== 'none') {
      const f = cad(p.prims)
      out.push(pathNode(f.d, f.len, p.id, o.i, strokeCls({ fill: p.fill, draw: false })))
    }
    if (o.variant === 'clean' || p.clean) {
      const c = cad(p.prims)
      out.push(pathNode(c.d, c.len, p.id, o.i, strokeCls({ pen: p.pen, ink, dash: p.dash })))
    } else {
      for (const s of pencil(p.prims, {
        seed: seedFrom(`${o.seed}:${p.id}`),
        preset: o.preset ?? 'detail',
      }))
        out.push(pathNode(s.d, s.len, p.id, o.i, strokeCls({ pen: p.pen, ink, dash: p.dash })))
    }
  }
  return out
}

/** planFrame()/frontFrame() as SVG nodes: filled outlines, then lines (draw-on paths). */
export function frameNodes(frame: Frame): SvgNode[] {
  const fills = frame.fills.map((f, i) =>
    pathNode(
      primD({ t: 'poly', pts: f.pts, closed: true }),
      0,
      f.id,
      i,
      strokeCls({ fill: f.ink, draw: false }),
    ),
  )
  const lines = frame.lines.map((l, i) => {
    const prim: Prim = { t: 'poly', pts: l.pts, closed: l.closed, ...(l.r ? { r: l.r } : {}) }
    return pathNode(
      primD(prim),
      primLength(prim),
      l.id,
      i,
      strokeCls({ pen: l.pen, ink: l.ink, dash: l.dash, extra: l.opacity < 1 ? 'o-55' : '' }),
    )
  })
  return [...fills, ...lines]
}
