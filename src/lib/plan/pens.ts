/**
 * Colours and pens for the drawing. Black ink is the accepted drawing; blue is AI at work.
 * These hex values are repeated as CSS custom properties in globals.css (a test keeps them equal).
 */
export const PALETTE = {
  paper: '#ffffff',
  ink: '#1d1d1f',
  poche: '#2b2e33',
  graphite: '#55595f',
  text2: '#6e6e73',
  pencil: '#a1a6ad',
  construction: '#cdd1d6',
  rule: '#e6e8eb',
  gridMinor: '#f3f4f6',
  ai: '#1f5bff',
  aiGuide: '#8fadff',
  aiWash: '#e9efff',
} as const

export type PaletteKey = keyof typeof PALETTE

export type PenId =
  | 'cut'
  | 'ink'
  | 'tag'
  | 'graphite'
  | 'fine'
  | 'tick'
  | 'overhead'
  | 'ridge'
  | 'setout'
  | 'ai'
  | 'guide'
  | 'ai-bold'
  | 'ai-dash'
  | 'alarm'

export interface Pen {
  /** Line width in CSS px: [wide layout, narrow layout]. Never thinner than one device pixel. */
  width: readonly [number, number]
  color: PaletteKey
  /** Dash and gap in plan inches. */
  dash?: readonly [number, number]
  /** Progress span over which a stroke's blue pen tip settles to the pen colour. */
  settle?: number
  /** Settling starts no earlier than this progress (alarms stay blue until sign-off). */
  settleFrom?: number
  /** Draw order band: lower draws first. */
  order: number
}

export const PENS: Record<PenId, Pen> = {
  setout: { width: [0.75, 0.6], color: 'construction', order: -80 },
  fine: { width: [0.75, 0.6], color: 'graphite', order: -70 },
  graphite: { width: [1, 0.75], color: 'graphite', order: -65 },
  ink: { width: [1, 0.75], color: 'ink', order: -60 },
  /** Window-tag hexagons: hidden on narrow screens along with their numbers. */
  tag: { width: [1, 0.75], color: 'ink', order: -60 },
  tick: { width: [1.5, 1.25], color: 'ink', order: -60 },
  overhead: { width: [0.75, 0.6], color: 'pencil', dash: [12, 6], order: -60 },
  ridge: { width: [0.75, 0.6], color: 'pencil', dash: [24, 6], order: -60 },
  cut: { width: [1.5, 1.25], color: 'ink', order: -50 },
  guide: { width: [1, 1], color: 'aiGuide', settle: 0.08, order: -75 },
  ai: { width: [1, 1], color: 'ai', order: -40 },
  'ai-bold': { width: [1.5, 1.25], color: 'ai', order: -40 },
  'ai-dash': { width: [1, 1], color: 'ai', dash: [4, 3], order: -40 },
  alarm: { width: [1, 1], color: 'ink', settle: 0.03, settleFrom: 0.93, order: -40 },
}

/** Default blue-tip settle span for ink pens. */
export const SETTLE = 0.012
