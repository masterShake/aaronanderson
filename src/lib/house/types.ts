/**
 * HouseSpec: the single source of truth for the house. The plan drawing (chapter 1) is derived
 * from it now; the 3D framing (chapter 2) and everything after will be derived from it later.
 *
 * Plan space: inches, right-handed, Z up. +X is east (screen right), +Y is north (screen up).
 * The origin is the SW corner of the building line (outside face of the exterior studs) and
 * z = 0 is the top of the subfloor.
 *
 * Walls and openings are in STUD coordinates: `Wall.rect` is the exact bottom-plate footprint.
 * Rooms and fixtures are in FINISHED coordinates: stud faces ± GWB (½″).
 */
import type { Rect, Vec2 } from '@/lib/geom/rect'
import type { Inch } from '@/lib/units'

export type { Rect, Vec2 }

export type AssemblyId = 'ext-2x6' | 'int-2x4' | 'int-2x6'

export interface Layer {
  side: 'out' | 'in'
  name: string
  t: Inch
}

export interface Assembly {
  stud: '2x4' | '2x6'
  /** Actual stud depth: 5½″ for a 2x6, 3½″ for a 2x4. Equals the wall rect's short side. */
  depth: Inch
  /** Stud spacing on centre. */
  spacing: Inch
  topPlates: 2
  /** Finish layers listed from the stud face outward. Not drawn: walls draw at stud thickness. */
  layers: readonly Layer[]
}

export interface Wall {
  id: string
  kind: 'exterior' | 'interior'
  assembly: AssemblyId
  /** Exact bottom-plate footprint after joins. The long side is the wall's axis. */
  rect: Rect
}

interface OpeningBase {
  id: string
  wall: string
  /** Centreline along the host wall's axis: an x value for E–W walls, a y value for N–S walls. */
  at: Inch
  /** Unit size: door slab or window unit. */
  w: Inch
  h: Inch
  /** Top of the rough opening above the subfloor. Default 82½″. */
  head?: Inch
  /** Rough opening. Defaults: swing/bypass doors w+2 × 82½, sliders w+½ × 82½, windows w+½ × h+½. */
  ro?: { w: Inch; h: Inch }
}

export interface Door extends OpeningBase {
  kind: 'door'
  op: 'swing' | 'bypass' | 'slider'
  /** Swing doors: which RO jamb carries the hinge (lo = lower coordinate along the axis). */
  hinge?: 'lo' | 'hi'
  /** Swing doors: which side of the wall the leaf opens into (lo = −y for E–W walls, −x for N–S). */
  side?: 'lo' | 'hi'
  exterior?: true
}

export interface Window extends OpeningBase {
  kind: 'window'
  op: 'casement' | 'single-hung' | 'fixed'
  /** Window tag number on the plan. */
  tag: number
  /** Manufacturer net clear opening, for egress checks. */
  netClear?: readonly [w: Inch, h: Inch]
}

export type Opening = Door | Window

export type RoomUse = 'bedroom' | 'bath' | 'kitchen' | 'living' | 'closet' | 'hall' | 'laundry' | 'porch'

export interface Room {
  id: string
  name: string
  use: RoomUse
  /** Finished rectangle. */
  rect: Rect
  /** Parts of `rect` that belong to something else (e.g. a closet carved out of a bedroom). */
  cut?: readonly Rect[]
  /** Label anchor; defaults to the rect centre. */
  label?: Vec2
  /** Print the room size under the name. */
  size?: true
  /** 2 = label hidden on narrow screens. */
  lod?: 1 | 2
  /** No label at all (closets). */
  unlabeled?: true
}

export type FixtureKind =
  | 'counter'
  | 'tall-cab'
  | 'wall-cab'
  | 'island'
  | 'sink-double'
  | 'range'
  | 'fridge'
  | 'dw'
  | 'wc'
  | 'vanity'
  | 'tub'
  | 'shower'
  | 'washer'
  | 'dryer'
  | 'water-heater'
  | 'shelf-rod'

export interface Fixture {
  id: string
  kind: FixtureKind
  room: string
  /** Finished rectangle in plan. */
  rect: Rect
  /** Bottom and top above the subfloor. Fixtures whose bottom is above CUT_PLANE draw as overhead. */
  z: readonly [bottom: Inch, top: Inch]
  /** The direction the fixture's front faces. */
  facing: 'N' | 'E' | 'S' | 'W'
  /** Backing wall (plumbing, blocking). */
  wall?: string
  /** Bowls in a vanity top. */
  sinks?: 1 | 2
}

export interface Device {
  id: string
  kind: 'smoke-alarm'
  room: string
  at: Vec2
}

export interface Porch {
  rect: Rect
  /** 6x6 posts. */
  posts: readonly Rect[]
  steps: { rect: Rect; risers: number }
}

export interface Roof {
  main: {
    type: 'gable'
    /** Ridge direction: 'x' runs east–west. */
    ridge: 'x'
    ridgeAt: Inch
    /** Rise per 12″ of run. */
    pitch: number
    eave: Inch
    rake: Inch
    framing: 'trusses'
    spacing: Inch
  }
  /** Shed roof over the porch. Detailed in chapter 3. */
  porch: { type: 'shed'; pitch: number; rect: Rect }
}

export interface DimRef {
  wall: string
  /** lo / hi face across the wall, or its centreline. */
  face: 'lo' | 'hi' | 'c'
}

export interface DimString {
  id: string
  /** 'x' strings measure along x (they run E–W); 'y' strings along y. */
  axis: 'x' | 'y'
  /** Position of the dimension line across its axis. */
  at: Inch
  refs: readonly DimRef[]
  lod: 1 | 2
}

export interface HouseSpec {
  meta: { name: string; sheet: string; drawing: string; scale: string; date: string }
  /** Building line: outside face of the exterior studs. */
  footprint: Rect
  datums: { floor: 0; plate: Inch; grade: Inch; porchDeck: Inch }
  foundation: { kind: 'crawlspace' }
  assemblies: Record<AssemblyId, Assembly>
  walls: readonly Wall[]
  openings: readonly Opening[]
  rooms: readonly Room[]
  fixtures: readonly Fixture[]
  devices: readonly Device[]
  porch: Porch
  roof: Roof
  dims: readonly DimString[]
  annotations: { northArrow: Vec2; scaleBar: Vec2 }
}
