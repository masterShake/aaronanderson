import type { DrawingBuilder, Graph, Layer, LayoutId, Prim, Pt, SvgDoc, SvgNode } from '../types'
import { firmGraph } from '../graphs/firm'
import { FIRM_CELL } from '../views/home'
import { primD } from '../lib/geometry'
import { primLength } from '../lib/length'
import { directionAt, inRev, nodeRect, routeGraph, type Routed } from '../lib/route'
import { isConnection } from '../lib/counts'
import { toStillSvg } from '../lib/svg-string'
import { strokeCls } from './cad'
import { graphDoc, type Medium } from './graph'
import {
  bundle as bundleOf,
  graphBuilder,
  mergeDocs,
  STILL_K,
  type DocsBuilder,
  type StateSpec,
} from './index'

/**
 * The example firm's drawing files (Home B; owner: home-about): as found in
 * pencil on paper, rewired in CAD on blueprint-deep. The pencil is erased
 * once rewired, so no ghost sits under the finished drawing (W4 finish A5).
 *
 * firmBuilder() is graphDoc plus the firm's own finish:
 * - every tool is a piece of equipment: its box gets a nameplate cell with a
 *   glyph for what it is (envelope, spreadsheet grid, folder, card file, Gantt
 *   bars, ledger, chart sheet, phone, time card, pay stub);
 * - rewired conduits get flanges at both joints and an orange packet stream
 *   on the l-pkt layer (left out of the stills);
 * - groups carry a role class (k-node, k-pipe, k-inst) so the figure's CSS
 *   can choreograph the As found → Rewired change.
 *
 * STOPGAP: the glyphs below stand in until the kit's tool-kind glyphs
 * (src/drawings/symbols, W4 kit M2) land at integration; then toolGlyph()
 * should defer to them and keep only the nameplate cell.
 */

export const FIRM_STATES: readonly StateSpec[] = [
  { rev: 'asFound', medium: 'pencil', ground: 'paper' },
  { rev: 'rewired', medium: 'cad', ground: 'deep' },
]

/** The kit's plain graph build of the firm (unit tests and other readers). */
export const firmDrawing = graphBuilder(firmGraph, FIRM_STATES)

type AnyGraph = Graph<string, string>

/** What a tool is, for its glyph. */
export type ToolGlyph =
  | 'envelope'
  | 'sheet'
  | 'folder'
  | 'cards'
  | 'gantt'
  | 'ledger'
  | 'chart'
  | 'phone'
  | 'timecard'
  | 'paystub'

export const FIRM_GLYPHS: Readonly<Record<string, ToolGlyph>> = {
  inbox: 'envelope',
  estimate: 'sheet',
  drive: 'folder',
  crm: 'cards',
  pm: 'gantt',
  accounting: 'ledger',
  report: 'chart',
  field: 'phone',
  timesheets: 'timecard',
  payroll: 'paystub',
}

export { FIRM_CELL }

const R = (v: number) => Math.round(v * 100) / 100

/** A glyph in unit space (-0.5 … 0.5), as outline prims and detail prims. */
function unitGlyph(kind: ToolGlyph): { outline: Prim[]; detail: Prim[] } {
  const rect = (x: number, y: number, w: number, h: number): Prim => ({
    t: 'rect',
    at: [x, y],
    size: [w, h],
  })
  const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a, b })
  const poly = (pts: Pt[], closed = false): Prim => ({ t: 'poly', pts, closed })
  switch (kind) {
    case 'envelope':
      return {
        outline: [rect(-0.5, -0.33, 1, 0.66)],
        detail: [
          poly([
            [-0.5, -0.33],
            [0, 0.06],
            [0.5, -0.33],
          ]),
          line([-0.5, 0.33], [-0.14, -0.02]),
          line([0.5, 0.33], [0.14, -0.02]),
        ],
      }
    case 'sheet':
      return {
        outline: [rect(-0.42, -0.42, 0.84, 0.84)],
        detail: [
          line([-0.42, -0.2], [0.42, -0.2]),
          line([-0.42, 0.02], [0.42, 0.02]),
          line([-0.42, 0.22], [0.42, 0.22]),
          line([-0.16, -0.42], [-0.16, 0.42]),
          line([0.13, -0.42], [0.13, 0.42]),
        ],
      }
    case 'folder':
      return {
        outline: [
          poly(
            [
              [-0.5, -0.36],
              [-0.12, -0.36],
              [-0.02, -0.24],
              [0.5, -0.24],
              [0.5, 0.36],
              [-0.5, 0.36],
            ],
            true,
          ),
        ],
        detail: [line([-0.5, -0.12], [0.5, -0.12])],
      }
    case 'cards':
      return {
        outline: [
          poly(
            [
              [-0.5, 0.02],
              [0.5, 0.02],
              [0.42, 0.4],
              [-0.42, 0.4],
            ],
            true,
          ),
        ],
        detail: [
          poly([
            [-0.3, 0.02],
            [-0.3, -0.42],
            [0.38, -0.42],
            [0.38, 0.02],
          ]),
          poly([
            [-0.4, 0.02],
            [-0.4, -0.28],
            [0.26, -0.28],
            [0.26, 0.02],
          ]),
          line([-0.3, -0.16], [0.14, -0.16]),
          line([-0.3, -0.06], [0.04, -0.06]),
          line([-0.16, 0.2], [0.16, 0.2]),
        ],
      }
    case 'gantt':
      return {
        outline: [line([-0.46, -0.44], [-0.46, 0.44]), line([-0.46, 0.44], [0.48, 0.44])],
        detail: [
          rect(-0.36, -0.36, 0.42, 0.14),
          rect(-0.12, -0.1, 0.46, 0.14),
          rect(0.12, 0.16, 0.34, 0.14),
        ],
      }
    case 'ledger':
      return {
        outline: [
          poly(
            [
              [0, -0.3],
              [-0.5, -0.38],
              [-0.5, 0.32],
              [0, 0.4],
              [0.5, 0.32],
              [0.5, -0.38],
            ],
            true,
          ),
        ],
        detail: [
          line([0, -0.3], [0, 0.4]),
          line([-0.38, -0.18], [-0.1, -0.14]),
          line([-0.38, -0.02], [-0.1, 0.02]),
          line([-0.38, 0.14], [-0.1, 0.18]),
          line([0.1, -0.14], [0.38, -0.18]),
          line([0.1, 0.02], [0.38, -0.02]),
          line([0.1, 0.18], [0.38, 0.14]),
        ],
      }
    case 'chart':
      return {
        outline: [
          poly(
            [
              [-0.38, -0.46],
              [0.2, -0.46],
              [0.38, -0.28],
              [0.38, 0.46],
              [-0.38, 0.46],
            ],
            true,
          ),
        ],
        detail: [
          poly([
            [0.2, -0.46],
            [0.2, -0.28],
            [0.38, -0.28],
          ]),
          line([-0.26, 0.32], [0.26, 0.32]),
          rect(-0.22, 0.08, 0.1, 0.24),
          rect(-0.05, -0.06, 0.1, 0.38),
          rect(0.12, -0.2, 0.1, 0.52),
        ],
      }
    case 'phone':
      return {
        outline: [{ t: 'poly', pts: rectPts(-0.26, -0.46, 0.52, 0.92), closed: true, r: 0.08 }],
        detail: [rect(-0.18, -0.34, 0.36, 0.58), { t: 'circle', c: [0, 0.35], r: 0.045 }],
      }
    case 'timecard':
      return {
        outline: [rect(-0.38, -0.46, 0.76, 0.92)],
        detail: [
          { t: 'circle', c: [0, -0.1], r: 0.24 },
          line([0, -0.1], [0, -0.26]),
          line([0, -0.1], [0.12, -0.04]),
          line([-0.26, 0.28], [0.26, 0.28]),
        ],
      }
    case 'paystub':
      return {
        outline: [rect(-0.5, -0.3, 1, 0.6)],
        detail: [
          rect(-0.42, -0.22, 0.84, 0.44),
          { t: 'circle', c: [0, 0], r: 0.13 },
          line([-0.32, -0.12], [-0.22, -0.12]),
          line([0.22, 0.12], [0.32, 0.12]),
        ],
      }
  }
}

function rectPts(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** Scale and move a unit-space prim to centre c with size s. */
function place(p: Prim, c: Pt, s: number): Prim {
  const pt = (q: Pt): Pt => [R(c[0] + q[0] * s), R(c[1] + q[1] * s)]
  switch (p.t) {
    case 'line':
      return { t: 'line', a: pt(p.a), b: pt(p.b) }
    case 'poly':
      return { ...p, pts: p.pts.map(pt), ...(p.r ? { r: R(p.r * s) } : {}) }
    case 'rect':
      return { t: 'rect', at: pt(p.at), size: [R(p.size[0] * s), R(p.size[1] * s)] }
    case 'circle':
      return { t: 'circle', c: pt(p.c), r: R(p.r * s) }
    default:
      return p
  }
}

/** A tool's glyph centred at c, s units across. */
export function toolGlyph(kind: ToolGlyph, c: Pt, s: number): { outline: Prim[]; detail: Prim[] } {
  const u = unitGlyph(kind)
  return {
    outline: u.outline.map((p) => place(p, c, s)),
    detail: u.detail.map((p) => place(p, c, s)),
  }
}

/** Flanges: a pair of short bars across a pipe, `back` units in from each end. */
export function flangePrims(pts: readonly Pt[], back = 9, half = 5.5): Prim[] {
  const out: Prim[] = []
  const len = pts.reduce(
    (s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) : 0),
    0,
  )
  if (len < back * 3) return out
  for (const [end, t] of [
    [pts[0]!, 0],
    [pts[pts.length - 1]!, 1],
  ] as const) {
    const d = directionAt(pts, t)
    const sign = t === 0 ? 1 : -1
    for (const k of [back, back + 3]) {
      const c: Pt = [end[0] + d[0] * k * sign, end[1] + d[1] * k * sign]
      out.push({
        t: 'line',
        a: [R(c[0] - d[1] * half), R(c[1] + d[0] * half)],
        b: [R(c[0] + d[1] * half), R(c[1] - d[0] * half)],
      })
    }
  }
  return out
}

const pathNode = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  cls,
})

/** The packet stream along a routed line (l-pkt): one path, dashed and moved by CSS. */
export function packetNode(r: Pick<Routed, 'prim' | 'len'>, part: string, i: number): SvgNode {
  return {
    el: 'path',
    d: primD(r.prim),
    len: Math.round(r.len * 100) / 100,
    part,
    i,
    cls: 'pk p-100 i-orange',
  }
}

/** One state of the firm in one family. */
export function firmDoc(
  g: AnyGraph,
  rev: string,
  family: LayoutId,
  medium: Medium,
  /** Element ids (people) left out of this family and state. */
  omit: readonly string[] = [],
): SvgDoc {
  const base = graphDoc(g, rev, family, { medium })
  const cad = medium === 'cad'
  const routed = routeGraph(g, rev, family, { bend: cad ? 12 : 0 })
  const nodes = new Map(g.nodes.filter((n) => inRev(n, rev)).map((n) => [n.id, n]))
  const cell = FIRM_CELL[family]
  const pkts: SvgNode[] = []
  const kept = base.groups[0]!.children.filter(
    (child) => !(child.el === 'g' && child.part && omit.includes(child.part)),
  )
  const children = kept.map((child): SvgNode => {
    if (child.el !== 'g' || !child.part || child.cls) return child
    const id = child.part
    const n = nodes.get(id)
    if (n?.kind === 'tool') {
      const rc = nodeRect(n, family)
      const kind = FIRM_GLYPHS[id]
      const i = (child.children[0] as { i?: number } | undefined)?.i ?? 0
      const x = rc.x + rc.w - cell
      const divider: Prim = { t: 'line', a: [R(x), R(rc.y + 6)], b: [R(x), R(rc.y + rc.h - 6)] }
      const s = Math.min(cell * 0.62, rc.h * 0.56)
      const gl = kind ? toolGlyph(kind, [x + cell / 2, rc.y + rc.h / 2], s) : null
      const ink = cad ? 'cyan' : 'pencil'
      const fill = cad ? 'panel' : 'paper'
      const extra: SvgNode[] = [
        pathNode(
          [divider],
          `${id}.plate`,
          i,
          strokeCls({ pen: '025', ink: cad ? 'cyan-dim' : 'pencil' }),
        ),
      ]
      if (gl) {
        extra.push(
          pathNode(gl.outline, `${id}.glyph`, i, strokeCls({ pen: '035', ink, fill })),
          pathNode(
            gl.detail,
            `${id}.glyph`,
            i,
            strokeCls({ pen: '025', ink: cad ? 'cyan-dim' : 'pencil' }),
          ),
        )
      }
      return { ...child, cls: 'k-node', children: [...child.children, ...extra] }
    }
    if (n) return { ...child, cls: 'k-inst' }
    const r = routed.get(id)
    if (!r) return child
    if (!isConnection(r.route)) return { ...child, cls: 'k-signal' }
    if (!cad) return { ...child, cls: 'k-pipe' }
    const i = (child.children[0] as { i?: number } | undefined)?.i ?? 0
    pkts.push({ el: 'g', part: id, children: [packetNode(r, id, i)] })
    return {
      ...child,
      cls: 'k-pipe',
      children: [
        ...child.children,
        pathNode(flangePrims(r.pts), `${id}.flange`, i, strokeCls({ pen: '050', ink: 'cyan' })),
      ],
    }
  })
  const groups: SvgDoc['groups'][number][] = [{ ...base.groups[0]!, children }]
  if (pkts.length) groups.push({ layer: 'pkt', rev, children: pkts })
  return { viewBox: base.viewBox, groups }
}

/**
 * The firm's DrawingBuilder: {family}.json with both states (packets included)
 * and one still per family and state, without the packet layer and without a
 * ghost under Rewired.
 */
export function firmBuilder(
  g: AnyGraph,
  states: readonly StateSpec[] = FIRM_STATES,
  families: readonly LayoutId[] = ['wide', 'tall'],
  omit: (family: LayoutId, rev: string) => readonly string[] = () => [],
): DocsBuilder {
  return flowBuilder(
    (family, rev) => {
      const s = states.find((x) => x.rev === rev)!
      return firmDoc(g, rev, family, s.medium, omit(family, rev))
    },
    states,
    families,
  )
}

/**
 * Like docsBuilder (src/drawings/render), for drawings with a packet layer:
 * {family}.json carries every state's layers, packets included; each still
 * shows its own state only (no ghost) and leaves the moving packets out.
 */
export function flowBuilder(
  make: (family: LayoutId, rev: string) => SvgDoc,
  states: readonly { rev: string; ground: 'paper' | 'deep' }[],
  families: readonly LayoutId[] = ['wide', 'tall'],
): DocsBuilder {
  const cache = new Map<string, SvgDoc>()
  const doc = (family: LayoutId, rev: string) => {
    const key = `${family}:${rev}`
    let d = cache.get(key)
    if (!d) {
      d = make(family, rev)
      cache.set(key, d)
    }
    return d
  }
  const files = families.flatMap((f) => [
    `${f}.json`,
    ...states.map((s) => `${f}.${s.rev}.still.svg`),
  ])
  const still: Layer[] = ['panel', 'pencil', 'ghost', 'cad', 'iso']
  const builder: DrawingBuilder = {
    files,
    build(file) {
      const family = file.split('.')[0] as LayoutId
      if (file.endsWith('.json')) {
        const merged = mergeDocs(states.map((s) => doc(family, s.rev)))
        return JSON.stringify(bundleOf(merged))
      }
      const rev = file.split('.')[1]!
      const s = states.find((x) => x.rev === rev)!
      return toStillSvg(
        doc(family, rev),
        {
          k: STILL_K[family],
          ground: s.ground,
          remap: s.ground === 'deep' ? { panel: 'deep' } : { panel: 'paper' },
        },
        still,
      )
    },
  }
  return { ...builder, doc }
}
