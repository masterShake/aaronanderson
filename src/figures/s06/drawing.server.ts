import 'server-only'
import type { LayoutId, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { docsBuilder, frameNodes, isoPrintDoc, modelBounds } from '@/drawings/render'
import { planFrame } from '@/drawings/lib/frame'
import { fitIso, isoToViewBox, planToWorld } from '@/drawings/lib/iso'
import { num } from '@/drawings/lib/geometry'
import { buildS06Model, partTop, S06_VIEWBOX, type S06Model } from '@/drawings/views/s06'

/**
 * The s06 drawing files served by /drawings/[file] (owner: hero):
 *   s06.{family}.json            the plan (panel + CAD frame) and the iso print, as layers
 *   s06.{family}.plan.still.svg  the rewired plan on blueprint-deep
 *   s06.{family}.print.still.svg the iso print with every month added (the still tier)
 * The print adds the monitor's dial on the gauge's top face: a paper face, nine ticks, a
 * needle in the blue IN RANGE arc (the same dial the WebGL scene draws).
 */

/** The dial on the gauge's top face, projected like the print. */
function dialNodes(m: S06Model, family: LayoutId, first: number): SvgNode[] {
  const vb = S06_VIEWBOX[family]
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(m.spec))
  const gauge = m.spec.parts.find((p) => p.id === 'gauge')!
  const prim = gauge.prims[0]!
  const R = prim.t === 'circle' ? prim.r * 0.82 : 10
  const { c, z } = partTop(gauge)
  const P = (deg: number, k: number): Pt => {
    const a = (deg * Math.PI) / 180
    return isoToViewBox(
      planToWorld([c[0] + Math.sin(a) * R * k, c[1] - Math.cos(a) * R * k], z),
      vb,
      fit,
    )
  }
  const d = (pts: readonly Pt[], closed = false) =>
    `M${pts.map((q) => `${num(q[0])} ${num(q[1])}`).join('L')}${closed ? 'Z' : ''}`
  const seg = (a: Pt, b: Pt) => `M${num(a[0])} ${num(a[1])}L${num(b[0])} ${num(b[1])}`
  const ring = Array.from({ length: 32 }, (_, i) => P(i * 11.25, 1))
  const ticks = Array.from({ length: 9 }, (_, i) =>
    seg(P(-120 + i * 30, 0.8), P(-120 + i * 30, 0.98)),
  )
  const arc = Array.from({ length: 9 }, (_, i) => P(-40 + i * 10, 0.6))
  const node = (dd: string, i: number, cls: string): SvgNode => ({
    el: 'path',
    d: dd,
    len: 0,
    part: 'gauge.dial',
    i: first + i,
    cls,
  })
  return [
    node(d(ring, true), 0, 'f-paper p-018 i-asphalt'),
    node(d(arc), 1, 'p-070 i-cad'),
    node(ticks.join('') + seg(P(0, 0), P(14, 0.72)), 2, 'p-025 i-asphalt'),
  ]
}

function make(family: LayoutId, rev: string): SvgDoc {
  const m = buildS06Model(family)
  const vb = S06_VIEWBOX[family]
  if (rev === 'print') {
    const iso = isoPrintDoc(m.spec)
    return {
      viewBox: vb,
      groups: iso.groups.map((g) => ({
        ...g,
        rev,
        children: [...g.children, ...dialNodes(m, family, g.children.length)],
      })),
    }
  }
  return {
    viewBox: vb,
    groups: [
      {
        layer: 'panel',
        rev,
        children: [
          {
            el: 'path',
            d: `M0 0H${vb[2]}V${vb[3]}H0Z`,
            len: 0,
            part: 'panel',
            i: 0,
            cls: 'f-deep',
          },
        ],
      },
      { layer: 'cad', rev, children: frameNodes(planFrame(m.spec)) },
    ],
  }
}

export const drawing = docsBuilder(make, [
  { rev: 'plan', ground: 'deep' },
  { rev: 'print', ground: 'deep' },
])
