import type { LayoutId, Pt, SymbolId, ViewBox } from '../types'

/**
 * S-05 Team Enablement (pages-drawings §6.5): paper only, never blueprint.
 * Three people in hard hats (estimator, project manager, field lead), each
 * with a question mark, are handed a tool: a prompt playbook (binder), an
 * AI-use guideline (sheet) and a recorded walkthrough (card). The tools are
 * the only orange: a 1.5 u asphalt keyline over a 3 u orange underlay. A new
 * hire walks in, a walkthrough plays on a screen, a training record fills in.
 *
 * Geometry only (no strings, no roughjs): drawing.server.ts renders it, and
 * the figure reads the label positions from here. Wide 960 × 640 (the crew
 * left, the new hire right); tall 400 × 500 (the crew on top, the new hire below).
 */

export const S05_VB: { wide: ViewBox; tall: ViewBox } = {
  wide: [0, 0, 960, 640],
  tall: [0, 0, 400, 500],
}

export type S05Person = 'estimator' | 'pm' | 'field'
export type S05Tool = 'playbook' | 'guideline' | 'walkthrough'

export interface S05Crew {
  person: S05Person
  symbol: SymbolId
  tool: S05Tool
  /** Callout label key in the figure copy. */
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
    symbol: 'fig.hardhat-field',
    tool: 'walkthrough',
    callout: 'callout.walkthrough',
  },
]

interface Fam {
  /** Ground line ends. */
  ground: readonly [Pt, Pt]
  /** Second ground line (the new hire's), tall only. */
  ground2?: readonly [Pt, Pt]
  /** Feet of each crew member, and their scale (k: 64 u figure height × k). */
  crew: readonly Pt[]
  k: number
  /** Question circle radius and its offset above the feet. */
  q: { r: number; up: number }
  /** Tool size and its offset from the feet (top-left corner). */
  tool: { w: number; h: number; dx: number; up: number }
  /** Callout label top-left per crew member, and the leader's elbow height. */
  callout: readonly Pt[]
  /** The new hire: feet where they stop, and how far right they start. */
  hire: { feet: Pt; from: number; k: number }
  /** Screen (64 × 44) top-left, and its stand down to the ground. */
  screen: Pt
  /** The training record (HTML) top-left. */
  record: Pt
}

export const S05_GEO: Readonly<Record<LayoutId, Fam>> = {
  wide: {
    ground: [
      [30, 540],
      [930, 540],
    ],
    crew: [
      [110, 540],
      [300, 540],
      [490, 540],
    ],
    k: 2.3,
    q: { r: 18, up: 196 },
    tool: { w: 40, h: 52, dx: 28, up: 112 },
    callout: [
      [40, 120],
      [230, 120],
      [420, 120],
    ],
    hire: { feet: [850, 540], from: 220, k: 2.3 },
    screen: [690, 380],
    record: [640, 40],
  },
  tall: {
    ground: [
      [10, 320],
      [390, 320],
    ],
    ground2: [
      [10, 486],
      [390, 486],
    ],
    crew: [
      [56, 320],
      [186, 320],
      [316, 320],
    ],
    k: 1.3,
    q: { r: 12, up: 112 },
    tool: { w: 24, h: 32, dx: 16, up: 64 },
    callout: [
      [12, 70],
      [12, 42],
      [12, 14],
    ],
    hire: { feet: [128, 486], from: 260, k: 1.3 },
    screen: [16, 390],
    record: [170, 354],
  },
}

export const S05_SCREEN = { w: 64, h: 44 } as const

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

/** Centre of crew member i's question circle. */
export const qCenter = (family: LayoutId, i: number): Pt => {
  const g = S05_GEO[family]
  const [x, y] = g.crew[i]!
  return [x, y - g.q.up]
}

/** Top-left of crew member i's tool. */
export const toolAt = (family: LayoutId, i: number): Pt => {
  const g = S05_GEO[family]
  const [x, y] = g.crew[i]!
  return [x + g.tool.dx, y - g.tool.up]
}

/** The "?" in each question circle (label top-left, nudged to centre a glyph). */
export const qLabelAt = (i: number): S05Pos =>
  both((f) => {
    const c = qCenter(f, i)
    return f === 'wide' ? [c[0] - 6, c[1] - 11] : [c[0] - 4, c[1] - 8]
  })

export const calloutAt = (i: number): S05Pos => both((f) => S05_GEO[f].callout[i]!)

export const personLabelAt = (i: number): S05Pos =>
  both((f) => {
    const [x, y] = S05_GEO[f].crew[i]!
    return [x - (f === 'wide' ? 56 : 40), y + (f === 'wide' ? 10 : 6)]
  })

export const hireLabelAt: S05Pos = both((f) => {
  if (f === 'tall') {
    const [sx, sy] = S05_GEO.tall.screen
    return [sx, sy - 22]
  }
  const [x, y] = S05_GEO[f].hire.feet
  return [x - 44, y + 10]
})

/** Where each crew callout's leader turns under its label (u below the label's top). */
export const S05_LEADER_DROP: Readonly<Record<LayoutId, number>> = { wide: 84, tall: 18 }

export const recordAt: S05Pos = both((f) => S05_GEO[f].record)
