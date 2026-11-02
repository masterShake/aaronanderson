/**
 * The chapter-2 framing script: when each beat plays, in chapter progress p ∈ [0, 1]. The copy layout
 * reads BLOCKS, lib/framing/schedule.ts reads the phase windows and flight rules, and the scene reads
 * CAMERA, SHOTS, quantize, paperSpace and groundAt. Change pacing here, nowhere else.
 *
 * Every window is in chapter progress, so changing the construction track rescales them all evenly.
 * At track 8, 0.01 of progress is 8lvh of scroll, and a 0.012 flight lasts about one wheel notch.
 * Each card's keyframe falls where nothing is in flight and every blue edge has settled to wood
 * (script.test.ts and schedule.test.ts check both).
 */
import { clamp01, smoothstep } from '@/lib/framing/flight'
import type { MemberKind } from '@/lib/framing/types'
import type { ElementKind } from '@/lib/plan/types'
import { chapterIndex } from '@/lib/story/chapters'

export type Win = readonly [number, number]

export interface Block {
  id: 'intro' | 'takeoffs' | 'schedules' | 'paperwork'
  span: Win
  /** Under prefers-reduced-motion the frame jumps straight to this progress. */
  keyframe: number
}

export const BLOCKS: readonly Block[] = [
  { id: 'intro', span: [0, 0.3], keyframe: 0.3 },
  { id: 'takeoffs', span: [0.3, 0.56], keyframe: 0.56 },
  { id: 'schedules', span: [0.56, 0.8], keyframe: 0.8 },
  { id: 'paperwork', span: [0.8, 1], keyframe: 1 },
]

/** Reduced motion keeps chapter 1's signed sheet until here. */
export const QUIET = 0.02

export const blockAt = (p: number): number => {
  const i = BLOCKS.findIndex((b) => p < b.span[1])
  return i < 0 ? BLOCKS.length - 1 : i
}

/** What reduced-motion users see: chapter 1's sheet, then each card's finished state. */
export const quantize = (p: number): number => (p < QUIET ? 0 : BLOCKS[blockAt(p)].keyframe)

// ── Retiring chapter 1's sheet ────────────────────────────────────────────────────────────────

/** The CSS frame border and title strip fade out. */
export const PAPER_SPACE: Win = [0.005, 0.035]
/** The drafting grid fades to paper. */
export const GRID_FADE: Win = [0.015, 0.045]

/**
 * Un-drafting, in reverse drafting order. Walls are not listed: each wall's ink retires once its
 * plates are wood (WALL_INK). The setout lines stay as string lines through the floor beat.
 */
export const DISSOLVE: readonly { kinds: readonly ElementKind[]; win: Win }[] = [
  { kinds: ['room', 'annotation', 'check', 'testfit'], win: [0.012, 0.03] },
  { kinds: ['dim'], win: [0.016, 0.034] },
  { kinds: ['porch', 'roof'], win: [0.02, 0.038] },
  { kinds: ['fixture', 'device'], win: [0.024, 0.042] },
  // Window symbols, doors, tags and numbers: gone before the window plates fade in.
  { kinds: ['opening'], win: [0.028, 0.046] },
  { kinds: ['setout'], win: [0.095, 0.125] },
]

/** A wall's cut lines and poché fade over this long, starting once its last plate is opaque. */
export const WALL_INK = 0.008
/** From here on the whole sheet group is hidden: every dissolve has finished. */
export const SHEET_GONE = 0.13

// ── Phases ────────────────────────────────────────────────────────────────────────────────────

/**
 * Each phase's members are swept through its window. The exterior walls play inside the TILT
 * windows, between deck and caps.
 * - morph: wood bottom plates cross-fade in over the poché, radially from the SW corner, where
 *   chapter 1's pen comes to rest.
 * - floor: sills, then rims and girder, then joists slide in under the plates, top-down.
 * - swing: the camera turns from the plan to the 3/4 view and the ground shadow fades in.
 * - pour: stem walls rise from grade to meet the sills (S, E, N, W), then the girder piers.
 * - deck: the OSB sheets slide in under the plates.
 * - caps: cap plates go on counter-clockwise from the SW corner, lapping corners and tees.
 * - interior: interior walls built in place, back to front (studs, top plates, caps).
 * - trusses: west to east, each rolled up as a unit; the rake ladders follow their gables.
 * - porch: piers, posts, beam, ledger, rafters.
 */
export const PHASES = {
  morph: [0.04, 0.09],
  floor: [0.058, 0.125],
  swing: [0.11, 0.21],
  pour: [0.165, 0.255],
  deck: [0.25, 0.286],
  caps: [0.532, 0.548],
  interior: [0.562, 0.69],
  trusses: [0.69, 0.786],
  porch: [0.8, 0.885],
} as const satisfies Record<string, Win>

export type Side = 'n' | 's' | 'w' | 'e'

export interface TiltBeat {
  side: Side
  /** +1 sweeps the frame along +s, −1 against it: counter-clockwise round the house either way. */
  sweep: 1 | -1
  /** Members fly into the frame lying flat on the deck. */
  frame: Win
  /** The frame swings up about its hinge: inOutCubic, no bounce (braced walls don't). */
  raise: Win
}

/**
 * Exterior walls, one raise at a time. N is framed first; S is framed while N rises (their flat
 * frames lie 161″ apart). W and E lie across S's and N's flat footprints, so they are framed only
 * once both stand; their own flat frames are 350″ apart, so E is framed alongside W and while W
 * rises.
 */
export const TILT: readonly TiltBeat[] = [
  { side: 'n', sweep: -1, frame: [0.301, 0.351], raise: [0.353, 0.375] },
  { side: 's', sweep: 1, frame: [0.346, 0.404], raise: [0.406, 0.428] },
  { side: 'w', sweep: -1, frame: [0.43, 0.484], raise: [0.486, 0.508] },
  { side: 'e', sweep: 1, frame: [0.437, 0.507], raise: [0.509, 0.531] },
]

/** Flight lengths. A stud's 0.012 is 9.6lvh at track 8, just under one wheel notch. */
export const DUR = {
  morph: 0.012,
  slide: 0.012,
  stem: 0.03,
  pier: 0.02,
  stud: 0.012,
  header: 0.012,
  plate: 0.014,
  cap: 0.012,
  truss: 0.022,
  porch: 0.014,
} as const

/**
 * Wall frames: the top plate goes down first, then the studs, then each opening inside out. The
 * lags only lean the order; the schedule also holds every member until what it rests on has landed.
 */
export const LAG: Readonly<Partial<Record<MemberKind, number>>> = {
  'plate-top': 0,
  stud: 0.004,
  king: 0.004,
  jack: 0.005,
  'rough-sill': 0.006,
  header: 0.006,
  cripple: 0.007,
}

/** Interior walls stand in place, so their plates go on after the studs: three passes. */
export const PASS = { vertical: 0, 'plate-top': 0.008, 'plate-cap': 0.016 } as const

/** Floor beat: sills, then the rims and girder they carry, then the joists and end joists. */
export const FLOOR_LAG = { sill: 0, carrier: 0.004, joist: 0.008 } as const

/** Porch: piers pour, then posts, beam, ledger and rafters, all sweeping west to east. */
export const PORCH_LAG: Readonly<Partial<Record<MemberKind, number>>> = {
  pier: 0,
  post: 0.012,
  beam: 0.026,
  ledger: 0.03,
  rafter: 0.038,
}

/** Stem walls pour in turn, this far apart; the piers follow, evenly spread to the window's end. */
export const STEM_STAGGER = 0.012

// ── Motion ────────────────────────────────────────────────────────────────────────────────────

/** Flight starts before jitter, in inches: height above the landing and the sideways offset. */
export const FLY = {
  walls: { rise: 84, plateRise: 96, drift: 30 },
  caps: { rise: 72, plateRise: 72, drift: 36 },
  interior: { rise: 84, plateRise: 72, drift: 30 },
  porch: { rise: 78, plateRise: 78, drift: 27 },
} as const

/** Seeded per id: rise × [0.85, 1.15], drift × [0.6, 1.4], its heading turned up to ±25° about z. */
export const JITTER = { rise: [0.85, 1.15], drift: [0.6, 1.4], heading: 25 } as const

/** Tumble: at most 70°, and at most 120″/L radians, so a plank's end sweeps no more than 60″. */
export const TUMBLE = { max: 70, reach: 120 } as const

/** outBack overshoot: about 3% for a flying member's rotation, 1.25% for a truss rolling up. */
export const BACK = { fly: 0.9, truss: 0.6 } as const

/** The share of a motion spent fading in (alpha 0 → 1). */
export const FADE_IN = { fly: 0.3, slide: 0.2, unit: 0.25 } as const

/**
 * Slides travel horizontally at their final height: floor members and deck sheets come in under
 * plates already placed, and the porch ledger slides in under the truss tails. Perimeter members
 * entering from outside turn up to `yaw` degrees about z on the way.
 */
export const SLIDE = { floor: 48, deck: 48, ledger: 30, yaw: 8 } as const

/** Trusses start this far east and up, lying flat with the apex east; rake ladders start outward. */
export const UNIT_START = { drift: 48, rise: 96 } as const

/** Blue edges settle to wood over this long after a member lands (chapter 1's pen settle). */
export const AI_SETTLE = 0.012

// ── Camera ────────────────────────────────────────────────────────────────────────────────────

export type ShotId = 'deck' | 'walls' | 'roof' | 'hero'

export interface Shot {
  /** Radians. pitch −π/2 looks straight down. yaw 0 looks north; +yaw turns the view west. */
  pitch: number
  yaw: number
  /** Fit padding: [wide, narrow] layouts. */
  pad: readonly [number, number]
  /** The Schedule.boxes envelope this shot frames. */
  box: ShotId
}

const DEG = Math.PI / 180

/** 3/4 views from the south-south-east: the front door, porch and slider, the east gable on the right. */
export const SHOTS: Readonly<Record<ShotId, Shot>> = {
  deck: { pitch: -42 * DEG, yaw: 24 * DEG, pad: [1.08, 1.04], box: 'deck' },
  walls: { pitch: -38 * DEG, yaw: 38 * DEG, pad: [1.08, 1.04], box: 'walls' },
  roof: { pitch: -30 * DEG, yaw: 36 * DEG, pad: [1.06, 1.03], box: 'roof' },
  hero: { pitch: -24 * DEG, yaw: 32 * DEG, pad: [1.08, 1.04], box: 'hero' },
}

export interface CameraKey {
  p: number
  /** 'plan' is chapter 1's shot. */
  shot: ShotId | 'plan'
  /** Distance multiplier (a slow push-in). */
  dolly?: number
  ease?: 'inOutCubic' | 'linear'
}

/** The first key is chapter 1's last, so the hand-over is exact. Chapters 3–5 hold the last. */
export const CAMERA: readonly CameraKey[] = [
  { p: 0, shot: 'plan', dolly: 0.97 },
  { p: 0.11, shot: 'plan', dolly: 0.97 },
  { p: 0.21, shot: 'deck' },
  { p: 0.6, shot: 'walls', ease: 'linear' },
  { p: 0.67, shot: 'roof' },
  { p: 0.8, shot: 'roof', dolly: 0.98, ease: 'linear' },
  { p: 0.93, shot: 'hero' },
  { p: 1, shot: 'hero', dolly: 0.96, ease: 'linear' },
]

/** Horizontal unit vector the 'walls' shot looks along: interior walls build back to front on it. */
export const wallsForward = (): readonly [number, number] => [
  -Math.sin(SHOTS.walls.yaw),
  Math.cos(SHOTS.walls.yaw),
]

const CONSTRUCTION = chapterIndex('construction')

/**
 * The paper-space frame and title strip's opacity at story time s: 1 through chapter 1, then fading
 * over PAPER_SPACE. Reduced motion steps at QUIET, as quantize does.
 */
export function paperSpace(s: number, reduced: boolean): number {
  const p = clamp01(s - CONSTRUCTION)
  if (reduced) return p < QUIET ? 1 : 0
  return 1 - smoothstep(PAPER_SPACE[0], PAPER_SPACE[1], p)
}

/** The ground shadow's strength (0 → 1) as the camera swings out of plan. */
export const groundAt = (p: number): number => smoothstep(PHASES.swing[0], PHASES.swing[1], p)
