/**
 * The chapter-1 drafting script: when each beat draws, in chapter progress p ∈ [0, 1].
 * The copy layout reads BLOCKS (wrapper heights and the highlighted capability), the timeline
 * reads BEATS, and the scene reads MARKS, FADES and CAMERA. Change pacing here, nowhere else.
 */
import type { BeatId } from '@/lib/plan/types'

export interface Block {
  id: 'intro' | 'testfits' | 'drafting' | 'checks'
  span: readonly [number, number]
  /** Under prefers-reduced-motion the drawing jumps straight to this progress. */
  keyframe: number
}

export const BLOCKS: readonly Block[] = [
  { id: 'intro', span: [0, 0.14], keyframe: 0.12 },
  { id: 'testfits', span: [0.14, 0.34], keyframe: 0.28 },
  { id: 'drafting', span: [0.34, 0.76], keyframe: 0.76 },
  { id: 'checks', span: [0.76, 1], keyframe: 1 },
]

export interface DraftBeat {
  id: BeatId
  /** Window for this beat's strokes, fills and labels. */
  win: readonly [number, number]
  /** Simultaneous pens. */
  pens: number
}

export const BEATS: readonly DraftBeat[] = [
  { id: 'setout', win: [0.05, 0.12], pens: 1 },
  { id: 'testfits', win: [0.16, 0.24], pens: 3 },
  { id: 'select', win: [0.26, 0.29], pens: 1 },
  { id: 'exterior', win: [0.34, 0.42], pens: 2 },
  { id: 'interior', win: [0.42, 0.5], pens: 2 },
  { id: 'openings', win: [0.5, 0.57], pens: 2 },
  { id: 'casework', win: [0.57, 0.62], pens: 2 },
  { id: 'site', win: [0.62, 0.66], pens: 1 },
  { id: 'dims', win: [0.66, 0.71], pens: 2 },
  { id: 'labels', win: [0.71, 0.76], pens: 1 },
  { id: 'egress', win: [0.76, 0.785], pens: 1 },
  { id: 'hall', win: [0.79, 0.81], pens: 1 },
  { id: 'door', win: [0.82, 0.84], pens: 1 },
  { id: 'wc', win: [0.85, 0.87], pens: 1 },
  { id: 'alarms', win: [0.89, 0.905], pens: 1 },
]

/** Grid reveal (radial, from the house centre). */
export const SHEET_WINDOW = [0, 0.06] as const

/** Poché trails its wall's strokes by this much progress. */
export const POCHE_LAG = 0.02
/** Typing time for one label. */
export const LABEL_TYPE = 0.008
/** Everything has finished drawing by this progress; the rest of the chapter holds the sheet. */
export const DRAWN_BY = 0.96

export interface MarkWindow {
  id: string
  show: readonly [number, number]
  /** When `then` text replaces the initial text. */
  swapAt?: number
}

export const MARKS: readonly MarkWindow[] = [
  { id: 'fit-A', show: [0.23, 0.31] },
  { id: 'fit-B', show: [0.23, 0.345], swapAt: 0.27 },
  { id: 'fit-C', show: [0.23, 0.31] },
  { id: 'egress', show: [0.765, 0.81] },
  { id: 'hall', show: [0.795, 0.84] },
  { id: 'door', show: [0.825, 0.87] },
  { id: 'wc', show: [0.855, 0.895] },
  { id: 'alarms', show: [0.88, 0.935], swapAt: 0.905 },
  { id: 'summary', show: [0.935, 0.99] },
]

/** Whole-layer fades to paper. Targets name a pen mesh, a test-fit group or a fill kind. */
export const FADES: readonly { target: string; win: readonly [number, number] }[] = [
  { target: 'group:A', win: [0.29, 0.33] },
  { target: 'group:C', win: [0.29, 0.33] },
  { target: 'pen:ai-bold', win: [0.3, 0.34] },
  { target: 'group:B', win: [0.44, 0.5] },
  { target: 'pen:ai', win: [0.93, 0.96] },
  { target: 'pen:ai-dash', win: [0.93, 0.96] },
  { target: 'fill:wash', win: [0.93, 0.96] },
]

export type ShotId = 'plan' | 'testfits'

export interface CameraKey {
  p: number
  shot: ShotId
  /** Distance multiplier (a slow push-in). */
  dolly?: number
  ease?: 'inOutCubic' | 'linear'
}

export const CAMERA: readonly CameraKey[] = [
  { p: 0, shot: 'plan' },
  { p: 0.14, shot: 'plan' },
  { p: 0.18, shot: 'testfits' },
  { p: 0.29, shot: 'testfits' },
  { p: 0.34, shot: 'plan' },
  { p: 1, shot: 'plan', dolly: 0.97, ease: 'linear' },
]

/** The title strip's CHECKED field flips to YOU at this chapter progress. */
export const SIGNOFF_AT = 0.93

export const blockAt = (p: number): number => {
  const i = BLOCKS.findIndex((b) => p < b.span[1])
  return i < 0 ? BLOCKS.length - 1 : i
}
