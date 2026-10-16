import type { Graph, LayoutId, Pt, ScaleFigure } from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import { instrumentsOn, nodeRect, pointAlong, routeGraph, type Rect } from '../lib/route'
import { PERSON_HEIGHT } from '../symbols/people'

/**
 * Home B's view of the example firm (owner: home-about). The tools and routes
 * are the graph's own (Home's layout is the graph's base layout); only where
 * people stand on their hand-off lines as found changes, so that no two people
 * overlap in either family (the graph puts p1 and p2 at the same mid-points
 * under the spreadsheet, and p1 and p3 in the tall family's inbox channel).
 * Rewired stations are unchanged. KeyPlan and the hero keep reading firmGraph.
 */

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

/** Where along its hand-off line each person stands as found (0 to 1), per family. */
export const HOME_PEOPLE_AT: Readonly<Record<string, Readonly<Record<LayoutId, number>>>> = {
  // tall: every hand-off runs straight down between two rows; standing low on it keeps the
  // person's head clear of the box above
  p1: { wide: 0.3, tall: 0.84 },
  // except Estimate → Project management, which crosses the middle channel: stand there
  p2: { wide: 0.5, tall: 0.5 },
  p3: { wide: 0.62, tall: 0.84 },
  p4: { wide: 0.5, tall: 0.84 },
}

/** The person, and the hand-off they stand on as found (src/drawings/graphs/firm.ts). */
const ON: Readonly<Record<string, string>> = { p1: 'h02', p2: 'h05', p3: 'h04', p4: 'h11' }

function people(g: Graph<FirmLabel, FirmRev>): ScaleFigure<FirmRev>[] {
  const found = {
    wide: routeGraph(g, 'asFound', 'wide', { bend: 0 }),
    tall: routeGraph(g, 'asFound', 'tall', { bend: 0 }),
  }
  const onLine = (id: string, family: LayoutId, fallback: Pt): Pt => {
    const r = found[family].get(ON[id] ?? '')
    const t = HOME_PEOPLE_AT[id]?.[family]
    if (!r || t === undefined) return fallback
    const q = pointAlong(r.pts, t)
    return [Math.round(q[0]), Math.round(q[1])]
  }
  return (g.people ?? []).map((p) => {
    const af = p.poses.asFound
    if (!af) return p
    return {
      ...p,
      poses: {
        ...p.poses,
        asFound: {
          ...af,
          at: onLine(p.id, 'wide', af.at),
          atTall: onLine(p.id, 'tall', af.atTall ?? af.at),
        },
      },
    }
  })
}

/**
 * The tall family (phones) gets more air between its rows than the graph's
 * base layout: the conduits, instruments and people between the rows need it.
 * Rows keep their order and the columns stay put.
 */
const TALL_ROW = 58
const TALL_PITCH = 124
const TALL_LAST = 104
const TALL_H = TALL_ROW * 2 + TALL_PITCH * 4 + TALL_LAST

/** Tool boxes in the tall family: a little narrower than the graph's, for a wider middle channel. */
const TALL_TOOL: readonly [number, number] = [148, 52]
const TALL_COLS = [94, 306] as const

/**
 * The tall family's cells (column, row). The office tools run down the right
 * and the field side down the left, so every line that carries an AI reader
 * or a sign-off valve gets a straight run of its own instead of meeting the
 * others at one junction.
 */
const TALL_CELL: Readonly<Record<string, readonly [0 | 1, number]>> = {
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
  store: [1, 5],
  monitor: [0, 5],
}

function tallRows(nodes: Graph<FirmLabel, FirmRev>['nodes']): Graph<FirmLabel, FirmRev>['nodes'] {
  return nodes.map((n) => {
    const cell = TALL_CELL[n.id]
    if (!cell) return n
    const size = n.kind === 'tool' ? TALL_TOOL : (n.sizeTall ?? n.size)
    // the new plumbing's row (store, monitor) sits closer: it has no hand-offs above it as found
    const y = TALL_ROW + Math.min(cell[1], 4) * TALL_PITCH + Math.max(0, cell[1] - 4) * TALL_LAST
    const [cx, cy] = [TALL_COLS[cell[0]], y]
    return { ...n, atTall: [cx - size[0] / 2, cy - size[1] / 2] as Pt, sizeTall: size }
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
    wide: (r) => [r.x + r.w + 30, r.y + r.h - 2],
    tall: (r) => [r.x + r.w - 16, r.y + r.h + 2],
  },
  p3: { wide: (r) => [r.x + 40, r.y + r.h + 60], tall: (r) => [r.x + r.w - 16, r.y + r.h + 2] },
}

/** People (and their place labels) the tall family leaves out once rewired. */
export const HOME_TALL_HIDDEN: readonly string[] = ['p2', 'p3']
const BESIDE: Readonly<Record<string, string>> = { p2: 'estimate', p3: 'field' }

/** The hand note by Timesheets: in the clear margin under it, per family. */
const NOTE_AT: Readonly<Record<LayoutId, Pt>> = { wide: [370, 548], tall: [22, 598] }

/**
 * Home leaves out the monitor's signal lines (branch routes m06, m08, m10):
 * drawn straight from the gauge, they cut through tool boxes and names at
 * every size. Its label says what it does ("watches every connection").
 */
const laidOut: Graph<FirmLabel, FirmRev> = {
  ...firmGraph,
  viewBox: { ...firmGraph.viewBox, tall: [0, 0, 400, TALL_H] },
  nodes: tallRows(firmGraph.nodes),
  routes: firmGraph.routes.filter((r) => r.kind !== 'branch'),
}

function stations(
  g: Graph<FirmLabel, FirmRev>,
  ps: ScaleFigure<FirmRev>[],
): ScaleFigure<FirmRev>[] {
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
function valveStations(
  g: Graph<FirmLabel, FirmRev>,
  ps: ScaleFigure<FirmRev>[],
): ScaleFigure<FirmRev>[] {
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
export const homeFirmGraph: Graph<FirmLabel, FirmRev> = {
  ...laidOut,
  people: stations(laidOut, valveStations(laidOut, people(laidOut))),
  notes: (firmGraph.notes ?? []).map((n) => ({ ...n, at: NOTE_AT.wide, atTall: NOTE_AT.tall })),
}
