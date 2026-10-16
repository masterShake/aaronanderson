import 'server-only'
import type { DrawingBuilder, LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import {
  STILL_K,
  docsBuilder,
  frameNodes,
  isoPrintDoc,
  modelBounds,
  pencil,
  partsNodes,
} from '@/drawings/render'
import { group } from '@/drawings/render/cad'
import { planFrame } from '@/drawings/lib/frame'
import { primD, seedFrom, polyLength } from '@/drawings/lib/geometry'
import { fitIso, isoToViewBox, planToWorld } from '@/drawings/lib/iso'
import { toStillSvg } from '@/drawings/lib/svg-string'
import { placeSymbol } from '@/drawings/symbols'
import {
  S02_DESTS,
  S02_LAYOUT,
  S02_ROUTES,
  S02_TOOLS,
  ring,
  s02Glyph,
  s02LabelAt,
  s02Lamp,
  s02Model,
  type S02Lens,
  type S02Tool,
} from '@/drawings/views/s02'

/**
 * The S-02 drawing files (owner: svc-a), served by /drawings/[file]:
 *   s02.{family}.json             every layer, both revs ('plan' and 'print')
 *   s02.wide.print.still.svg      the wide still: the iso print, a packet arriving at each place
 *   s02.tall.plan.still.svg       the tall still: the finished plan (the print is too small there)
 *
 * Layers of 'plan': l-panel (the deep panel the scan reveals), l-ghost (the pencil sketch:
 * tool boxes with their glyphs and the hand-carry line, erased by the scan and gone once the
 * conduits are in), l-pencil (the carrier), l-cad (planFrame of the model: enclosures with
 * their glyphs, conduits, flange ticks; the hand-off frame, identical in WebGL), l-pkt
 * (packets and lamps, moved by the controller). 'print' is l-iso. Draw-on windows come from
 * S02Figure.module.css, keyed by the w-* classes and each path's --i.
 */

const SEED = 202
const node = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})
const rough = (
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: 'box' | 'line' = 'box',
) => pencil(prims, { seed: seedFrom(seed), preset }).map((s) => node(s.d, s.len, part, i, cls))
// draw-on eases in and out (e-machine is the cubic smoothstep)
const PENCIL = 'draw pv e-machine p-035 i-pencil'
const DETAIL = 'draw pv e-machine p-025 i-pencil'

function planDoc(family: LayoutId): SvgDoc {
  const l = S02_LAYOUT[family]
  const [, , W, H] = l.viewBox
  const seed = (id: string) => `s02:${SEED}:${family}:${id}`

  const panel = [node(`M0 0H${W}V${H}H0Z`, 0, 'panel', 0, 'f-deep')]

  // The pencil sketch: each tool's box, then its glyph, staggered by --i.
  const sketch: SvgNode[] = []
  S02_TOOLS.forEach((t, i) => {
    const [x, y, w, h] = l.boxes[t]
    const kids = [
      node(primD({ t: 'rect', at: [x, y], size: [w, h] }), 0, t, i, 'pv fade w-sk f-paper'),
      ...rough([{ t: 'rect', at: [x, y], size: [w, h] }], seed(t), t, i, `${PENCIL} w-sk`),
    ]
    s02Glyph(l, t).forEach((pts, j) =>
      kids.push(...rough([{ t: 'poly', pts }], seed(`${t}.g${j}`), t, i, `${DETAIL} w-sr`, 'line')),
    )
    sketch.push(group(t, kids))
  })
  const carry: Prim = { t: 'poly', pts: l.carry }
  sketch.push(
    group('carry', [
      node(
        primD(carry),
        polyLength(l.carry),
        'carry',
        0,
        'pv fade w-hc p-035 i-pencil d-hand-carry',
      ),
    ]),
  )

  const person = partsNodes(
    placeSymbol('fig.carrying-paper', l.walkFrom, { prefix: 'carrier', k: l.carrierK }),
    { variant: 'pencil', seed: seed('carrier'), i: 0, ink: 'pencil' },
  )
  const walker: SvgNode = {
    el: 'g',
    cls: 'pv walker',
    part: 'carrier',
    children: [{ el: 'g', cls: 'pv step', children: person }],
  }

  const model = s02Model(family)
  const order: Record<string, number> = {
    'pipe.lead': 0,
    'pipe.est': 1,
    'pipe.pm': 1,
    'pipe.acct': 1,
    'flange.crm': 0,
    'flange.est': 1,
    'flange.pm': 1,
    'flange.acct': 1,
  }
  const cad = frameNodes(planFrame(model)).map((n) => {
    if (n.el !== 'path') return n
    if (n.part.startsWith('pipe.'))
      return { ...n, i: order[n.part]!, cls: `${n.cls} pv e-machine w-cd` }
    // the junction arrives with the conduits it joins
    if (n.part === 'tee')
      return { ...n, i: 1, cls: `${n.cls.replace('draw', '')} pv fade w-cd`.trim() }
    if (n.part.startsWith('flange.'))
      return { ...n, i: order[n.part]!, cls: `${n.cls.replace('draw', '')} pv pop w-fl`.trim() }
    return n
  })

  const pkt: SvgNode[] = []
  for (const r of S02_ROUTES) {
    const prim: Prim = { t: 'poly', pts: l.routes[r], r: l.fillet }
    pkt.push(
      node(
        primD(prim),
        polyLength(l.routes[r], false, l.fillet),
        `pk.${r}`,
        0,
        'pk p-100 i-orange',
      ),
    )
  }
  for (const d of S02_DESTS) {
    const c = s02Lamp(l, d)
    pkt.push(
      node(
        primD({ t: 'poly', pts: ring(c, l.flangeR * 0.6, 12), closed: true }),
        0,
        `lamp.${d}`,
        0,
        'lamp f-orange',
      ),
    )
  }

  return {
    viewBox: l.viewBox,
    groups: [
      { layer: 'panel', rev: 'plan', children: panel },
      { layer: 'ghost', rev: 'plan', children: sketch },
      { layer: 'pencil', rev: 'plan', children: [walker] },
      { layer: 'cad', rev: 'plan', children: cad },
      { layer: 'pkt', rev: 'plan', children: pkt },
    ],
  }
}

const isoFit = (family: LayoutId) => {
  const l = S02_LAYOUT[family]
  const model = s02Model(family)
  const fit = fitIso(l.viewBox, l.viewBox[2], l.viewBox[3], modelBounds(model))
  return (p: Pt, z: number) => isoToViewBox(planToWorld(p, z), l.viewBox, fit)
}

/**
 * The iso print (l-iso), with one packet arriving at each place. Each tool's glyph is drawn
 * on its enclosure's top, right after that top face, so a nearer enclosure still covers it.
 */
function printDoc(family: LayoutId): SvgDoc {
  const l = S02_LAYOUT[family]
  const model = s02Model(family)
  const solid = { ...model, parts: model.parts.filter((p) => !p.id.startsWith('glyph.')) }
  const doc = isoPrintDoc(solid, { viewBox: l.viewBox })
  const P = isoFit(family)
  const glyphs = (t: S02Tool): SvgNode[] =>
    s02Glyph(l, t).map((pts, j) =>
      node(
        `M${pts
          .map((q) => P(q, l.heights[t]))
          .map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`)
          .join('L')}`,
        0,
        `glyph.${t}`,
        j,
        'p-035 i-cad',
      ),
    )
  const beads = S02_DESTS.map((d, i) => {
    const end = l.routes[d][l.routes[d].length - 1]!
    const a = P([end[0] - l.flangeIn - 22, end[1]], l.pipeY)
    const b = P([end[0] - l.flangeIn - 10, end[1]], l.pipeY)
    return node(
      `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`,
      12,
      `bead.${d}`,
      i,
      'p-100 i-orange',
    )
  })
  return {
    viewBox: l.viewBox,
    groups: doc.groups.map((g) => {
      const kids: SvgNode[] = []
      for (const c of g.children) {
        kids.push(c)
        // right after each enclosure's top face (alu-100), its glyph
        if (c.el === 'path' && c.part.startsWith('box.') && c.cls.includes('f-alu-100'))
          kids.push(...glyphs(c.part.slice(4) as S02Tool))
      }
      return { ...g, rev: 'print', children: [...kids, ...beads] }
    }),
  }
}

const docs = docsBuilder(
  (family, rev) => (rev === 'print' ? printDoc(family) : planDoc(family)),
  [
    { rev: 'plan', ground: 'deep' },
    { rev: 'print', ground: 'deep' },
  ],
)

/** The tall still: the finished plan (panel and CAD only: no sketch, carrier or packets). */
function tallStill(): string {
  const plan = docs.doc('tall', 'plan')
  return toStillSvg(
    { ...plan, groups: plan.groups.filter((g) => g.layer === 'panel' || g.layer === 'cad') },
    { k: STILL_K.tall, ground: 'deep', remap: { panel: 'deep' } },
  )
}

export const drawing: DrawingBuilder = {
  files: docs.files,
  build(file) {
    if (file === 'tall.plan.still.svg') return tallStill()
    return docs.build(file)
  },
}

/** Route lengths per family, for the controller's packets. */
export function s02Lens(family: LayoutId): S02Lens {
  const l = S02_LAYOUT[family]
  const len = (r: (typeof S02_ROUTES)[number]) => polyLength(l.routes[r], false, l.fillet)
  return { lead: len('lead'), est: len('est'), pm: len('pm'), acct: len('acct') }
}

/**
 * Where each box's label lands on the iso print (viewBox units): on the enclosure's top,
 * in its back half, clear of the glyph in the front half.
 */
export function s02PrintAnchors(family: LayoutId): Record<S02Tool, Pt> {
  const l = S02_LAYOUT[family]
  const P = isoFit(family)
  const out = {} as Record<S02Tool, Pt>
  for (const t of S02_TOOLS) out[t] = P(s02LabelAt(l, t), l.heights[t])
  return out
}
