import type { LayoutId, Pt, SymbolId, ViewBox } from '../types'
import { symbolDef } from '../symbols'

/**
 * S-05 Team Enablement (pages-drawings §6.5): paper only, never blueprint.
 * Three people in hard hats (estimator, project manager, field lead), each
 * with a question bubble, are handed a tool they hold at the hand: a prompt
 * playbook (binder), an AI-use guideline (sheet) and a recorded walkthrough
 * (tablet). The tools are the only orange: a 1.5 u asphalt keyline over a 3 u
 * orange underlay. Callouts arrive as a ladder; then a new hire walks to a
 * desk, the walkthrough plays on its monitor and a training record fills in.
 *
 * Geometry only (no strings, no roughjs): drawing.server.ts renders it, and
 * the figure reads the label positions from here. Wide 960 × 560 (the crew
 * left, the new hire right); tall 400 × 500 (the crew on top, the new hire below).
 */

export const S05_VB: { wide: ViewBox; tall: ViewBox } = {
  wide: [0, 0, 960, 560],
  tall: [0, 0, 400, 500],
}

export type S05Person = 'estimator' | 'pm' | 'field'
export type S05Tool = 'playbook' | 'guideline' | 'walkthrough'

export interface S05Crew {
  person: S05Person
  symbol: SymbolId
  tool: S05Tool
  /** Callout label key in the figure copy (its second line is `${callout}.sub`). */
  callout: 'callout.playbook' | 'callout.guideline' | 'callout.walkthrough'
}

export const S05_CREW: readonly S05Crew[] = [
  {
    person: 'estimator',
    symbol: 'fig.hardhat-estimator',
    tool: 'playbook',
    callout: 'callout.playbook',
  },
  { person: 'pm', symbol: 'fig.hardhat-pm', tool: 'guideline', callout: 'callout.guideline' },
  {
    person: 'field',
    symbol: 'fig.hardhat-estimator',
    tool: 'walkthrough',
    callout: 'callout.walkthrough',
  },
]

interface Fam {
  /** Ground line ends (the crew's). */
  ground: readonly [Pt, Pt]
  /** Second ground line (the new hire's), tall only. */
  ground2?: readonly [Pt, Pt]
  /** Feet x of each crew member, and their scale (figure height 64 u × k). */
  crew: readonly number[]
  k: number
  /** Question bubble: radius, and its centre from the feet. */
  q: { r: number; dx: number; up: number }
  /** Tool size, and where its top-left sits from the hand anchor. */
  tool: { w: number; h: number; dx: number; dy: number }
  /** Callout label rows (top y), per crew member, and how each aligns to its leader. */
  callout: readonly { y: number; align: 'start' | 'end' }[]
  /** Label line height (u) used to end each leader under its label. */
  calloutH: number
  /** The new hire: feet where they stop, and how far right they start. */
  hire: { feet: Pt; from: number; k: number }
  /** Desk top-left, size; the monitor (w × h) centred on it. */
  desk: { x: number; y: number; w: number; h: number }
  monitor: { w: number; h: number; neck: number }
  /** The training record (HTML) top-left and width (percent of the box width). */
  record: Pt
  recordW: number
}

export const S05_GEO: Readonly<Record<LayoutId, Fam>> = {
  wide: {
    ground: [
      [24, 524],
      [936, 524],
    ],
    crew: [90, 290, 490],
    k: 4.6,
    q: { r: 20, dx: -58, up: 296 },
    tool: { w: 50, h: 66, dx: -8, dy: -52 },
    callout: [
      { y: 20, align: 'start' },
      { y: 84, align: 'start' },
      { y: 148, align: 'end' },
    ],
    calloutH: 48,
    hire: { feet: [868, 524], from: 220, k: 4.6 },
    desk: { x: 650, y: 394, w: 140, h: 130 },
    monitor: { w: 112, h: 72, neck: 14 },
    record: [628, 20],
    recordW: 32,
  },
  tall: {
    ground: [
      [10, 250],
      [390, 250],
    ],
    ground2: [
      [10, 470],
      [390, 470],
    ],
    crew: [58, 188, 318],
    k: 2.1,
    q: { r: 11, dx: -28, up: 134 },
    tool: { w: 26, h: 34, dx: -4, dy: -27 },
    callout: [
      { y: 60, align: 'start' },
      { y: 34, align: 'start' },
      { y: 8, align: 'start' },
    ],
    calloutH: 20,
    hire: { feet: [368, 470], from: 120, k: 2.1 },
    desk: { x: 250, y: 414, w: 90, h: 56 },
    monitor: { w: 66, h: 44, neck: 8 },
    record: [12, 280],
    recordW: 58,
  },
}

/** Where the tall callout labels start (all left-aligned at the margin). */
const TALL_LABEL_X = 12

const pctOf = (p: Pt, family: LayoutId): Pt => {
  const [, , w, h] = S05_VB[family]
  return [Math.round((p[0] / w) * 10000) / 100, Math.round((p[1] / h) * 10000) / 100]
}

export interface S05Pos {
  wide: Pt
  tall: Pt
}
const both = (f: (fam: LayoutId) => Pt): S05Pos => ({
  wide: pctOf(f('wide'), 'wide'),
  tall: pctOf(f('tall'), 'tall'),
})

/** Crew member i's feet. */
export const feetAt = (family: LayoutId, i: number): Pt => {
  const g = S05_GEO[family]
  return [g.crew[i]!, g.ground[0][1]]
}

/** A symbol's anchor placed at feet with scale k. */
export function anchorAt(symbol: SymbolId, anchor: string, feet: Pt, k: number): Pt {
  const d = symbolDef(symbol)
  const f = d.anchors?.feet ?? [20, 72]
  const a = d.anchors?.[anchor] ?? f
  return [feet[0] + (a[0] - f[0]) * k, feet[1] + (a[1] - f[1]) * k]
}

/** Centre of crew member i's question bubble. */
export const qCenter = (family: LayoutId, i: number): Pt => {
  const g = S05_GEO[family]
  const [x, y] = feetAt(family, i)
  return [x + g.q.dx, y - g.q.up]
}

/** Top-left of crew member i's tool: held at the hand. */
export const toolAt = (family: LayoutId, i: number): Pt => {
  const g = S05_GEO[family]
  const h = anchorAt(S05_CREW[i]!.symbol, 'hand', feetAt(family, i), g.k)
  return [Math.round(h[0] + g.tool.dx), Math.round(h[1] + g.tool.dy)]
}

/** The x of crew member i's callout leader (the tool's centre line). */
export const leaderX = (family: LayoutId, i: number): number =>
  toolAt(family, i)[0] + S05_GEO[family].tool.w * (family === 'wide' ? LEAD_AT[i]! : 0.5)

/**
 * Where each wide leader leaves its tool's top edge (fraction of the width): the middle
 * leader starts left of centre and the last right of it, so the middle callout has room
 * to finish before the last leader at the narrowest wide width.
 */
const LEAD_AT = [0.5, 0.25, 0.75] as const

/** The leader's top end (just under its label) and its foot (the tool's top edge). */
export const leaderEnds = (family: LayoutId, i: number): { top: Pt; foot: Pt; elbowX?: number } => {
  const g = S05_GEO[family]
  const x = leaderX(family, i)
  const row = g.callout[i]!
  const t = toolAt(family, i)
  if (family === 'tall')
    // tall: the leader rises to its row, then runs left under the label to the margin
    return { top: [x, row.y + g.calloutH], foot: [x, t[1] - 3], elbowX: TALL_LABEL_X }
  return { top: [x, row.y + g.calloutH + 6], foot: [x, t[1] - 3] }
}

/** The "?" in each bubble (the label is centred on this point). */
export const qLabelAt = (i: number): S05Pos => both((f) => qCenter(f, i))

/**
 * Callout label anchor. Wide: its bottom-left (start) or bottom-right (end) corner just above
 * the leader's top, so the label sits on its leader at any font size. Tall: its top-left at the
 * row (the leader runs under it to the margin).
 */
export const calloutAt = (i: number): S05Pos =>
  both((f) => {
    const row = S05_GEO[f].callout[i]!
    if (f === 'tall') return [TALL_LABEL_X, row.y]
    const top = leaderEnds(f, i).top
    return [leaderX(f, i) + (row.align === 'start' ? -2 : 2), top[1] - 3]
  })

export const calloutAlign = (i: number): 'start' | 'end' => S05_GEO.wide.callout[i]!.align

/** Role label: centred under the feet. */
export const personLabelAt = (i: number): S05Pos =>
  both((f) => {
    const [x, y] = feetAt(f, i)
    return [x, y + (f === 'wide' ? 9 : 6)]
  })

export const hireLabelAt: S05Pos = both((f) => {
  const [x, y] = S05_GEO[f].hire.feet
  return [x, y + (f === 'wide' ? 9 : 6)]
})

/** The monitor's top-left (centred on the desk, on a neck and foot). */
export const monitorAt = (family: LayoutId): Pt => {
  const { desk, monitor } = S05_GEO[family]
  return [desk.x + (desk.w - monitor.w) / 2, desk.y - monitor.neck - monitor.h]
}

export const recordAt: S05Pos = both((f) => S05_GEO[f].record)
