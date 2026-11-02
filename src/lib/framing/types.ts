/**
 * The framed house as data. frameHouse() derives every member from the resolved HouseSpec as an
 * oriented box in plan inches (Z up, same space as the drawing). Chapter 2 schedules and poses
 * these boxes; later chapters build on them (sheathing, roofing, MEP).
 */
import type { Inch } from '@/lib/units'

export type Vec3 = readonly [x: Inch, y: Inch, z: Inch]

/** Axis-aligned box [min, max] in plan inches. */
export type Box3 = readonly [min: Vec3, max: Vec3]

export type MemberKind =
  // Concrete.
  | 'stem-wall'
  | 'pier'
  // Floor.
  | 'sill'
  | 'rim'
  | 'girder'
  | 'joist'
  | 'subfloor'
  // Walls.
  | 'plate-bottom'
  | 'stud'
  | 'king'
  | 'jack'
  | 'header'
  | 'rough-sill'
  | 'cripple'
  | 'plate-top'
  | 'plate-cap'
  // Roof.
  | 'chord'
  | 'web'
  | 'gable-stud'
  | 'barge'
  | 'lookout'
  // Porch.
  | 'post'
  | 'beam'
  | 'ledger'
  | 'rafter'

export type Section = '2x4' | '2x6' | '2x8' | '2x10' | '2x12' | '6x6' | '6x8' | 'osb' | 'concrete'

export interface Member {
  /** Stable and unique, e.g. 'ext-s/stud/k12', 'joist/s/x016', 'truss/07/web-2'. */
  id: string
  kind: MemberKind
  material: 'wood' | 'concrete'
  section: Section
  /** Pressure-treated (sills, porch posts). */
  treated?: true
  /** The assembly it moves with (an Assembly id). */
  group: string
  /** Box centre. */
  c: Vec3
  /** Unit grain (length) axis. */
  u: Vec3
  /** Unit width axis, perpendicular to u. The third axis is w = u × v, so boxes never mirror. */
  v: Vec3
  /** [length along u, width along v, height along w]. */
  size: Vec3
  /** Host wall id, for wall members (bottom plates and caps included). */
  wall?: string
  /** Centre along the host wall's axis. */
  s?: Inch
  /** Bottom plates over poché: index into ResolvedWall.pieces (the poché piece it replaces). */
  piece?: number
  /** Opening members, and bottom plates under a window: the opening id. */
  opening?: string
}

/** How an exterior wall's frame lies flat on the deck before it is raised. */
export interface Tilt {
  wall: string
  /** Raise batch: 0 = walls that run through the corners, 1 = walls that butt between them. */
  batch: 0 | 1
  /** A point on the hinge line: the inner top edge of the bottom plate. */
  pivot: Vec3
  /** Unit hinge axis (ẑ × inward). Turning the standing frame +90° about it lays it flat, outside face up. */
  axis: Vec3
  /** Unit inward normal of the wall, in plan. */
  inward: Vec3
}

/**
 * pieces: members fly in one by one. unit: the assembly flies as one rigid body (a truss).
 * tilt: members fly into the flat frame, then the frame is raised about its hinge.
 */
export type Motion = 'pieces' | 'unit' | 'tilt'

export interface Assembly {
  id: string
  motion: Motion
  /** Member indices. Wall assemblies list their members by (s, z). */
  members: readonly number[]
  tilt?: Tilt
}

export interface Frame {
  members: readonly Member[]
  assemblies: readonly Assembly[]
  /** Named elevations in inches (grade, sillTop, joistTop, plate, heel, ridge, …). */
  datums: Readonly<Record<string, Inch>>
  /** Bounds of every member at home. */
  bounds: Box3
}

// ── Pose contract: the schedule writes instance buffers in place; the scene uploads them. ─────

/** One material's instance buffers, in draw order. */
export interface PoseTarget {
  /** 16 floats per instance: a column-major 4×4 in plan inches (columns u·L, v·W, w·H, centre). */
  matrix: Float32Array
  /** 4 floats per instance: [alpha 0→1, ai 0→1 (blue edges while placing), 0, 0]. */
  state: Float32Array
}

export interface PoseOut {
  wood: PoseTarget
  concrete: PoseTarget
}

/** How many instances of each material to draw: always a prefix of the draw order. */
export interface PoseCounts {
  wood: number
  concrete: number
}

/** A scheduled frame, ready to pose at any chapter progress. */
export interface FramePlan {
  /** Member indices per material, in draw order (ascending start time). */
  order: { wood: Int32Array; concrete: Int32Array }
  /** Nothing is drawn below firstAt; nothing changes above settledAt. */
  firstAt: number
  settledAt: number
  /** Write every drawn instance's matrix and state for chapter progress p. Pure: no state between calls. */
  pose(p: number, out: PoseOut): PoseCounts
}
