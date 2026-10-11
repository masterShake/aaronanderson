import type { Graph, LayoutId, Prim, Pt, SvgDoc, SvgNode, SymbolId } from '../types'
import { primD, seedFrom } from '../lib/geometry'
import { drawOrder, primLength } from '../lib/length'
import {
  center,
  directionAt,
  inRev,
  instrumentsOn,
  nodeRect,
  pointAlong,
  routeGraph,
  type Routed,
} from '../lib/route'
import { isConnection } from '../lib/counts'
import { pencil } from './pencil'
import { group, partsNodes, portCircles, strokeCls } from './cad'
import {
  aiPrims,
  arrowhead,
  chevron,
  cloudPrim,
  monitorPrims,
  paperGlyph,
  placeSymbol,
  tankPrims,
  valvePrims,
} from '../symbols'

/**
 * One graph, every output (stage-hero §3.3): the pencil layer (as found) and
 * the clean CAD layer (rewired) from the same routed geometry. Each drawing
 * element is a <g data-part="{id}"> so the figure can highlight what a tool
 * touches. No text: labels are HTML.
 */

type AnyGraph = Graph<string, string>
export type Medium = 'pencil' | 'cad'

const node = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})

function roughNodes(
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: 'box' | 'line' | 'cloud' | 'person' = 'line',
): SvgNode[] {
  return pencil(prims, { seed: seedFrom(seed), preset }).map((s) => node(s.d, s.len, part, i, cls))
}

const cleanNode = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode =>
  node(
    prims.map(primD).join(''),
    prims.reduce((s, p) => s + primLength(p), 0),
    part,
    i,
    cls,
  )

/** Offset a polyline sideways by `off` units (for the sync double line). */
function offsetPts(pts: readonly Pt[], off: number): Pt[] {
  return pts.map((p, i) => {
    const d = directionAt(pts, i / Math.max(1, pts.length - 1))
    return [p[0] - d[1] * off, p[1] + d[0] * off] as Pt
  })
}

export interface GraphDocOptions {
  /** pencil = as-found sketch; cad = clean rewired drawing. Default: pencil for the first rev. */
  medium?: Medium
  /** Chevron spacing on automatic routes (default 120 u; 0 = none). */
  chevrons?: number
}

/** The SvgDoc of one graph state in one family. */
export function graphDoc(
  g: AnyGraph,
  rev: string,
  family: LayoutId,
  o: GraphDocOptions = {},
): SvgDoc {
  const medium: Medium = o.medium ?? (rev === g.revs[0] ? 'pencil' : 'cad')
  const vb = g.viewBox[family]
  const routed = routeGraph(g, rev, family, { bend: medium === 'cad' ? 12 : 0 })
  const nodes = g.nodes.filter((n) => inRev(n, rev))
  const order = drawOrder([
    ...nodes.map((n) => ({ id: n.id, key: center(nodeRect(n, family)) })),
    ...[...routed.values()].map((r) => ({ id: r.id, key: r.pts[0]! })),
  ])
  const idx = (id: string) => order.get(id) ?? 0
  const seed = (id: string) => `${g.id}:${g.seed}:${family}:${rev}:${id}`
  const children: SvgNode[] = []

  if (medium === 'pencil') {
    for (const n of nodes) {
      const rc = nodeRect(n, family)
      const box: Prim = { t: 'rect', at: [rc.x, rc.y], size: [rc.w, rc.h] }
      const i = idx(n.id)
      children.push(
        group(n.id, [
          cleanNode([box], n.id, i, strokeCls({ fill: 'paper', draw: false })),
          ...roughNodes(
            [box],
            seed(n.id),
            n.id,
            i,
            strokeCls({ pen: '035', ink: 'pencil' }),
            'box',
          ),
        ]),
      )
    }
    for (const r of routed.values()) {
      if (!isConnection(r.route)) continue
      const i = idx(r.id)
      const cls = strokeCls({ pen: '035', ink: 'pencil' })
      const line: Prim = { t: 'poly', pts: r.pts }
      const kids: SvgNode[] = []
      if (r.route.mode === 'sync') {
        kids.push(
          ...roughNodes([{ t: 'poly', pts: offsetPts(r.pts, 2) }], seed(`${r.id}.a`), r.id, i, cls),
          ...roughNodes(
            [{ t: 'poly', pts: offsetPts(r.pts, -2) }],
            seed(`${r.id}.b`),
            r.id,
            i,
            cls,
          ),
        )
      } else {
        const end = r.pts[r.pts.length - 1]!
        const before = r.pts[r.pts.length - 2]!
        kids.push(
          ...roughNodes([line], seed(r.id), r.id, i, cls),
          ...roughNodes([arrowhead(before, end)], seed(`${r.id}.arrow`), r.id, i, cls),
          cleanNode(
            paperGlyph(pointAlong(r.pts, 0.5)),
            r.id,
            i,
            strokeCls({ fill: 'paper', draw: false }),
          ),
          ...roughNodes(paperGlyph(pointAlong(r.pts, 0.5)), seed(`${r.id}.paper`), r.id, i, cls),
        )
      }
      children.push(group(r.id, kids))
    }
  } else {
    for (const n of nodes) {
      const rc = nodeRect(n, family)
      const c = center(rc)
      const i = idx(n.id)
      const ends = [...routed.values()].filter((r) => isConnection(r.route))
      const ports = [
        ...ends.filter((r) => r.from === n.id).map((r) => r.pts[0]!),
        ...ends.filter((r) => r.to === n.id).map((r) => r.pts[r.pts.length - 1]!),
      ]
      let kids: SvgNode[]
      if (n.kind === 'store') {
        const t = tankPrims(c, 0.6)
        kids = [
          cleanNode(t.body, n.id, i, strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' })),
          cleanNode(t.glass, n.id, i, strokeCls({ pen: '035', ink: 'cyan' })),
          cleanNode(t.fill, n.id, i, strokeCls({ fill: 'cyan-dim', draw: false })),
        ]
      } else if (n.kind === 'monitor') {
        kids = [
          cleanNode(
            monitorPrims(c),
            n.id,
            i,
            strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' }),
          ),
        ]
      } else {
        const box: Prim = { t: 'rect', at: [rc.x, rc.y], size: [rc.w, rc.h] }
        kids = [
          cleanNode([box], n.id, i, strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' })),
          ...portCircles(ports, n.id, i),
        ]
      }
      children.push(group(n.id, kids))
    }
    for (const r of routed.values()) {
      const i = idx(r.id)
      if (!isConnection(r.route)) {
        children.push(
          group(r.id, [
            cleanNode(
              [r.prim],
              r.id,
              i,
              strokeCls({ pen: '018', ink: 'cyan-dim', dash: 'signal' }),
            ),
          ]),
        )
        continue
      }
      const kids: SvgNode[] = [cleanNode([r.prim], r.id, i, strokeCls({ pen: '070', ink: 'cyan' }))]
      const ins = instrumentsOn(r)
      const every = o.chevrons ?? 120
      if (every > 0 && !ins.ai && !ins.valve)
        for (let s = every; s < r.len - 24; s += every) {
          const t = s / r.len
          kids.push(
            cleanNode(
              [chevron(pointAlong(r.pts, t), directionAt(r.pts, t))],
              r.id,
              i,
              strokeCls({ pen: '035', ink: 'cyan', draw: false }),
            ),
          )
        }
      if (ins.branch)
        kids.push(
          cleanNode(
            [{ t: 'poly', pts: ins.branch, r: 8 }],
            r.id,
            i,
            strokeCls({ pen: '050', ink: 'cyan' }),
          ),
        )
      if (ins.ai) {
        const a = aiPrims(ins.ai.at)
        kids.push(
          cleanNode(a.body, `${r.id}.ai`, i, strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' })),
          cleanNode(a.ring, `${r.id}.ai`, i, strokeCls({ pen: '070', ink: 'orange' })),
        )
      }
      if (ins.valve) {
        const v = valvePrims(ins.valve.at)
        kids.push(
          cleanNode(v.body, `${r.id}.hv`, i, strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' })),
          cleanNode(v.wheel, `${r.id}.hv`, i, strokeCls({ pen: '050', ink: 'orange' })),
        )
      }
      children.push(group(r.id, kids))
    }
  }

  // people (pencil cut-outs in both media)
  for (const p of g.people ?? []) {
    const pose = (p.poses as Record<string, { symbol: SymbolId; at: Pt; atTall?: Pt } | undefined>)[
      rev
    ]
    if (!pose) continue
    const at = family === 'tall' && pose.atTall ? pose.atTall : pose.at
    const parts = placeSymbol(pose.symbol, at, { prefix: p.id })
    children.push(
      group(
        p.id,
        partsNodes(parts, { variant: 'pencil', seed: seed(p.id), i: order.size, ink: 'pencil' }),
        'person',
      ),
    )
  }

  // clouds around people or nodes
  for (const c of g.clouds ?? []) {
    if (!c.revs.includes(rev)) continue
    const rects = c.around.flatMap((id) => {
      const n = nodes.find((x) => x.id === id)
      return n ? [nodeRect(n, family)] : []
    })
    if (!rects.length) continue
    const x = Math.min(...rects.map((r) => r.x)) - 10
    const y = Math.min(...rects.map((r) => r.y)) - 10
    const x1 = Math.max(...rects.map((r) => r.x + r.w)) + 10
    const y1 = Math.max(...rects.map((r) => r.y + r.h)) + 10
    const cp = cloudPrim({ x, y, w: x1 - x, h: y1 - y }, { seed: seedFrom(seed(c.id)) })
    children.push(
      group(
        c.id,
        roughNodes(
          [cp],
          seed(c.id),
          c.id,
          order.size + 1,
          strokeCls({ pen: '050', ink: 'redline' }),
          'cloud',
        ),
      ),
    )
  }

  return {
    viewBox: vb,
    groups: [{ layer: medium === 'pencil' ? 'pencil' : 'cad', rev, children }],
  }
}

/** The routed geometry, for label anchors and callout positions (same as the drawing). */
export const graphRoutes = (g: AnyGraph, rev: string, family: LayoutId): Map<string, Routed> =>
  routeGraph(g, rev, family, { bend: rev === g.revs[0] ? 0 : 12 })
