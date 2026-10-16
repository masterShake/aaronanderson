import 'server-only'
import type { DrawingBuilder, LayoutId, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { cad, docsBuilder, frameNodes, isoPrintDoc, modelBounds } from '@/drawings/render'
import { s06Glyphs } from '@/scenes/model/s06-data'
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
 * needle in the blue IN RANGE arc (the same dial the WebGL scene draws). The plan and the print
 * both carry each tool's glyph (s06Glyphs), as the WebGL decal and model do.
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

/**
 * The gauge's dial on the CAD plan (seen from above): an inner bezel ring, nine ticks and the
 * needle in range. It shows while the plan holds and fades out just before the hand-off
 * (s06.module.css), so the plan at p .15 still matches the WebGL decal line for line.
 */
function planDial(m: S06Model): SvgNode[] {
  const gauge = m.spec.parts.find((p) => p.id === 'gauge')
  const prim = gauge?.prims[0]
  if (prim?.t !== 'circle') return []
  const [cx, cy] = prim.c
  const P = (deg: number, k: number): Pt => {
    const a = (deg * Math.PI) / 180
    return [cx + Math.sin(a) * prim.r * k, cy - Math.cos(a) * prim.r * k]
  }
  const seg = (a: Pt, b: Pt) => `M${num(a[0])} ${num(a[1])}L${num(b[0])} ${num(b[1])}`
  const ring = Array.from({ length: 33 }, (_, i) => P(i * 11.25, 0.8))
  const node = (d: string, i: number, cls: string): SvgNode => ({
    el: 'path',
    d,
    len: 0,
    part: 'gauge.plan-dial',
    i,
    cls: `${cls} s06-pdial`,
  })
  return [
    node(`M${ring.map((q) => `${num(q[0])} ${num(q[1])}`).join('L')}`, 0, 'p-018 i-cyan'),
    node(
      Array.from({ length: 9 }, (_, i) => seg(P(-120 + i * 30, 0.56), P(-120 + i * 30, 0.72))).join(
        '',
      ) + seg(P(0, 0), P(14, 0.6)),
      1,
      'p-025 i-cyan',
    ),
  ]
}

const glyphD = (pts: readonly Pt[]) => `M${pts.map((q) => `${num(q[0])} ${num(q[1])}`).join('L')}`
const glyphInk = (id: string) => (id === 'glyph.report' ? 'asphalt' : null)

/** The tool glyphs on the CAD plan (cyan; dark on the orange report), drawn with their boxes. */
function planGlyphs(m: S06Model): SvgNode[] {
  return s06Glyphs(m.spec.parts).map((g) => {
    const c = cad([{ t: 'poly', pts: g.pts }])
    return {
      el: 'path',
      d: c.d,
      len: c.len,
      part: g.id,
      i: g.i,
      cls: `draw p-025 i-${glyphInk(g.id) ?? 'cyan'}`,
    }
  })
}

/** The tool glyphs on the print's box tops (blueprint on aluminium; dark on the orange report). */
function printGlyphs(m: S06Model, family: LayoutId, first: number): SvgNode[] {
  const vb = S06_VIEWBOX[family]
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(m.spec))
  const top = new Map(m.spec.parts.map((p) => [`glyph.${p.id}`, partTop(p).z]))
  return s06Glyphs(m.spec.parts).map((g, j) => ({
    el: 'path',
    d: glyphD(g.pts.map((q) => isoToViewBox(planToWorld(q, top.get(g.id) ?? 0), vb, fit))),
    len: 0,
    part: g.id,
    i: first + j,
    cls: `p-025 i-${glyphInk(g.id) ?? 'cad'}`,
  }))
}

function make(family: LayoutId, rev: string): SvgDoc {
  const m = buildS06Model(family)
  const vb = S06_VIEWBOX[family]
  if (rev === 'print') {
    const iso = isoPrintDoc(m.spec)
    return {
      viewBox: vb,
      groups: iso.groups.map((g) => {
        const dial = dialNodes(m, family, g.children.length)
        return {
          ...g,
          rev,
          children: [
            ...g.children,
            ...dial,
            ...printGlyphs(m, family, g.children.length + dial.length),
          ],
        }
      }),
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
      {
        layer: 'cad',
        rev,
        children: [...frameNodes(planFrame(m.spec)), ...planGlyphs(m), ...planDial(m)],
      },
    ],
  }
}

const MONTH = /^m[1-3](\.|$)/

/** The plan without the month instruments: the drawing at p = 0. */
function startOnly(nodes: readonly SvgNode[]): SvgNode[] {
  return nodes.flatMap((n): SvgNode[] => {
    if (n.part && MONTH.test(n.part)) return []
    if (n.el === 'path') return [n]
    const children = startOnly(n.children)
    return children.length ? [{ ...n, children }] : []
  })
}

const layers = docsBuilder(make, [
  { rev: 'plan', ground: 'deep' },
  { rev: 'print', ground: 'deep' },
])
const start = docsBuilder(
  (family) => {
    const d = make(family, 'plan')
    return { ...d, groups: d.groups.map((g) => ({ ...g, children: startOnly(g.children) })) }
  },
  [{ rev: 'start', ground: 'deep' }],
)

/** Plus s06.{family}.start.still.svg: the plan at p = 0, shown until the layers load. */
export const drawing: DrawingBuilder = {
  files: [...layers.files, 'wide.start.still.svg', 'tall.start.still.svg'],
  build: (file) => (file.includes('.start.') ? start.build(file) : layers.build(file)),
}
