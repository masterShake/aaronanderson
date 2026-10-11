import type { Graph, GraphNode, GraphRoute, NodeKind, Pt, ScaleFigure, SymbolId } from '../types'
import { instrumentsOn, nodeRect, pointAlong, routeGraph, type SizedNode } from '../lib/route'

/**
 * The example firm (pages-drawings §3.1; Appendix B §B6): ten tools, twelve
 * hand-offs as found (each with its mode), fourteen rewired routes (each with
 * the hand-offs it replaces), four people. An example, not a client.
 *
 * Positions are Home B's layout (wide 960 × 600, tall 400 × 640); the hero
 * and S-01 re-lay it out through views (src/drawings/views/*). `at` is a box's
 * top-left corner. Label keys point into src/content/figures/firm.ts. No
 * strings here beyond ids and keys, and no counts: counts(firmGraph, rev).
 */

export const FIRM_TOOLS = [
  'crm',
  'estimate',
  'drive',
  'inbox',
  'pm',
  'accounting',
  'report',
  'field',
  'timesheets',
  'payroll',
] as const
export type FirmTool = (typeof FIRM_TOOLS)[number]
export type FirmInstrument = 'store' | 'monitor'
export type FirmRev = 'asFound' | 'rewired'
export const FIRM_REVS: readonly FirmRev[] = ['asFound', 'rewired']

export const FIRM_HANDOFFS = [
  'h01',
  'h02',
  'h03',
  'h04',
  'h05',
  'h06',
  'h07',
  'h08',
  'h09',
  'h10',
  'h11',
  'h12',
] as const
export type FirmHandoff = (typeof FIRM_HANDOFFS)[number]

/** Label keys (copy lives in src/content/figures/firm.ts under `labels`). */
export type FirmLabel =
  | `tool.${FirmTool}`
  | 'tool.estimate.rewired'
  | 'inst.ai'
  | 'inst.hv'
  | 'inst.store'
  | 'inst.monitor'
  | `move.${FirmHandoff}`
  | 'move.r14'
  | 'note.retyped'
  | 'note.plumbing'

/** Box size in user units: at least 104 × 36 CSS px at both families' minimum widths. */
export const FIRM_BOX: readonly [number, number] = [180, 64]
export const FIRM_BOX_TALL: readonly [number, number] = [160, 52]
const COLS_WIDE = [120, 360, 600, 840]
const ROWS_WIDE = [100, 300, 500]
const COLS_TALL = [100, 300]
const ROWS_TALL = [56, 160, 264, 368, 472, 576]

type Cell = `${'A' | 'B' | 'C' | 'D'}${1 | 2 | 3 | 4 | 5 | 6}`
const cellCenter = (c: Cell, cols: readonly number[], rows: readonly number[]): Pt => [
  cols['ABCD'.indexOf(c[0]!)]!,
  rows[Number(c[1]) - 1]!,
]
const topLeft = (c: Pt, size: readonly [number, number]): Pt => [
  c[0] - size[0] / 2,
  c[1] - size[1] / 2,
]

function place(
  id: string,
  kind: NodeKind,
  label: FirmLabel,
  wide: Cell,
  tall: Cell,
  size: readonly [number, number] = FIRM_BOX,
  extra: Partial<GraphNode<FirmLabel, FirmRev>> = {},
  sizeTall: readonly [number, number] = size === FIRM_BOX ? FIRM_BOX_TALL : size,
): GraphNode<FirmLabel, FirmRev> & SizedNode {
  return {
    id,
    kind,
    label,
    at: topLeft(cellCenter(wide, COLS_WIDE, ROWS_WIDE), size),
    atTall: topLeft(cellCenter(tall, COLS_TALL, ROWS_TALL), sizeTall),
    size,
    sizeTall,
    ports: {},
    ...extra,
  }
}

const NODES: GraphNode<FirmLabel, FirmRev>[] = [
  place('crm', 'tool', 'tool.crm', 'A1', 'A1', FIRM_BOX, { era: 'E' }),
  place('estimate', 'tool', 'tool.estimate', 'B1', 'B1', FIRM_BOX, { era: 'E' }),
  place('drive', 'tool', 'tool.drive', 'C1', 'B4', FIRM_BOX, { era: 'E' }),
  place('inbox', 'tool', 'tool.inbox', 'A2', 'A2', FIRM_BOX, { era: 'E' }),
  place('pm', 'tool', 'tool.pm', 'B2', 'B2', FIRM_BOX, { era: 'E' }),
  place('accounting', 'tool', 'tool.accounting', 'C2', 'B3', FIRM_BOX, { era: 'E' }),
  place('report', 'tool', 'tool.report', 'D2', 'B5', FIRM_BOX, { era: 'E' }),
  place('field', 'tool', 'tool.field', 'A3', 'A3', FIRM_BOX, { era: 'E' }),
  place('timesheets', 'tool', 'tool.timesheets', 'B3', 'A4', FIRM_BOX, { era: 'E' }),
  place('payroll', 'tool', 'tool.payroll', 'C3', 'A5', FIRM_BOX, { era: 'E' }),
  place('store', 'store', 'inst.store', 'D3', 'B6', [52, 68], {
    era: 'N',
    revs: ['rewired'],
    symbol: 'sym.data-tank',
    detail: 'S-04',
  }),
  place('monitor', 'monitor', 'inst.monitor', 'D1', 'A6', [32, 32], {
    era: 'N',
    revs: ['rewired'],
    symbol: 'sym.monitor',
    detail: 'S-06',
  }),
]

type R = GraphRoute<FirmLabel, FirmRev>
const handoff = (
  id: FirmHandoff,
  from: FirmTool,
  to: FirmTool,
  mode: R['mode'],
  extra: Partial<R> = {},
): R => ({
  id,
  from: `${from}.${id}`,
  to: `${to}.${id}`,
  kind: mode === 'sync' ? 'conduit' : 'hand-carry',
  mode,
  carries: `move.${id}`,
  revs: ['asFound'],
  ...(mode !== 'sync' ? { manual: true } : {}),
  ...extra,
})
const route = (
  id: string,
  from: FirmTool | FirmInstrument,
  to: FirmTool | FirmInstrument,
  replaces: readonly FirmHandoff[],
  extra: Partial<R> = {},
): R => ({
  id,
  from: `${from}.${id}`,
  to: `${to}.${id}`,
  kind: 'conduit',
  replaces,
  revs: ['rewired'],
  ...extra,
})

const ROUTES: R[] = [
  handoff('h01', 'field', 'inbox', 'forward'),
  handoff('h02', 'inbox', 'accounting', 'retype', { person: 'p1' }),
  handoff('h03', 'inbox', 'pm', 'forward'),
  handoff('h04', 'pm', 'field', 'forward', { person: 'p3' }),
  handoff('h05', 'estimate', 'pm', 'retype', { person: 'p2' }),
  handoff('h06', 'pm', 'accounting', 'retype'),
  handoff('h07', 'pm', 'drive', 'forward'),
  handoff('h08', 'accounting', 'report', 'export'),
  handoff('h09', 'pm', 'report', 'retype'),
  handoff('h10', 'crm', 'estimate', 'retype'),
  handoff('h11', 'field', 'timesheets', 'retype', { person: 'p4' }),
  handoff('h12', 'timesheets', 'payroll', 'sync'),
  route('r01', 'field', 'inbox', ['h01'], { carries: 'move.h01' }),
  route('r02', 'inbox', 'accounting', ['h02'], { ai: true, valve: true, carries: 'move.h02' }),
  route('r03', 'inbox', 'pm', ['h03'], { ai: true, carries: 'move.h03' }),
  route('r04', 'pm', 'field', ['h04'], { valve: true, carries: 'move.h04' }),
  route('r05', 'estimate', 'pm', ['h05'], { carries: 'move.h05' }),
  route('r06', 'pm', 'accounting', ['h06'], { carries: 'move.h06' }),
  route('r07', 'pm', 'drive', ['h07'], { carries: 'move.h07' }),
  route('r08', 'accounting', 'store', ['h08'], { carries: 'move.h08' }),
  route('r09', 'pm', 'store', ['h09'], { carries: 'move.h09' }),
  route('r10', 'store', 'report', ['h08', 'h09']),
  route('r11', 'crm', 'estimate', ['h10'], { carries: 'move.h10' }),
  route('r12', 'field', 'timesheets', ['h11'], { carries: 'move.h11' }),
  route('r13', 'timesheets', 'payroll', ['h12'], { carries: 'move.h12' }),
  route('r14', 'timesheets', 'store', [], { carries: 'move.r14' }),
  // the monitor's signal lines end on the routes it watches
  { id: 'm06', from: 'monitor.s', to: 'r06.mid', kind: 'branch', revs: ['rewired'] },
  { id: 'm08', from: 'monitor.s', to: 'r08.mid', kind: 'branch', revs: ['rewired'] },
  { id: 'm10', from: 'monitor.s', to: 'r10.mid', kind: 'branch', revs: ['rewired'] },
]

const base: Graph<FirmLabel, FirmRev> = {
  id: 'firm',
  viewBox: { wide: [0, 0, 960, 600], tall: [0, 0, 400, 640] },
  designWidth: { wide: 960, tall: 400 },
  revs: FIRM_REVS,
  nodes: NODES,
  routes: ROUTES,
  seed: 1931,
}

/** People: on their hand-off lines as found; at a valve or beside a tool once rewired. */
const PEOPLE_PLAN: readonly {
  id: string
  on: FirmHandoff
  at: number
  station: { valveOf: string } | { beside: FirmTool }
  found: SymbolId
  rewired: SymbolId
}[] = [
  {
    id: 'p1',
    on: 'h02',
    at: 0.5,
    station: { valveOf: 'r02' },
    found: 'fig.carrying-paper',
    rewired: 'fig.at-valve',
  },
  {
    id: 'p2',
    on: 'h05',
    at: 0.5,
    station: { beside: 'estimate' },
    found: 'fig.carrying-paper',
    rewired: 'fig.tablet',
  },
  {
    id: 'p3',
    on: 'h04',
    at: 0.45,
    station: { beside: 'field' },
    found: 'fig.carrying-paper',
    rewired: 'fig.phone',
  },
  {
    id: 'p4',
    on: 'h11',
    at: 0.5,
    station: { valveOf: 'r04' },
    found: 'fig.carrying-paper',
    rewired: 'fig.at-valve',
  },
]

function people(g: Graph<FirmLabel, FirmRev>): ScaleFigure<FirmRev>[] {
  const fam = (family: 'wide' | 'tall') => ({
    found: routeGraph(g, 'asFound', family, { bend: 0 }),
    rewired: routeGraph(g, 'rewired', family),
  })
  const W = fam('wide')
  const T = fam('tall')
  const station = (p: (typeof PEOPLE_PLAN)[number], r: typeof W, family: 'wide' | 'tall'): Pt => {
    if ('valveOf' in p.station) {
      const s = instrumentsOn(r.rewired.get(p.station.valveOf)!).station!
      return [Math.round(s[0]), Math.round(s[1])]
    }
    const n = g.nodes.find((x) => x.id === (p.station as { beside: FirmTool }).beside)!
    const rc = nodeRect(n, family)
    return [Math.round(rc.x + rc.w - 16), Math.round(rc.y + rc.h + 2)]
  }
  const onLine = (p: (typeof PEOPLE_PLAN)[number], r: typeof W): Pt => {
    const q = pointAlong(r.found.get(p.on)!.pts, p.at)
    return [Math.round(q[0]), Math.round(q[1])]
  }
  return PEOPLE_PLAN.map((p) => ({
    id: p.id,
    poses: {
      asFound: { symbol: p.found, at: onLine(p, W), atTall: onLine(p, T) },
      rewired: { symbol: p.rewired, at: station(p, W, 'wide'), atTall: station(p, T, 'tall') },
    },
  }))
}

/** Hand notes (2 for Home B): keys into content, positions in viewBox units. */
const NOTES: Graph<FirmLabel, FirmRev>['notes'] = [
  { key: 'note.retyped', at: [370, 548], atTall: [24, 410], rotate: -3 },
  { key: 'note.plumbing', at: [24, 572], atTall: [210, 620], rotate: -2 },
]

export const firmGraph: Graph<FirmLabel, FirmRev> = { ...base, people: people(base), notes: NOTES }

/** Which detail bubble (service sheet) each Rewired element points to (pages-drawings §3.6). */
export const FIRM_DETAILS = {
  'S-02': 'r05',
  'S-03': 'r02',
  'S-04': 'store',
  'S-05': 'p1',
  'S-06': 'monitor',
} as const
