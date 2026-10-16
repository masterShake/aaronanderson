import type { Graph, GraphView, LayoutId, Pt, ViewBox } from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import { applyView, center, nodeRect, type Rect } from '../lib/route'
import { counts, touches } from '../lib/counts'
import { glyphLines, type GlyphKind } from './s02'
import { S01 } from '@/motion/timing/s01'

/**
 * S-01 Systems Survey (owner: svc-a): the example firm's eight office tools and nine
 * hand-offs, as found, two columns by four rows. Each box is a piece of equipment: its name
 * top left, its glyph (envelope, spreadsheet grid, Gantt bars, …) on the right, and, once
 * the survey has crossed it, how many hand-offs it takes by hand, bottom left.
 *
 * Wide (960 × 720): the map fills the left 600 units, top to bottom (the deep panel covers
 * it at the redraw); the surveyor stands at the total station at the top of the right-hand
 * column, and the ranked list and the roadmap (an HTML panel) fill the column under him.
 * Tall (400 × 500): the map fills the top, the surveyor stands under it, and the list sits
 * below.
 *
 * A surveyor at a total station sweeps a 12° fan across the boxes; the three boxes with the
 * most by-hand hand-offs get revision clouds Δ1–Δ3. Geometry only (no strings, no roughjs):
 * drawing.server.ts renders it, and the figure reads the label positions and progress
 * windows from here.
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
  wide: [0, 0, 960, 720],
  tall: [0, 0, 400, 500],
}
/** The map's area: the deep panel and the scan cover it; the surveyor and the list sit outside. */
export const S01_ART: Readonly<Record<LayoutId, Rect>> = {
  wide: { x: 0, y: 0, w: 600, h: 720 },
  tall: { x: 0, y: 0, w: 400, h: 256 },
}

/* Wide: the left column is wider, for the longest name (a file name never wraps). */
const BOX_W: readonly (readonly [number, number])[] = [
  [296, 144],
  [228, 144],
]
const BOX_T: readonly [number, number] = [184, 56]
/* a 44-unit gutter between the columns, for the hand-off lines that run up it */
const COL_W = [20, 360]
const ROW_W = [36, 204, 372, 540]
const COL_T = [8, 208]
const ROW_T = [6, 68, 130, 192]

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

/** The glyph that names each tool. */
export const S01_GLYPH: Readonly<Record<S01Tool, GlyphKind>> = {
  estimate: 'grid',
  drive: 'folder',
  pm: 'gantt',
  inbox: 'envelope',
  field: 'phone',
  accounting: 'ledger',
  timesheets: 'timecard',
  payroll: 'paycheck',
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
 * no people or notes of the firm's (the surveyor is drawn by the figure).
 */
export const s01Graph: Graph<FirmLabel, FirmRev> = {
  ...viewed,
  nodes: viewed.nodes.map((n) => ({
    ...n,
    size: BOX_W[CELL[n.id as S01Tool][0]]!,
    sizeTall: BOX_T,
  })),
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

/** Where a tool's glyph sits: right of centre, below the name's line (smaller in tall). */
function glyphAt(tool: S01Tool, family: LayoutId): { c: Pt; s: number } {
  const r = rectOf(tool, family)
  const s = r.h * (family === 'wide' ? 0.46 : 0.42)
  const cy = family === 'wide' ? 0.58 : 0.62
  return { c: [r.x + r.w - 0.75 * s - r.h * 0.14, r.y + r.h * cy], s }
}

/** The tool's glyph (open polylines). */
export function s01Glyph(tool: S01Tool, family: LayoutId): Pt[][] {
  const { c, s } = glyphAt(tool, family)
  return glyphLines(S01_GLYPH[tool], c, s)
}

/** The survey crosshair: the instrument's sight on the tool, centred on its glyph. */
export function crossAt(tool: S01Tool, family: LayoutId): { c: Pt; r: number; arm: number } {
  return {
    c: glyphAt(tool, family).c,
    r: family === 'wide' ? 15 : 6,
    arm: family === 'wide' ? 26 : 11,
  }
}

/**
 * The total station: feet of the tripod and the instrument head (the fan's origin), and the
 * surveyor beside it. Wide: top of the right-hand column (the list hangs below), the
 * surveyor mirrored so he faces the instrument. Tall: under the map, at its left.
 */
export const S01_STATION: Readonly<
  Record<LayoutId, { feet: Pt; head: Pt; person: Pt; k: number; mirror: boolean }>
> = {
  wide: { feet: [752, 152], head: [752, 90], person: [812, 152], k: 1.2, mirror: true },
  tall: { feet: [22, 294], head: [22, 274], person: [46, 296], k: 0.52, mirror: false },
}

/**
 * Fan: 12° wide, drawn pointing at startDeg (screen degrees, y down: 0 east, 180 west) and
 * swept counterclockwise through sweepDeg. Long enough to reach every box.
 */
export const S01_FAN = {
  halfDeg: 6,
  startDeg: { wide: 188, tall: 0 },
  sweepDeg: { wide: 72, tall: 86 },
  len: { wide: 860, tall: 420 },
} as const

const deg = (a: Pt, b: Pt) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI

/** Progress at which the fan's centre line crosses each tool (linear in the sweep window). */
export function crossP(tool: S01Tool, family: LayoutId): number {
  const th = deg(S01_STATION[family].head, center(rectOf(tool, family)))
  const a = (((S01_FAN.startDeg[family] - th) % 360) + 360) % 360
  const t = Math.min(1, Math.max(0, a / S01_FAN.sweepDeg[family]))
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
    return [r.x + (f === 'wide' ? 12 : 7), r.y + (f === 'wide' ? 10 : 4)]
  })

/** Survey tag ("3 BY HAND"): inside the box, bottom left (the tag hangs up from here). */
export const tagAt = (tool: S01Tool): S01Pos =>
  both((f) => {
    const r = rectOf(tool, f)
    return [r.x + (f === 'wide' ? 12 : 7), r.y + r.h - (f === 'wide' ? 10 : 4)]
  })

/** Δ tag: inside the box, top right, where the crosshair was (the tag hangs left from here). */
export const cloudTagAt = (tool: S01Tool): S01Pos =>
  both((f) => {
    const r = rectOf(tool, f)
    return [r.x + r.w - (f === 'wide' ? 8 : 4), r.y + (f === 'wide' ? 8 : 3)]
  })

/** The ranked list panel: under the surveyor, right of the map (wide); below them (tall). */
export const S01_LIST: S01Pos = { wide: pctOf([626, 176], 'wide'), tall: pctOf([10, 304], 'tall') }

/** The ranked list: item keys with effort and payoff on a three-step scale. */
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
