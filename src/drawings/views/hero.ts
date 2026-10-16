import type {
  Graph,
  GraphNode,
  GraphRoute,
  GraphView,
  LayoutId,
  Port,
  Pt,
  ScaleFigure,
} from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import { applyView, pointAlong, routeGraph } from '../lib/route'

/**
 * The hero's view of the example firm (D2 A): seven tools, nine hand-carry
 * lines and three people as found; the rewired plan adds one AI reader, one
 * sign-off valve and the data store. Wide 960 × 640 (at 640 px and up), tall
 * 400 × 480 below that (CRM drops out: six tools, eight lines).
 *
 * Boxes are sized so every labelled node is at least 104 × 36 CSS px at the
 * family's narrowest container (520 px wide, 360 px tall). Isomorphic: no
 * roughjs, no DOM, no strings beyond ids and label keys.
 */

export const HERO_VIEWBOX: Readonly<Record<LayoutId, readonly [number, number, number, number]>> = {
  wide: [0, 0, 960, 640],
  tall: [0, 0, 400, 480],
}

/** Tool box sizes per family (user units). 200 × 72 is 108 × 39 CSS px at 520 px. */
export const HERO_BOX: Readonly<Record<LayoutId, readonly [number, number]>> = {
  wide: [200, 72],
  tall: [150, 48],
}

/** The data store's plan footprint (a tank, drawn as a circle). */
export const HERO_STORE: Readonly<Record<LayoutId, readonly [number, number]>> = {
  wide: [84, 84],
  tall: [64, 64],
}

const TOOLS = ['field', 'inbox', 'crm', 'estimate', 'pm', 'accounting', 'report'] as const
export type HeroTool = (typeof TOOLS)[number]

/** Hand-offs drawn as found (the firm's ids), and the rewired routes that replace them. */
const HANDOFFS = ['h01', 'h02', 'h03', 'h04', 'h05', 'h06', 'h08', 'h09', 'h10'] as const
const ROUTES = ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r08', 'r09', 'r10', 'r11'] as const

/** Centres per family. Tall has no CRM. */
const CENTRES: Readonly<Record<LayoutId, Readonly<Partial<Record<HeroTool | 'store', Pt>>>>> = {
  wide: {
    crm: [130, 96],
    estimate: [480, 96],
    pm: [830, 96],
    field: [130, 320],
    store: [480, 320],
    report: [830, 320],
    inbox: [130, 544],
    accounting: [480, 544],
  },
  tall: {
    estimate: [95, 52],
    pm: [305, 52],
    field: [95, 172],
    report: [305, 172],
    inbox: [95, 312],
    accounting: [305, 312],
    store: [305, 428],
  },
}

const topLeft = (c: Pt, s: readonly [number, number]): Pt => [c[0] - s[0] / 2, c[1] - s[1] / 2]

/** Which tools each family draws. */
export const HERO_TOOLS: Readonly<Record<LayoutId, readonly HeroTool[]>> = {
  wide: TOOLS,
  tall: TOOLS.filter((t) => t !== 'crm'),
}

/** The view (applyView) for one family. */
export function heroView(family: LayoutId): GraphView<FirmRev> {
  const nodes = [...HERO_TOOLS[family], 'store']
  const layout: Record<string, { at: Pt }> = {}
  for (const id of nodes) {
    const size = id === 'store' ? HERO_STORE[family] : HERO_BOX[family]
    layout[id] = { at: topLeft(CENTRES[family][id as HeroTool]!, size) }
  }
  return {
    id: 'hero',
    graph: 'firm',
    nodes,
    routes: [...HANDOFFS, ...ROUTES],
    layout,
  }
}

type Node = GraphNode<FirmLabel, FirmRev>
type Route = GraphRoute<FirmLabel, FirmRev>
type P = Readonly<Record<string, Port>>
const p = (side: Port['side'], at: number): Port => ({ side, at })

/**
 * Fixed ports for the rewired routes (keyed by route id), so the CAD plan runs straight where
 * the tools line up: accounting → store → report on one line, the leads along the top row.
 * Hand-off (as found) ports stay automatic: the sketch is meant to wander.
 */
const PORTS: Readonly<Record<LayoutId, Partial<Record<HeroTool | 'store', P>>>> = {
  wide: {
    crm: { r11: p('e', 0.5) },
    estimate: { r11: p('w', 0.5), r05: p('e', 0.5) },
    pm: {
      r05: p('w', 0.5),
      r04: p('s', 0.15),
      r03: p('s', 0.35),
      r09: p('s', 0.6),
      r06: p('s', 0.85),
    },
    field: { r04: p('e', 0.5), r01: p('s', 0.5) },
    inbox: { r01: p('n', 0.5), r03: p('e', 0.25), r02: p('e', 0.5) },
    accounting: { r02: p('w', 0.5), r08: p('n', 0.5), r06: p('e', 0.5) },
    store: { r08: p('s', 0.5), r09: p('n', 0.5), r10: p('e', 0.5) },
    report: { r10: p('w', 0.5) },
  },
  tall: {
    estimate: { r05: p('e', 0.5) },
    pm: {
      r05: p('w', 0.5),
      r04: p('s', 0.15),
      r03: p('s', 0.35),
      r06: p('e', 0.5),
      r09: p('s', 0.85),
    },
    field: { r04: p('e', 0.5), r01: p('s', 0.5) },
    inbox: { r01: p('n', 0.5), r03: p('e', 0.25), r02: p('e', 0.5) },
    accounting: { r02: p('w', 0.5), r08: p('s', 0.5), r06: p('e', 0.5) },
    store: { r08: p('n', 0.5), r09: p('e', 0.5), r10: p('w', 0.5) },
    report: { r10: p('w', 0.5) },
  },
}

/**
 * The hero graph of one family. Each family is its own graph: `at` and `size` are that
 * family's (so routing and every renderer can use the 'wide' accessors). Only one AI reader
 * and one sign-off valve (on the inbox → accounting ticket line), so the storyboard has one
 * of each.
 */
function build(family: LayoutId): Graph<FirmLabel, FirmRev> {
  const g = applyView(firmGraph, heroView(family))
  const vb = HERO_VIEWBOX[family]
  const nodes: Node[] = g.nodes.map((n) => {
    const size = n.id === 'store' ? HERO_STORE[family] : HERO_BOX[family]
    const { atTall: _a, sizeTall: _s, ...rest } = n as Node & { sizeTall?: unknown }
    void _a
    void _s
    return { ...rest, size, ports: PORTS[family][n.id as HeroTool | 'store'] ?? {} }
  })
  const routes: Route[] = g.routes.map((r) => {
    if (r.id === 'r03' || r.id === 'r04') return { ...r, ai: false, valve: false }
    return r
  })
  const base: Graph<FirmLabel, FirmRev> = {
    ...g,
    id: `hero-${family}`,
    viewBox: { wide: vb, tall: vb },
    designWidth: { wide: vb[2], tall: vb[2] },
    nodes,
    routes,
    notes: [],
    clouds: [],
  }
  return { ...base, people: people(base, family) }
}

/**
 * Figure height in user units (k = height / 64 for placeSymbol): 60 u is 9% of the wide frame.
 * The person at the sign-off valve is the subject there and stands HERO_SUBJECT times taller
 * (75 u, 12% of the frame).
 */
export const HERO_PERSON: Readonly<Record<LayoutId, number>> = { wide: 60, tall: 42 }
export const HERO_SUBJECT = 1.25

/**
 * As found on the line (at: fraction along it, wide and tall); rewired at the valve, at
 * estimating and on site. In the tall sketch the on-site carrier walks further down its line,
 * so the two clouds in the centre column never touch.
 */
const PEOPLE_PLAN = [
  { id: 'p1', on: 'h02', at: [0.62, 0.62], symbol: 'fig.at-valve' },
  { id: 'p2', on: 'h05', at: [0.5, 0.5], symbol: 'fig.tablet' },
  { id: 'p3', on: 'h04', at: [0.5, 0.8], symbol: 'fig.phone' },
] as const

/**
 * Where the rewired people stand (feet), per family: in clear space by their station, never on
 * a route or a box. p1 faces the valve's handwheel (drawn mirrored).
 */
export const HERO_STATIONS: Readonly<Record<LayoutId, Readonly<Record<string, Pt>>>> = {
  wide: { p1: [352, 504], p2: [618, 186], p3: [222, 482] },
  tall: { p1: [238, 280], p2: [152, 142], p3: [140, 280] },
}

function people(g: Graph<FirmLabel, FirmRev>, family: LayoutId): ScaleFigure<FirmRev>[] {
  const found = routeGraph(g, 'asFound', 'wide', { bend: 0 })
  return PEOPLE_PLAN.flatMap((p) => {
    const line = found.get(p.on)
    if (!line) return []
    const q = pointAlong(line.pts, p.at[family === 'wide' ? 0 : 1])
    return [
      {
        id: p.id,
        poses: {
          asFound: { symbol: 'fig.carrying-paper', at: [Math.round(q[0]), Math.round(q[1])] },
          rewired: { symbol: p.symbol, at: HERO_STATIONS[family][p.id]! },
        },
      },
    ]
  })
}

const cache = new Map<LayoutId, Graph<FirmLabel, FirmRev>>()
/** The hero graph per family (cached). Use the 'wide' accessors on both. */
export function heroGraph(family: LayoutId): Graph<FirmLabel, FirmRev> {
  let g = cache.get(family)
  if (!g) cache.set(family, (g = build(family)))
  return g
}

/** Where the rewired people stand that have a place label. */
export const HERO_PLACES = { p2: 'place.estimating', p3: 'place.site' } as const

/**
 * Hand notes (at most 3, finish standard A4): the tool they belong to and where they sit, in
 * clear margin space (viewBox units, the note's centre), never touching a box, line or label.
 */
export const HERO_NOTES: Readonly<
  Record<LayoutId, readonly { key: 'estimate' | 'inbox' | 'report'; at: Pt }[]>
> = {
  wide: [
    { key: 'estimate', at: [400, 28] },
    { key: 'inbox', at: [194, 614] },
    { key: 'report', at: [680, 382] },
  ],
  // the tall sketch has room for one note, in the empty band under the bottom row
  tall: [{ key: 'inbox', at: [125, 372] }],
}
