import type { Graph, GraphView, LayoutId, Port, Pt, ViewBox } from '../types'
import { applyView, routeGraph, type Routed } from '../lib/route'
import { ticketGraph, type TicketLabel, type TicketRev } from '../graphs/ticket'

/**
 * Layout of the ticket figure (pages-drawings §6 table: wide 960 × 720, tall
 * 400 × 500). The left part of the sheet (the ticket, the truck, the field
 * lead) never changes; tracing paper, then the deep panel, cover the rest.
 * `at` is a box's top-left corner. Isomorphic, no strings.
 */

type Rect = readonly [x: number, y: number, w: number, h: number]

export const TICKET_VIEW: GraphView<TicketRev> = {
  id: 'ticket',
  graph: 'ticket',
  nodes: ticketGraph.nodes.map((n) => n.id),
  routes: ticketGraph.routes.map((r) => r.id),
  viewBox: { wide: [0, 0, 960, 720], tall: [0, 0, 400, 500] },
  layout: {
    ticket: { at: [24, 24], atTall: [244, 12] },
    truck: { at: [24, 216], atTall: [16, 12] },
    field: { at: [24, 400], atTall: [16, 84] },
    pm: { at: [312, 64], atTall: [16, 164] },
    inbox: { at: [534, 64], atTall: [244, 164] },
    office: { at: [756, 64], atTall: [244, 236] },
    po: { at: [534, 236], atTall: [16, 236] },
    accounting: { at: [756, 236], atTall: [244, 308] },
    jobCost: { at: [312, 236], atTall: [16, 308] },
    match: { at: [420, 400], atTall: [16, 380] },
    acct: { at: [756, 400], atTall: [244, 380] },
    job: { at: [756, 568], atTall: [244, 444] },
  },
}

/** Fixed ports and bends per family, where the automatic router needs a hand. */
const PORTS: Readonly<Record<LayoutId, Readonly<Record<string, Readonly<Record<string, Port>>>>>> =
  {
    wide: {
      field: { photo: { side: 'e', at: 0.5 } },
      pm: { w: { side: 'w', at: 0.5 } },
      inbox: { out: { side: 'e', at: 0.4 } },
      office: {
        in: { side: 'w', at: 0.4 },
        po: { side: 'w', at: 0.85 },
        acct: { side: 's', at: 0.85 },
      },
      po: { in: { side: 'n', at: 0.5 } },
      accounting: { in: { side: 'n', at: 0.85 } },
    },
    tall: { field: { e: { side: 'e', at: 0.5 } } },
  }
const VIA: Readonly<Record<LayoutId, Readonly<Record<string, readonly Pt[]>>>> = {
  wide: {
    r2: [
      [262, 432],
      [262, 96],
    ],
    r5: [
      [735, 118.4],
      [735, 172],
      [624, 172],
    ],
  },
  tall: {
    n1: [
      [200, 108],
      [200, 362],
      [86, 362],
    ],
  },
}

/** The ticket graph laid out for one family (positions, fixed ports and bends). */
export function ticketGraphFor(family: LayoutId): Graph<TicketLabel, TicketRev> {
  const g = applyView(ticketGraph, TICKET_VIEW)
  return {
    ...g,
    nodes: g.nodes.map((n) => {
      const p = PORTS[family][n.id]
      return p ? { ...n, ports: { ...n.ports, ...p } } : n
    }),
    routes: g.routes.map((r) => {
      const via = VIA[family][r.id]
      return via ? { ...r, via } : r
    }),
  }
}

/** The longest straight run of a polyline (instruments never straddle a bend). */
function longest(pts: readonly Pt[]): readonly [Pt, Pt] {
  let a = pts[0]!
  let b = pts[1] ?? pts[0]!
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!
    const q = pts[i]!
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(b[0] - a[0], b[1] - a[1])) {
      a = p
      b = q
    }
  }
  return [a, b]
}

const along = (seg: readonly [Pt, Pt], t: number): Pt => [
  seg[0][0] + (seg[1][0] - seg[0][0]) * t,
  seg[0][1] + (seg[1][1] - seg[0][1]) * t,
]

export interface TicketGeometry {
  graph: Graph<TicketLabel, TicketRev>
  /** Routed corner points of every route, as found (rev0) and rewired (rev1 on). */
  old: ReadonlyMap<string, Routed>
  neu: ReadonlyMap<string, Routed>
  ai: Pt
  tolerance: Pt
  /** The exception branch: off the line, down, along, back up. */
  branch: readonly Pt[]
  valve: Pt
  packets: readonly Pt[]
  monitor: Pt
  watch: Pt
  flange: Pt
}

/** Where every instrument and mark sits, shared by the drawing and the HTML labels. */
export function ticketGeometry(family: LayoutId): TicketGeometry {
  const graph = ticketGraphFor(family)
  const old = routeGraph(graph, 'rev0', family, { bend: 0 })
  const neu = routeGraph(graph, 'rev1', family)
  const ex = TICKET_EXTRAS[family]
  const n1 = longest(neu.get('n1')!.pts)
  const n2 = longest(neu.get('n2')!.pts)
  const [f, t, drop] = ex.branch
  const a = along(n2, f)
  const b = along(n2, t)
  const branch: Pt[] = [a, [a[0], a[1] + drop], [b[0], b[1] + drop], b]
  const seg = (r: 'n1' | 'n2') => (r === 'n1' ? n1 : n2)
  return {
    graph,
    old,
    neu,
    ai: along(n1, 0.5),
    tolerance: along(n2, ex.tolerance),
    branch,
    valve: [(a[0] + b[0]) / 2, a[1] + drop],
    packets: ex.packets.map(([r, at]) => along(seg(r), at)),
    monitor: ex.monitor[0],
    watch: [ex.monitor[0][0], along(n2, ex.monitor[2])[1]],
    flange: along(n2, ex.flange),
  }
}

/** Everything drawn beside the graph, per family. */
export interface TicketExtras {
  viewBox: ViewBox
  /** The tracing paper (REV 1), then the deep panel (REV 2 on). */
  zone: Rect
  /** Symbol scale for instruments. */
  k: number
  /** Scale figures: the field lead with a phone, the project manager at the valve (wide only). */
  people: readonly { id: string; symbol: 'fig.phone' | 'fig.at-valve'; feet: Pt; k: number }[]
  /** Tape measure under the hand-off count. */
  tape: Rect
  /** Where along n1 the AI reader sits, and n2's tolerance and exception branch (fractions). */
  tolerance: number
  branch: readonly [from: number, to: number, drop: number]
  /** The redline cloud around the sign-off (REV 1). */
  cloud: Rect
  /** Test packets (REV 2), as fractions along n1, n1, n2. */
  packets: readonly (readonly [route: 'n1' | 'n2', t: number])[]
  /** The hand-over documents (REV 3): rect and rotation. */
  docs: readonly (readonly [key: TicketLabel, rect: Rect, deg: number])[]
  /** Monitor centre (REV 4) and the point on the line it watches. */
  monitor: readonly [at: Pt, watch: 'n2', t: number]
  /** The flange that pulses on n2 (fraction). */
  flange: number
  /** Box sizes of the label tags that are not nodes (x, y, width in user units). */
  tags: Readonly<Record<string, Rect>>
}

export const TICKET_EXTRAS: Readonly<Record<LayoutId, TicketExtras>> = {
  wide: {
    viewBox: [0, 0, 960, 720],
    zone: [288, 0, 672, 720],
    k: 1.3,
    people: [
      { id: 'lead', symbol: 'fig.phone', feet: [150, 596], k: 1.5 },
      { id: 'signer', symbol: 'fig.at-valve', feet: [628, 604], k: 1.3 },
    ],
    tape: [24, 628, 216, 16],
    tolerance: 0.16,
    branch: [0.3, 0.86, 44],
    cloud: [636, 436, 110, 72],
    packets: [
      ['n1', 0.22],
      ['n1', 0.72],
      ['n2', 0.55],
    ],
    docs: [
      ['doc.guide', [500, 144, 132, 92], -6],
      ['doc.walkthrough', [646, 136, 132, 92], 0],
      ['doc.guideline', [792, 144, 132, 92], 6],
    ],
    monitor: [[690, 342], 'n2', 0.58],
    flange: 0.88,
    tags: {
      tape: [24, 652, 256, 40],
      ai: [290, 458, 120, 20],
      tolerance: [566, 374, 150, 20],
      signOff: [420, 508, 180, 60],
      markup: [420, 616, 300, 44],
      test: [216, 442, 64, 20],
      parallel: [312, 312, 220, 20],
      punch: [312, 136, 172, 96],
      monitor: [716, 318, 120, 20],
      fixed: [716, 346, 200, 20],
      'carry.paper': [128, 334, 140, 20],
      'carry.photo': [276, 318, 130, 20],
      'carry.forward': [470, 40, 140, 20],
      'carry.print': [690, 40, 140, 20],
      'carry.po': [556, 134, 160, 20],
      'carry.lines': [760, 134, 140, 20],
    },
  },
  tall: {
    viewBox: [0, 0, 400, 500],
    zone: [0, 148, 400, 352],
    k: 1,
    people: [],
    tape: [0, 0, 0, 0],
    tolerance: 0.2,
    branch: [0.36, 0.86, 26],
    cloud: [176, 404, 66, 40],
    packets: [
      ['n1', 0.3],
      ['n1', 0.62],
      ['n2', 0.5],
    ],
    docs: [
      ['doc.guide', [16, 156, 112, 56], -6],
      ['doc.walkthrough', [272, 156, 112, 56], 6],
      ['doc.guideline', [272, 244, 112, 56], 0],
    ],
    monitor: [[226, 338], 'n2', 0.8],
    flange: 0.9,
    tags: {
      ai: [218, 214, 90, 20],
      signOff: [16, 440, 168, 52],
      markup: [16, 300, 180, 48],
      punch: [16, 252, 170, 80],
      monitor: [252, 322, 132, 20],
      fixed: [252, 344, 132, 20],
    },
  },
}
