import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import {
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
import { placeSymbol } from '@/drawings/symbols'
import {
  S02_DESTS,
  S02_LAYOUT,
  S02_ROUTES,
  S02_TOOLS,
  ring,
  s02Model,
  type S02Lens,
  type S02Tool,
} from '@/drawings/views/s02'

/**
 * The S-02 drawing files (owner: scenes-a), served by /drawings/[file]:
 *   s02.{family}.json             every layer, both revs ('plan' and 'print')
 *   s02.{family}.print.still.svg  the still tier: the iso print, a packet arriving at each place
 * (s02.{family}.plan.still.svg is a by-product of docsBuilder and is not used.)
 *
 * Layers of 'plan': l-panel (the deep panel the scan reveals), l-ghost (the pencil sketch,
 * erased to its ghost by the scan), l-pencil (the carrier), l-cad (planFrame of the model:
 * the hand-off frame, identical in WebGL), l-pkt (packets and lamps, moved by the
 * controller). 'print' is l-iso. Draw-on windows come from S02Figure.module.css, keyed by
 * the w-* classes and each path's --i.
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
const rough = (prims: readonly Prim[], seed: string, part: string, i: number, cls: string) =>
  pencil(prims, { seed: seedFrom(seed), preset: 'box' }).map((s) => node(s.d, s.len, part, i, cls))
const PENCIL = 'draw pv p-035 i-pencil'

function planDoc(family: LayoutId): SvgDoc {
  const l = S02_LAYOUT[family]
  const [, , W, H] = l.viewBox
  const seed = (id: string) => `s02:${SEED}:${family}:${id}`

  const panel = [node(`M0 0H${W}V${H}H0Z`, 0, 'panel', 0, 'f-deep')]

  const sketch: SvgNode[] = []
  S02_TOOLS.forEach((t, i) => {
    const [x, y, w, h] = l.boxes[t]
    const kids = rough([{ t: 'rect', at: [x, y], size: [w, h] }], seed(t), t, i, `${PENCIL} w-sk`)
    l.rows.forEach(([fy, f0, f1], j) => {
      const a: Pt = [x + w * f0, y + h * fy]
      const b: Pt = [x + w * f1, y + h * fy]
      kids.push(...rough([{ t: 'line', a, b }], seed(`${t}.row${j}`), t, i, `${PENCIL} w-sr`))
    })
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

  const person = partsNodes(placeSymbol('fig.carrying-paper', l.walkFrom, { prefix: 'carrier' }), {
    variant: 'pencil',
    seed: seed('carrier'),
    i: 0,
    ink: 'pencil',
  })
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
    if (n.part.startsWith('pipe.')) return { ...n, i: order[n.part]!, cls: `${n.cls} pv w-cd` }
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
    const [x, y, w] = l.boxes[d]
    const c: Pt = [x + w - 18, y + 18]
    pkt.push(
      node(
        primD({ t: 'poly', pts: ring(c, 6, 12), closed: true }),
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

/** The iso print (l-iso), with one packet arriving at each place. */
function printDoc(family: LayoutId): SvgDoc {
  const l = S02_LAYOUT[family]
  const model = s02Model(family)
  const doc = isoPrintDoc(model, { viewBox: l.viewBox })
  const fit = fitIso(l.viewBox, l.viewBox[2], l.viewBox[3], modelBounds(model))
  const P = (p: Pt) => isoToViewBox(planToWorld(p, l.pipeY), l.viewBox, fit)
  const beads = S02_DESTS.map((d, i) => {
    const end = l.routes[d][l.routes[d].length - 1]!
    const a = P([end[0] - 34, end[1]])
    const b = P([end[0] - 22, end[1]])
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
    groups: doc.groups.map((g) => ({ ...g, rev: 'print', children: [...g.children, ...beads] })),
  }
}

export const drawing = docsBuilder(
  (family, rev) => (rev === 'print' ? printDoc(family) : planDoc(family)),
  [
    { rev: 'plan', ground: 'deep' },
    { rev: 'print', ground: 'deep' },
  ],
)

/** Route lengths per family, for the controller's packets. */
export function s02Lens(family: LayoutId): S02Lens {
  const l = S02_LAYOUT[family]
  const len = (r: (typeof S02_ROUTES)[number]) => polyLength(l.routes[r], false, l.fillet)
  return { lead: len('lead'), est: len('est'), pm: len('pm'), acct: len('acct') }
}

/** Where each box's top lands on the iso print (viewBox units), for the print labels. */
export function s02PrintAnchors(family: LayoutId): Record<S02Tool, Pt> {
  const l = S02_LAYOUT[family]
  const model = s02Model(family)
  const fit = fitIso(l.viewBox, l.viewBox[2], l.viewBox[3], modelBounds(model))
  const out = {} as Record<S02Tool, Pt>
  for (const t of S02_TOOLS) {
    const [x, y, w, h] = l.boxes[t]
    out[t] = isoToViewBox(planToWorld([x + w / 2, y + h / 2], l.heights[t]), l.viewBox, fit)
  }
  return out
}
