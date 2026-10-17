import type {
  DrawingBuilder,
  Graph,
  Layer,
  LayoutId,
  Prim,
  Pt,
  SvgDoc,
  SvgNode,
  SymbolId,
} from '../types'
import { placeSymbol, toolGlyph, type ToolKind } from '../symbols'
import { firmGraph } from '../graphs/firm'
import { FIRM_CELL, forFamily } from '../views/home'
import { primD } from '../lib/geometry'
import { primLength } from '../lib/length'
import { directionAt, inRev, nodeRect, routeGraph, type Routed } from '../lib/route'
import { isConnection } from '../lib/counts'
import { toStillSvg } from '../lib/svg-string'
import { partsNodes, strokeCls } from './cad'
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
 * - every tool is a piece of equipment: its box gets a nameplate cell with the
 *   kit's glyph for what it is (envelope, spreadsheet grid, folder, card file,
 *   Gantt bars, ledger, chart sheet, phone, time clock, pay stub);
 * - rewired conduits get flanges at both joints (the kit's own pair is left
 *   off, so there is one) and an orange packet stream on the l-pkt layer
 *   (left out of the stills);
 * - groups carry a role class (k-node, k-pipe, k-inst) so the figure's CSS
 *   can choreograph the As found → Rewired change.
 */

export const FIRM_STATES: readonly StateSpec[] = [
  { rev: 'asFound', medium: 'pencil', ground: 'paper' },
  { rev: 'rewired', medium: 'cad', ground: 'deep' },
]

/** The kit's plain graph build of the firm (unit tests and other readers). */
export const firmDrawing = graphBuilder(firmGraph, FIRM_STATES)

type AnyGraph = Graph<string, string>

/**
 * What each tool is, as the kit's tool kind (symbols/library.ts toolGlyph): the
 * glyph in its nameplate cell, the same glyphs the hero draws.
 */
export const FIRM_GLYPHS: Readonly<Record<string, ToolKind>> = {
  inbox: 'inbox',
  estimate: 'sheet',
  drive: 'folder',
  crm: 'cards',
  pm: 'gantt',
  accounting: 'ledger',
  report: 'chart',
  field: 'phone',
  timesheets: 'timesheet',
  payroll: 'payroll',
}

export { FIRM_CELL }

const R = (v: number) => Math.round(v * 100) / 100

/** Flanges: a pair of short bars across a pipe, `back` units in from each end. */
export function flangePrims(pts: readonly Pt[], back = 9, half = 5.5): Prim[] {
  const out: Prim[] = []
  const len = pts.reduce(
    (s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) : 0),
    0,
  )
  if (len < back * 3) return out
  const seg = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
  // a flange sits on the straight run at its end; a run too short for it (a bend right at the
  // port) gets none, so no flange ever lands on a curve
  const room = back + 3 + 12
  for (const [end, t, run] of [
    [pts[0]!, 0, seg(pts[0]!, pts[1] ?? pts[0]!)],
    [pts[pts.length - 1]!, 1, seg(pts[pts.length - 2] ?? pts[0]!, pts[pts.length - 1]!)],
  ] as const) {
    if (pts.length > 2 && run < room) continue
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
  graph: AnyGraph,
  rev: string,
  family: LayoutId,
  medium: Medium,
  /** Element ids (people) left out of this family and state. */
  omit: readonly string[] = [],
  /** Scale of the people (placeSymbol k); the kit's default when left out. */
  personK?: number,
): SvgDoc {
  // the graph as this family routes it (Home's wide family fixes some ports of its own)
  const g = forFamily(graph, family)
  // the firm draws its own flanges (below, part `.flange`): the kit's pair would double them
  const base = graphDoc(g, rev, family, { medium, flanges: false })
  // people at Home's scale: the same pencil cut-outs graphDoc draws, larger
  const person = (child: SvgNode & { el: 'g' }): SvgNode => {
    const p = (g.people ?? []).find((x) => x.id === child.part)
    const pose = p
      ? (p.poses as Record<string, { symbol: SymbolId; at: Pt; atTall?: Pt } | undefined>)[rev]
      : undefined
    if (!p || !pose || personK === undefined) return child
    const at = family === 'tall' && pose.atTall ? pose.atTall : pose.at
    const i = (child.children[0] as { i?: number } | undefined)?.i ?? 0
    const parts = placeSymbol(pose.symbol, at, { prefix: p.id, k: personK })
    const seed = `${g.id}:${g.seed}:${family}:${rev}:${p.id}`
    return {
      ...child,
      children: partsNodes(parts, { variant: 'pencil', seed, i, ink: 'pencil' }),
    }
  }
  const cad = medium === 'cad'
  const routed = routeGraph(g, rev, family, { bend: cad ? 12 : 0 })
  const nodes = new Map(g.nodes.filter((n) => inRev(n, rev)).map((n) => [n.id, n]))
  const cell = FIRM_CELL[family]
  const pkts: SvgNode[] = []
  const kept = base.groups[0]!.children.filter(
    (child) => !(child.el === 'g' && child.part && omit.includes(child.part)),
  )
  const children = kept.map((child): SvgNode => {
    if (child.el === 'g' && child.cls === 'person') return person(child)
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
      const kg = kind
        ? toolGlyph(kind, { x: R(x + cell / 2 - s / 2), y: R(rc.y + rc.h / 2 - s / 2), g: s })
        : null
      const gl = kg ? { outline: kg.outline, detail: kg.rules } : null
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
  o: {
    /** People left out of a family and state. */
    omit?: (family: LayoutId, rev: string) => readonly string[]
    /** The people's scale (placeSymbol k). */
    personK?: number
  } = {},
): DocsBuilder {
  return flowBuilder(
    (family, rev) => {
      const s = states.find((x) => x.rev === rev)!
      return firmDoc(g, rev, family, s.medium, o.omit?.(family, rev) ?? [], o.personK)
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
