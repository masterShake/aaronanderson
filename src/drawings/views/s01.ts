import type { Graph, GraphView, LayoutId, Pt, ViewBox } from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import { applyView, center, nodeRect, type Rect } from '../lib/route'
import { counts, touches } from '../lib/counts'
import { S01 } from '@/motion/timing/s01'

/**
 * S-01 Systems Survey (pages-drawings §6.1): the example firm's eight office
 * tools and nine hand-offs, as found, in a cramped two-column layout. The art
 * sits left of x = 640 in the wide family (the ranked list is an HTML panel at
 * the right) and above y = 330 in the tall family (the list sits below it).
 * A surveyor at a total station sweeps a 12° fan across the boxes; the three
 * boxes with the most by-hand hand-offs get revision clouds Δ1–Δ3.
 *
 * Geometry only (no strings, no roughjs): drawing.server.ts renders it, and
 * the figure reads the label positions and progress windows from here.
 */

export const S01_TOOLS = [
  'estimate',
  'drive',
  'pm',
  'inbox',
  'field',
  'accounting',
  'timesheets',
  'payroll',
] as const
export type S01Tool = (typeof S01_TOOLS)[number]
export const S01_ROUTES = ['h01', 'h02', 'h03', 'h04', 'h05', 'h06', 'h07', 'h11', 'h12'] as const

export const S01_VB: { wide: ViewBox; tall: ViewBox } = {
  wide: [0, 0, 960, 640],
  tall: [0, 0, 400, 500],
}
/** The drawing's own area: the deep panel and the scan cover it; the list panel sits outside. */
export const S01_ART: Readonly<Record<LayoutId, Rect>> = {
  wide: { x: 0, y: 0, w: 640, h: 640 },
  tall: { x: 0, y: 0, w: 400, h: 300 },
}

const BOX_W: readonly [number, number] = [280, 84]
const BOX_T: readonly [number, number] = [180, 46]
const COL_W = [20, 340]
const ROW_W = [40, 180, 320, 460]
const COL_T = [10, 210]
const ROW_T = [8, 68, 128, 188]

/** Cell of each tool: [column, row]. pm is the hub, so it sits by inbox, field and estimate. */
const CELL: Readonly<Record<S01Tool, readonly [number, number]>> = {
  estimate: [0, 0],
  drive: [1, 0],
  pm: [0, 1],
  inbox: [1, 1],
  field: [0, 2],
  accounting: [1, 2],
  timesheets: [0, 3],
  payroll: [1, 3],
}

export const S01_VIEW: GraphView<FirmRev> = {
  id: 's01',
  graph: 'firm',
  nodes: S01_TOOLS,
  routes: S01_ROUTES,
  viewBox: S01_VB,
  revs: ['asFound'],
  layout: Object.fromEntries(
    S01_TOOLS.map((t) => {
      const [c, r] = CELL[t]
      return [t, { at: [COL_W[c]!, ROW_W[r]!] as Pt, atTall: [COL_T[c]!, ROW_T[r]!] as Pt }]
    }),
  ),
}

const viewed = applyView(firmGraph, S01_VIEW)

/**
 * The S-01 graph: the firm re-laid out by S01_VIEW, with its own box sizes and
 * no people or notes of the firm's (the surveyor is drawn by the figure; the
 * hand notes are HTML).
 */
export const s01Graph: Graph<FirmLabel, FirmRev> = {
  ...viewed,
  nodes: viewed.nodes.map((n) => ({ ...n, size: BOX_W, sizeTall: BOX_T })),
  people: [],
  notes: [],
  clouds: [],
  seed: 2201,
}

export const S01_REV = 'asFound'

/** By-hand hand-offs per tool, highest first (ties keep the tool order). */
export const S01_BY_HAND: readonly { tool: S01Tool; k: number }[] = S01_TOOLS.map((tool) => ({
  tool,
  k: touches(s01Graph, S01_REV, tool).manual,
})).sort((a, b) => b.k - a.k)

/** The three bottlenecks the survey clouds, Δ1 to Δ3. */
export const S01_CLOUDED: readonly S01Tool[] = S01_BY_HAND.slice(0, 3).map((x) => x.tool)

/** Counts for the caption and long description. */
export const S01_COUNTS = {
  ...counts(s01Graph, S01_REV),
  bottlenecks: S01_CLOUDED.length,
}

export const rectOf = (tool: S01Tool, family: LayoutId): Rect =>
  nodeRect(
    s01Graph.nodes.find((n) => n.id === tool)!,
    family,
  )

/** The total station: feet of the tripod and the instrument head (the fan's origin). */
export const S01_STATION: Readonly<Record<LayoutId, { feet: Pt; head: Pt; person: Pt }>> = {
  wide: { feet: [60, 620], head: [60, 584], person: [112, 622] },
  tall: { feet: [24, 294], head: [24, 274], person: [52, 296] },
}

/** Fan: 12° wide, starts pointing east, sweeps up through sweepDeg. Long enough to reach every box. */
export const S01_FAN = { halfDeg: 6, sweepDeg: 80, len: { wide: 700, tall: 420 } } as const

const deg = (a: Pt, b: Pt) => (-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI

/** Progress at which the fan's centre line crosses each tool (linear in the sweep window). */
export function crossP(tool: S01Tool, family: LayoutId): number {
  const a = deg(S01_STATION[family].head, center(rectOf(tool, family)))
  const t = Math.min(1, Math.max(0, a / S01_FAN.sweepDeg))
  return Math.round((S01.sweepFromP + t * (S01.sweepToP - S01.sweepFromP)) * 1000) / 1000
}

/** Label positions in viewBox units, per family. */
const pctOf = (p: Pt, family: LayoutId): Pt => {
  const [, , w, h] = S01_VB[family]
  return [Math.round((p[0] / w) * 10000) / 100, Math.round((p[1] / h) * 10000) / 100]
}

export interface S01Pos {
  wide: Pt
  tall: Pt
}
const both = (fw: (f: LayoutId) => Pt): S01Pos => ({
  wide: pctOf(fw('wide'), 'wide'),
  tall: pctOf(fw('tall'), 'tall'),
})

/** Tool name: inside the box, top left. */
export const toolLabelAt = (tool: S01Tool): S01Pos =>
  both((f) => {
    const r = rectOf(tool, f)
    return [r.x + (f === 'wide' ? 12 : 8), r.y + (f === 'wide' ? 12 : 6)]
  })

/** Survey tag ("TOOL 01 · 3 BY HAND"): just under the box. */
export const tagAt = (tool: S01Tool): S01Pos =>
  both((f) => {
    const r = rectOf(tool, f)
    return [r.x + 4, r.y + r.h + (f === 'wide' ? 6 : 3)]
  })

/** Δ tag digit: at the cloud's top-left corner. */
export const cloudTagAt = (tool: S01Tool): S01Pos =>
  both((f) => {
    const r = rectOf(tool, f)
    return [r.x - 6, r.y - (f === 'wide' ? 28 : 20)]
  })

/** Hand notes (and the specs they become), in the strip under the boxes. */
export const S01_NOTES = {
  head: { wide: pctOf([136, 560], 'wide'), tall: pctOf([76, 252], 'tall') },
  version: { wide: pctOf([400, 560], 'wide'), tall: pctOf([228, 252], 'tall') },
} as const

/** The ranked list panel: right of the art (wide), below it (tall). */
export const S01_LIST: S01Pos = { wide: pctOf([664, 24], 'wide'), tall: pctOf([10, 306], 'tall') }

/** The ranked list (EXAMPLE): item keys with effort and payoff on a three-step scale. */
export const S01_ITEMS = [
  { key: 'item.1', effort: 1, payoff: 3 },
  { key: 'item.2', effort: 2, payoff: 3 },
  { key: 'item.3', effort: 2, payoff: 2 },
] as const

/** The roadmap: a dimension string of three equal spans. */
export const S01_ROADMAP_DAYS = [0, 30, 60, 90] as const

/** Where the scan reaches a label (0 to 1 of the art width), for its ink change. */
export const scanX = (pos: S01Pos): S01Pos => ({
  wide: [Math.min(1, ((pos.wide[0] / 100) * S01_VB.wide[2]) / S01_ART.wide.w), pos.wide[1]],
  tall: [Math.min(1, ((pos.tall[0] / 100) * S01_VB.tall[2]) / S01_ART.tall.w), pos.tall[1]],
})
