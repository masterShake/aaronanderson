import type { Graph, LayoutId, Prim, Pt, ScaleFigure } from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import {
  directionAt,
  instrumentsOn,
  nodeRect,
  pointAlong,
  routeGraph,
  segHitsRect,
  type Rect,
} from '../lib/route'
import { placeSymbol } from '../symbols'
import { PERSON_HEIGHT } from '../symbols/people'

/**
 * Home B's view of the example firm (owner: home-about). The tools and routes
 * are the graph's own; Home re-lays the rows so the drawing fills its frame in
 * both states (W4b A2), and stands each person beside the hand-off line they
 * carry paper along, never on it (W4b A3). KeyPlan and the hero keep reading
 * firmGraph.
 */

type G = Graph<FirmLabel, FirmRev>
type Nodes = G['nodes']

/**
 * Width of each tool's nameplate cell per family, in viewBox units: the glyph
 * that says what the tool is (src/drawings/render/firm.ts) sits in it, and the
 * tool's name keeps clear of it.
 */
export const FIRM_CELL: Readonly<Record<LayoutId, number>> = { wide: 50, tall: 36 }

/**
 * Home draws its people a quarter larger than the kit's firm scale (40 units
 * tall, PERSON_HEIGHT), so the paper they carry reads at phone size: 50 units.
 * placeSymbol's k (the kit's figures are 64 artboard units tall).
 */
export const HOME_PERSON_K = (PERSON_HEIGHT / 64) * 1.25

// ── Wide (desktop) ────────────────────────────────────────────────────────────

/**
 * The wide family: three rows, a little taller and nearer the frame than the
 * graph's base layout (rows at 100, 300, 500 in 600), so As found has no empty
 * band above its first row or under its last. The gaps between rows (136 units)
 * are the graph's own: the conduits, instruments and people need them.
 */
const WIDE_ROWS = [62, 270, 478] as const
const WIDE_TOOL: readonly [number, number] = [180, 72]
const WIDE_H = 580

function wideRows(nodes: Nodes): Nodes {
  return nodes.map((n) => {
    const r = nodeRect(n, 'wide')
    const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2]
    const row = Math.min(2, Math.max(0, Math.round((cy - 100) / 200)))
    const size = n.kind === 'tool' ? WIDE_TOOL : n.size
    return { ...n, at: [cx - size[0] / 2, WIDE_ROWS[row]! - size[1] / 2] as Pt, size }
  })
}

// ── Tall (phones) ─────────────────────────────────────────────────────────────

/**
 * The tall family: five rows of tools, two columns, and the new plumbing in
 * the middle channel: the data store where the channels cross between the
 * last two rows (it feeds the owner's report), and the monitor under it,
 * between those two tools. So As found has no empty row at the bottom waiting
 * for them. The last gap is a little taller, so the store has air above and
 * below it for the channels.
 */
const TALL_ROW = 58
const TALL_PITCH = 124
const TALL_LAST_GAP = 20
const TALL_H = TALL_ROW + TALL_PITCH * 4 + TALL_LAST_GAP + 26 + 46
const tallY = (row: number) =>
  TALL_ROW + row * TALL_PITCH + Math.max(0, Math.min(1, row - 3)) * TALL_LAST_GAP

/** Tool boxes in the tall family: a little narrower than the graph's, for a wider middle channel. */
const TALL_TOOL: readonly [number, number] = [148, 52]
const TALL_COLS = [94, 306] as const
const TALL_MID = 200

/**
 * The tall family's cells (column, row). The office tools run down the right
 * and the field side down the left, so every line that carries an AI reader
 * or a sign-off valve gets a straight run of its own instead of meeting the
 * others at one junction. The store and the monitor sit in the middle channel,
 * between two rows (row + 0.5).
 */
const TALL_CELL: Readonly<Record<string, readonly [0 | 1 | 'mid', number]>> = {
  // the first row keeps reading order (the first tool, CRM, top left)
  crm: [0, 0],
  estimate: [1, 0],
  inbox: [1, 1],
  pm: [0, 1],
  accounting: [1, 2],
  field: [0, 2],
  drive: [1, 3],
  timesheets: [0, 3],
  report: [1, 4],
  payroll: [0, 4],
  store: ['mid', 3.5],
  monitor: ['mid', 4],
}

/**
 * Ports Home fixes rather than leaving to the router: approved hours leave
 * Timesheets for the store from the far end of its bottom edge, so the line
 * down to Payroll keeps the middle of that edge and runs straight, and on
 * phones the store line is one clean elbow beside the store.
 */
const PORTS: Readonly<Record<string, Nodes[number]['ports']>> = {
  timesheets: { r14: { side: 's', at: 0.86 } },
}

function tallRows(nodes: Nodes): Nodes {
  return nodes.map((n) => {
    const ports = PORTS[n.id] ? { ...n.ports, ...PORTS[n.id] } : n.ports
    const cell = TALL_CELL[n.id]
    if (!cell) return { ...n, ports }
    const size = n.kind === 'tool' ? TALL_TOOL : (n.sizeTall ?? n.size)
    const cx = cell[0] === 'mid' ? TALL_MID : TALL_COLS[cell[0]]
    const cy = tallY(cell[1])
    return { ...n, ports, atTall: [cx - size[0] / 2, cy - size[1] / 2] as Pt, sizeTall: size }
  })
}

// ── People ────────────────────────────────────────────────────────────────────

/** The person, and the hand-off they carry paper along as found (src/drawings/graphs/firm.ts). */
const ON: Readonly<Record<string, string>> = { p1: 'h02', p2: 'h05', p3: 'h04', p4: 'h11' }

/** Where along its hand-off line each person would rather walk (0 to 1), per family. */
export const HOME_PEOPLE_AT: Readonly<Record<string, Readonly<Record<LayoutId, number>>>> = {
  p1: { wide: 0.3, tall: 0.5 },
  p2: { wide: 0.5, tall: 0.5 },
  p3: { wide: 0.62, tall: 0.5 },
  p4: { wide: 0.5, tall: 0.5 },
}

/** Points of a prim, for its bounds (arcs and curves by their control points). */
function primPts(p: Prim): Pt[] {
  switch (p.t) {
    case 'line':
      return [p.a, p.b]
    case 'poly':
      return [...p.pts]
    case 'rect':
      return [p.at, [p.at[0] + p.size[0], p.at[1] + p.size[1]]]
    case 'circle':
    case 'arc':
      return [
        [p.c[0] - p.r, p.c[1] - p.r],
        [p.c[0] + p.r, p.c[1] + p.r],
      ]
    case 'cubic':
      return [p.a, p.c1, p.c2, p.b]
    default:
      return []
  }
}

/** A carrying person's body, relative to their feet, at Home's scale. */
const BODY: Rect = (() => {
  const pts = placeSymbol('fig.carrying-paper', [0, 0], { k: HOME_PERSON_K }).flatMap((p) =>
    p.prims.flatMap(primPts),
  )
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
})()

/** Clear space (viewBox units) around a person's body: lines, boxes and other people keep off it. */
const AIR = 3
/** Half the width of the paper mark on a hand-carry line (render/graph.ts paperGlyph). */
const SIDE = 6

/**
 * Where each person stands as found: beside their own hand-off line, never on
 * a line or a box. On a level run the line is the ground they walk along (feet
 * on it); on an upright run they walk beside it, the paper side toward it. The
 * spot nearest HOME_PEOPLE_AT whose body is clear of every box, every other
 * line, the paper marks and the people placed before them.
 */
function standBeside(g: G, family: LayoutId): Map<string, Pt> {
  const found = routeGraph(g, 'asFound', family, { bend: 0 })
  const rects = g.nodes
    .filter((n) => !n.revs || n.revs.includes('asFound'))
    .map((n) => nodeRect(n, family))
  const [, , vw, vh] = g.viewBox[family]
  const segs = [...found.values()].flatMap((r) =>
    r.pts.slice(1).map((b, i) => ({ id: r.id, a: r.pts[i]!, b })),
  )
  // the paper each hand-carry line shows at its middle (render/graph.ts paperGlyph)
  const papers: Rect[] = [...found.values()].map((r) => {
    const c = pointAlong(r.pts, 0.5)
    return { x: c[0] - 6, y: c[1] - 7, w: 12, h: 14 }
  })
  const placed: Rect[] = []
  const out = new Map<string, Pt>()
  const hit = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  for (const p of g.people ?? []) {
    const r = found.get(ON[p.id] ?? '')
    const want = HOME_PEOPLE_AT[p.id]?.[family]
    if (!r || want === undefined) continue
    let best: { at: Pt; cost: number } | null = null
    for (let k = 4; k <= 96; k++) {
      const t = k / 100
      const q = pointAlong(r.pts, t)
      const d = directionAt(r.pts, t)
      const level = Math.abs(d[0]) > 0.9
      // beside an upright run: clear of the line and of the paper on it (6 units each side)
      const side = SIDE + AIR
      const spots: Pt[] = level
        ? [[q[0], q[1]]]
        : [
            [q[0] - side - BODY.x - BODY.w, q[1] + BODY.h / 2],
            [q[0] + side - BODY.x, q[1] + BODY.h / 2],
          ]
      for (const at of spots) {
        const body: Rect = {
          x: at[0] + BODY.x - AIR,
          y: at[1] + BODY.y - AIR,
          w: BODY.w + AIR * 2,
          // standing on a level line: the feet touch it, the body stays clear above
          h: BODY.h + AIR * (level ? 1 : 2) - (level ? 2 : 0),
        }
        // hard: the frame, the boxes and the other people
        if (body.x < 0 || body.y < 0 || body.x + body.w > vw || body.y + body.h > vh) continue
        if (rects.some((b) => hit(body, b))) continue
        if (placed.some((b) => hit(body, b))) continue
        // soft, but dear: a line through the body, or a paper under it
        const crossings =
          segs.filter((s) => segHitsRect(s.a, s.b, body)).length +
          papers.filter((b) => hit(body, b)).length
        const cost = crossings * 10 + Math.abs(t - want) + (level ? 0 : 0.05)
        if (!best || cost < best.cost) best = { at: [Math.round(at[0]), Math.round(at[1])], cost }
      }
    }
    if (!best) continue
    out.set(p.id, best.at)
    placed.push({ x: best.at[0] + BODY.x, y: best.at[1] + BODY.y, w: BODY.w, h: BODY.h })
  }
  return out
}

function people(g: G): ScaleFigure<FirmRev>[] {
  const wide = standBeside(g, 'wide')
  const tall = standBeside(g, 'tall')
  return (g.people ?? []).map((p) => {
    const af = p.poses.asFound
    if (!af) return p
    return {
      ...p,
      poses: {
        ...p.poses,
        asFound: {
          ...af,
          at: wide.get(p.id) ?? af.at,
          atTall: tall.get(p.id) ?? af.atTall ?? af.at,
        },
      },
    }
  })
}

/**
 * Where a person stands once rewired, when Home moves them off the graph's
 * station: beside Estimating in the clear gap to its right, and On site in the
 * clear band under Field phones (wide family). Viewbox units, feet. The tall
 * family has no clear spot for these two, so Home leaves them out there
 * (schematic.module.css, `HOME_TALL_HIDDEN`); the valves keep their people.
 */
const REWIRED_AT: Readonly<Record<string, Readonly<Record<LayoutId, (r: Rect) => Pt>>>> = {
  p2: {
    wide: (r) => [r.x + r.w + 30, r.y + r.h + 30],
    tall: (r) => [r.x + r.w - 16, r.y + r.h + 2],
  },
  p3: { wide: (r) => [r.x + 40, r.y + r.h + 58], tall: (r) => [r.x + r.w - 16, r.y + r.h + 2] },
}

/** People (and their place labels) the tall family leaves out once rewired. */
export const HOME_TALL_HIDDEN: readonly string[] = ['p2', 'p3']
const BESIDE: Readonly<Record<string, string>> = { p2: 'estimate', p3: 'field' }

/** The hand note by Timesheets: in the clear margin under it, per family. */
const NOTE_AT: Readonly<Record<LayoutId, Pt>> = { wide: [370, 532], tall: [22, 624] }

/**
 * Home leaves out the monitor's signal lines (branch routes m06, m08, m10):
 * drawn straight from the gauge, they cut through tool boxes and names at
 * every size. Its label says what it does ("watches every connection").
 */
const laidOut: G = {
  ...firmGraph,
  viewBox: { wide: [0, 0, 960, WIDE_H], tall: [0, 0, 400, TALL_H] },
  nodes: tallRows(wideRows(firmGraph.nodes)),
  routes: firmGraph.routes.filter((r) => r.kind !== 'branch'),
}

function stations(g: G, ps: ScaleFigure<FirmRev>[]): ScaleFigure<FirmRev>[] {
  return ps.map((p) => {
    const rw = p.poses.rewired
    const move = REWIRED_AT[p.id]
    const n = g.nodes.find((x) => x.id === BESIDE[p.id])
    if (!rw || !move || !n) return p
    const at = move.wide(nodeRect(n, 'wide'))
    const atTall = move.tall(nodeRect(n, 'tall'))
    return { ...p, poses: { ...p.poses, rewired: { ...rw, at, atTall } } }
  })
}

/** Rewired stations at valves, from the laid-out graph's own routing. */
function valveStations(g: G, ps: ScaleFigure<FirmRev>[]): ScaleFigure<FirmRev>[] {
  const wired = { wide: routeGraph(g, 'rewired', 'wide'), tall: routeGraph(g, 'rewired', 'tall') }
  const VALVE: Readonly<Record<string, string>> = { p1: 'r02', p4: 'r04' }
  return ps.map((p) => {
    const rw = p.poses.rewired
    const rid = VALVE[p.id]
    if (!rw || !rid) return p
    const at = (f: LayoutId): Pt => {
      const r = wired[f].get(rid)
      const ins = r ? instrumentsOn(r) : undefined
      const s = ins?.station
      if (!s || !ins?.valve) return f === 'tall' ? (rw.atTall ?? rw.at) : rw.at
      // on a vertical line the station would stand on the line itself: stand on the valve's
      // open side instead, clear of the line and its branch
      const v = ins.valve
      if (Math.abs(v.dir[0]) < 0.01 && ins.branch)
        return [Math.round(v.at[0] - 24), Math.round(v.at[1] + 26)]
      return [Math.round(s[0]), Math.round(s[1])]
    }
    return { ...p, poses: { ...p.poses, rewired: { ...rw, at: at('wide'), atTall: at('tall') } } }
  })
}

/** The example firm as Home B draws it. */
export const homeFirmGraph: G = {
  ...laidOut,
  people: stations(laidOut, valveStations(laidOut, people(laidOut))),
  notes: (firmGraph.notes ?? []).map((n) => ({ ...n, at: NOTE_AT.wide, atTall: NOTE_AT.tall })),
}

/** For tests: a carrying person's body relative to their feet, and the hand-off each walks. */
export const HOME_BODY: Readonly<Rect> = BODY
export const HOME_CARRIES: Readonly<Record<string, string>> = ON
