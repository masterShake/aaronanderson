import type { Graph, GraphNode, GraphRoute, GraphView, LayoutId, Port, Prim, Pt } from '../types'
import { dist, lerp } from './geometry'
import { primLength } from './length'

/**
 * Graph layout and orthogonal routing. Clean routes run at right angles in
 * the channels between rows and columns, never through a box; CAD bends get a
 * 12-unit fillet. Ports a graph leaves undefined are assigned here per family
 * (the side facing the other end, spread evenly along the side). Isomorphic.
 */

export const BEND = 12
type AnyGraph = Graph<string, string>
type AnyNode = GraphNode<string, string>
type AnyRoute = GraphRoute<string, string>

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Is the item drawn in this rev? (no revs = every rev) */
export const inRev = (item: { revs?: readonly string[] }, rev: string): boolean =>
  !item.revs || item.revs.includes(rev)

export const nodeAt = (n: AnyNode, family: LayoutId): Pt =>
  family === 'tall' && n.atTall ? n.atTall : n.at

/**
 * Local adapter until GraphNode gains `sizeTall` (request drawings-1): a node
 * may carry a smaller box for the tall family.
 */
export type SizedNode = { sizeTall?: readonly [number, number] }

export const nodeSize = (n: AnyNode, family: LayoutId): readonly [number, number] =>
  (family === 'tall' && (n as AnyNode & SizedNode).sizeTall) || n.size

export function nodeRect(n: AnyNode, family: LayoutId): Rect {
  const [x, y] = nodeAt(n, family)
  const [w, h] = nodeSize(n, family)
  return { x, y, w, h }
}

export const center = (r: Rect): Pt => [r.x + r.w / 2, r.y + r.h / 2]

/** The point of a port on a rect. */
export function portPoint(r: Rect, p: Port): Pt {
  switch (p.side) {
    case 'n':
      return [r.x + r.w * p.at, r.y]
    case 's':
      return [r.x + r.w * p.at, r.y + r.h]
    case 'w':
      return [r.x, r.y + r.h * p.at]
    case 'e':
      return [r.x + r.w, r.y + r.h * p.at]
  }
}

/**
 * An orthogonal polyline from a to b through optional via points: each leg
 * runs horizontally, then vertically. With no via, a Z through the mid x.
 */
export function routeOrthogonal(a: Pt, b: Pt, via?: readonly Pt[], r = BEND): Prim {
  return { t: 'poly', pts: orthoPts(a, b, via), r }
}

function orthoPts(a: Pt, b: Pt, via?: readonly Pt[]): Pt[] {
  const stops = via?.length ? [a, ...via, b] : [a, [(a[0] + b[0]) / 2, a[1]] as Pt, b]
  const pts: Pt[] = [stops[0]!]
  for (let i = 1; i < stops.length; i++) {
    const p = pts[pts.length - 1]!
    const q = stops[i]!
    if (p[0] !== q[0] && p[1] !== q[1]) pts.push([q[0], p[1]])
    pts.push(q)
  }
  return simplify(pts)
}

/** Drop repeated and collinear points. */
export function simplify(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last[0] - p[0]) < 1e-6 && Math.abs(last[1] - p[1]) < 1e-6) continue
    out.push(p)
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Pt, Pt, Pt]
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      if (Math.abs(cross) > 1e-6) break
      out.splice(out.length - 2, 1)
    }
  }
  return out
}

/** Does the segment a–b (axis aligned) pass through the rect (inset by pad)? */
export function segHitsRect(a: Pt, b: Pt, r: Rect, pad = 0): boolean {
  const x0 = Math.min(a[0], b[0])
  const x1 = Math.max(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const y1 = Math.max(a[1], b[1])
  return x1 > r.x + pad && x0 < r.x + r.w - pad && y1 > r.y + pad && y0 < r.y + r.h - pad
}

/** The point at fraction t (0 to 1) of the length of a polyline. */
export function pointAlong(pts: readonly Pt[], t: number): Pt {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!)
  let want = total * Math.min(1, Math.max(0, t))
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1]!, pts[i]!)
    if (want <= l || i === pts.length - 1) return lerp(pts[i - 1]!, pts[i]!, l ? want / l : 0)
    want -= l
  }
  return pts[0]!
}

/** Unit direction of the polyline at fraction t. */
export function directionAt(pts: readonly Pt[], t: number): Pt {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!)
  let want = total * t
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const l = dist(a, b)
    if (want <= l || i === pts.length - 1)
      return l ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0]
    want -= l
  }
  return [1, 0]
}

export interface Routed {
  id: string
  route: AnyRoute
  from: string
  to: string
  /** Corner points, port to port. */
  pts: readonly Pt[]
  prim: Prim
  len: number
}

const nodeIdOf = (end: string) => end.slice(0, end.indexOf('.'))
const portIdOf = (end: string) => end.slice(end.indexOf('.') + 1)

/** Visible nodes and routes of a graph in one rev. */
export function visible(g: AnyGraph, rev: string) {
  const nodes = g.nodes.filter((n) => inRev(n, rev))
  const ids = new Set(nodes.map((n) => n.id))
  const routes = g.routes.filter((r) => inRev(r, rev))
  return { nodes, ids, routes }
}

/** Channel lines between the rows and columns of node centers, plus hugging outer channels. */
function channels(rects: readonly Rect[], axis: 0 | 1): number[] {
  const cs = rects.map((r) => center(r)[axis])
  const sorted = [...cs].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const c of sorted) {
    const g = groups[groups.length - 1]
    if (g && c - g[g.length - 1]! < 12) g.push(c)
    else groups.push([c])
  }
  const lo = (r: Rect) => (axis === 0 ? r.x : r.y)
  const hi = (r: Rect) => (axis === 0 ? r.x + r.w : r.y + r.h)
  const out: number[] = []
  const minLo = Math.min(...rects.map(lo))
  const maxHi = Math.max(...rects.map(hi))
  out.push(minLo - 10)
  for (let i = 1; i < groups.length; i++) {
    // midway between the facing edges of neighbouring columns (rows)
    const prev = groups[i - 1]!
    const next = groups[i]!
    const left = Math.max(...rects.filter((r) => prev.includes(center(r)[axis])).map((r) => hi(r)))
    const right = Math.min(...rects.filter((r) => next.includes(center(r)[axis])).map((r) => lo(r)))
    out.push((left + right) / 2)
  }
  out.push(maxHi + 10)
  return out
}

const LANES = [0, 1, -1, 2, -2, 3, -3]

/** Is q on the outward side of a port at p? */
function leaves(p: Pt, side: Port['side'], q: Pt): boolean {
  switch (side) {
    case 'e':
      return q[0] > p[0]
    case 'w':
      return q[0] < p[0]
    case 's':
      return q[1] > p[1]
    case 'n':
      return q[1] < p[1]
  }
}

/**
 * Routes every visible route of a graph for one rev and family. Ends that name
 * another route (`r06.mid`) attach to that route's midpoint, as straight
 * signal lines. Deterministic: routes are processed in graph order.
 */
export function routeGraph(
  g: AnyGraph,
  rev: string,
  family: LayoutId,
  o: { bend?: number; lane?: number } = {},
): Map<string, Routed> {
  const bend = o.bend ?? BEND
  const laneStep = o.lane ?? 6
  const { nodes, routes } = visible(g, rev)
  const rects = new Map(nodes.map((n) => [n.id, nodeRect(n, family)]))
  const all = [...rects.values()]
  const vch = channels(all, 0)
  const hch = channels(all, 1)
  const used = new Map<string, number>()
  const [vx, vy, vw, vh] = g.viewBox[family]
  const lane = (key: string, base: number) => {
    const n = used.get(key) ?? 0
    used.set(key, n + 1)
    const v = base + LANES[n % LANES.length]! * laneStep
    // keep every run inside the viewBox
    return key[0] === 'v'
      ? Math.min(vx + vw - 2, Math.max(vx + 2, v))
      : Math.min(vy + vh - 2, Math.max(vy + 2, v))
  }

  // 1. port sides and spread
  type End = { route: AnyRoute; node: string; port: string; other: Pt; side?: Port['side'] }
  const ends: End[] = []
  const nodeRoutes = routes.filter((r) => rects.has(nodeIdOf(r.from)) && rects.has(nodeIdOf(r.to)))
  for (const r of nodeRoutes) {
    const a = rects.get(nodeIdOf(r.from))!
    const b = rects.get(nodeIdOf(r.to))!
    ends.push({ route: r, node: nodeIdOf(r.from), port: portIdOf(r.from), other: center(b) })
    ends.push({ route: r, node: nodeIdOf(r.to), port: portIdOf(r.to), other: center(a) })
  }
  const portOf = new Map<string, Port>()
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const bySide = new Map<string, End[]>()
  for (const e of ends) {
    const fixed = nodesById.get(e.node)!.ports[e.port]
    const key = `${e.route.id}:${e.node}:${e.port}`
    if (fixed) {
      portOf.set(key, fixed)
      continue
    }
    const rc = rects.get(e.node)!
    const [cx, cy] = center(rc)
    const dx = e.other[0] - cx
    const dy = e.other[1] - cy
    // normalise by box shape so wide boxes prefer their long sides less often
    const side: Port['side'] =
      Math.abs(dx) / rc.w >= Math.abs(dy) / rc.h ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n'
    e.side = side
    const k = `${e.node}:${side}`
    bySide.set(k, [...(bySide.get(k) ?? []), e])
  }
  for (const [k, list] of bySide) {
    const side = k.slice(k.lastIndexOf(':') + 1) as Port['side']
    const axis = side === 'n' || side === 's' ? 0 : 1
    const sorted = [...list].sort(
      (a, b) => a.other[axis] - b.other[axis] || (a.route.id < b.route.id ? -1 : 1),
    )
    sorted.forEach((e, i) =>
      portOf.set(`${e.route.id}:${e.node}:${e.port}`, { side, at: (i + 1) / (sorted.length + 1) }),
    )
  }

  // 2. paths through the channels
  const out = new Map<string, Routed>()
  const nextCh = (list: number[], v: number, dir: 1 | -1) =>
    dir > 0
      ? (list.find((c) => c > v + 1) ?? v + 14)
      : ([...list].reverse().find((c) => c < v - 1) ?? v - 14)
  const nearestCh = (list: number[], v: number) =>
    list.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), list[0]!)
  const clear = (pts: readonly Pt[], skip: readonly string[]) => {
    for (let i = 1; i < pts.length; i++)
      for (const [id, rc] of rects)
        if (!skip.includes(id) && segHitsRect(pts[i - 1]!, pts[i]!, rc, 1)) return false
    return true
  }

  for (const r of nodeRoutes) {
    const na = nodeIdOf(r.from)
    const nb = nodeIdOf(r.to)
    const ra = rects.get(na)!
    const rb = rects.get(nb)!
    const pa = portOf.get(`${r.id}:${na}:${portIdOf(r.from)}`)!
    const pb = portOf.get(`${r.id}:${nb}:${portIdOf(r.to)}`)!
    const A = portPoint(ra, pa)
    const B = portPoint(rb, pb)
    let pts: Pt[]
    if (r.via?.length) {
      pts = orthoPts(A, B, r.via)
    } else {
      const horizA = pa.side === 'e' || pa.side === 'w'
      const horizB = pb.side === 'e' || pb.side === 'w'
      const dirA = pa.side === 'e' || pa.side === 's' ? 1 : -1
      const dirB = pb.side === 'e' || pb.side === 's' ? 1 : -1
      const straight: Pt[] = [A, B]
      const elbow: Pt = horizA ? [B[0], A[1]] : [A[0], B[1]]
      const one: Pt[] = [A, elbow, B]
      if (
        (A[0] === B[0] || A[1] === B[1]) &&
        leaves(A, pa.side, B) &&
        leaves(B, pb.side, A) &&
        clear(straight, [])
      )
        pts = straight
      else {
        // one elbow, if it leaves and enters outward and is clear
        if (
          horizA !== horizB &&
          leaves(A, pa.side, elbow) &&
          leaves(B, pb.side, elbow) &&
          clear(one, [])
        )
          pts = one
        else if (horizA && horizB) {
          const x1 = lane(`v${nextCh(vch, A[0], dirA)}`, nextCh(vch, A[0], dirA))
          const x2 = lane(`v${nextCh(vch, B[0], dirB)}`, nextCh(vch, B[0], dirB))
          if (Math.abs(x1 - x2) < laneStep * 4) pts = [A, [x1, A[1]], [x1, B[1]], B]
          else {
            const y = lane(
              `h${nearestCh(hch, (A[1] + B[1]) / 2)}`,
              nearestCh(hch, (A[1] + B[1]) / 2),
            )
            pts = [A, [x1, A[1]], [x1, y], [x2, y], [x2, B[1]], B]
          }
        } else if (!horizA && !horizB) {
          const y1 = lane(`h${nextCh(hch, A[1], dirA)}`, nextCh(hch, A[1], dirA))
          const y2 = lane(`h${nextCh(hch, B[1], dirB)}`, nextCh(hch, B[1], dirB))
          if (Math.abs(y1 - y2) < laneStep * 4) pts = [A, [A[0], y1], [B[0], y1], B]
          else {
            const x = lane(
              `v${nearestCh(vch, (A[0] + B[0]) / 2)}`,
              nearestCh(vch, (A[0] + B[0]) / 2),
            )
            pts = [A, [A[0], y1], [x, y1], [x, y2], [B[0], y2], B]
          }
        } else if (horizA) {
          const x1 = lane(`v${nextCh(vch, A[0], dirA)}`, nextCh(vch, A[0], dirA))
          const y2 = lane(`h${nextCh(hch, B[1], dirB)}`, nextCh(hch, B[1], dirB))
          pts = [A, [x1, A[1]], [x1, y2], [B[0], y2], B]
        } else {
          const y1 = lane(`h${nextCh(hch, A[1], dirA)}`, nextCh(hch, A[1], dirA))
          const x2 = lane(`v${nextCh(vch, B[0], dirB)}`, nextCh(vch, B[0], dirB))
          pts = [A, [A[0], y1], [x2, y1], [x2, B[1]], B]
        }
      }
    }
    pts = simplify(pts)
    const prim: Prim = { t: 'poly', pts, r: bend }
    out.set(r.id, { id: r.id, route: r, from: na, to: nb, pts, prim, len: primLength(prim) })
  }

  // 3. signal lines that end on another route's midpoint
  for (const r of routes) {
    if (out.has(r.id)) continue
    const endPt = (end: string, toward: Pt | null): Pt | null => {
      const id = nodeIdOf(end)
      const rc = rects.get(id)
      if (rc) {
        if (!toward) return center(rc)
        const [cx, cy] = center(rc)
        const dx = toward[0] - cx
        const dy = toward[1] - cy
        return Math.abs(dx) / rc.w >= Math.abs(dy) / rc.h
          ? [dx > 0 ? rc.x + rc.w : rc.x, cy]
          : [cx, dy > 0 ? rc.y + rc.h : rc.y]
      }
      const other = out.get(id)
      return other ? pointAlong(other.pts, 0.5) : null
    }
    const roughA = endPt(r.from, null)
    const roughB = endPt(r.to, null)
    if (!roughA || !roughB) continue
    const A = endPt(r.from, roughB)!
    const B = endPt(r.to, roughA)!
    const pts: Pt[] = [A, B]
    const prim: Prim = { t: 'line', a: A, b: B }
    out.set(r.id, {
      id: r.id,
      route: r,
      from: nodeIdOf(r.from),
      to: nodeIdOf(r.to),
      pts,
      prim,
      len: dist(A, B),
    })
  }
  return out
}

export interface Instruments {
  /** AI reader centre and the line direction there. */
  ai?: { at: Pt; dir: Pt }
  /** Sign-off valve centre (inline, or on the exception branch). */
  valve?: { at: Pt; dir: Pt }
  /** The exception branch around the valve (AI plus valve routes). */
  branch?: readonly Pt[]
  /** Where the person at the valve stands (feet). */
  station?: Pt
}

/**
 * Where a rewired route's instruments sit: an AI reader at 40% of its length;
 * a valve inline at 50%, or, after an AI reader, on an exception branch that
 * leaves the line 28 units to its left (for a right-going line, above it).
 */
export function instrumentsOn(r: Routed): Instruments {
  const out: Instruments = {}
  // instruments sit on the longest straight run, so symbols never straddle a bend
  let s0: Pt = r.pts[0]!
  let s1: Pt = r.pts[1] ?? r.pts[0]!
  for (let i = 1; i < r.pts.length; i++)
    if (dist(r.pts[i - 1]!, r.pts[i]!) > dist(s0, s1)) {
      s0 = r.pts[i - 1]!
      s1 = r.pts[i]!
    }
  const seg = [s0, s1] as const
  const both = Boolean(r.route.ai && r.route.valve)
  if (r.route.ai) {
    const t = both ? 0.25 : 0.5
    out.ai = { at: pointAlong(seg, t), dir: directionAt(seg, t) }
  }
  if (r.route.valve && !r.route.ai) {
    const at = pointAlong(seg, 0.5)
    const dir = directionAt(seg, 0.5)
    out.valve = { at, dir }
    out.station = [at[0] + 14, at[1] + 20]
  }
  if (both) {
    const a = pointAlong(seg, 0.45)
    const b = pointAlong(seg, 0.85)
    const d = directionAt(seg, 0.45)
    const n: Pt = d[0] !== 0 ? [0, -1] : [-1, 0]
    const off = 28
    const a2: Pt = [a[0] + n[0] * off, a[1] + n[1] * off]
    const b2: Pt = [b[0] + n[0] * off, b[1] + n[1] * off]
    const v: Pt = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]
    out.branch = [a, a2, b2, b]
    out.valve = { at: v, dir: d }
    out.station = [v[0] + 16, v[1] + 4]
  }
  return out
}

/** A graph re-laid out by a view: only its nodes and routes, at the view's positions. */
export function applyView<L extends string, R extends string>(
  g: Graph<L, R>,
  v: GraphView<R>,
): Graph<L, R> {
  const keep = new Set(v.nodes)
  const keepRoutes = new Set(v.routes)
  return {
    ...g,
    id: v.id,
    viewBox: v.viewBox ?? g.viewBox,
    revs: v.revs ?? g.revs,
    nodes: g.nodes
      .filter((n) => keep.has(n.id))
      .map((n) => {
        const at = v.layout?.[n.id]
        return at ? { ...n, at: at.at, ...(at.atTall ? { atTall: at.atTall } : {}) } : n
      }),
    routes: g.routes.filter(
      (r) =>
        keepRoutes.has(r.id) &&
        (keep.has(nodeIdOf(r.from)) || keepRoutes.has(nodeIdOf(r.from))) &&
        (keep.has(nodeIdOf(r.to)) || keepRoutes.has(nodeIdOf(r.to))),
    ),
  }
}
