/**
 * Framing rules and lumber, in inches. Sizes are dressed (actual) dimensions, and code references
 * are IRC sections. Everything the framing model needs that the HouseSpec does not say lives here.
 */
import type { Member, Section } from '@/lib/framing/types'
import type { HouseSpec } from '@/lib/house/types'
import type { Inch } from '@/lib/units'

export type Lumber = Exclude<Section, 'osb' | 'concrete'>

/** Dressed [thickness, depth] of each lumber section. */
export const SECTIONS: Readonly<Record<Lumber, readonly [t: Inch, d: Inch]>> = {
  '2x4': [1.5, 3.5],
  '2x6': [1.5, 5.5],
  '2x8': [1.5, 7.25],
  '2x10': [1.5, 9.25],
  '2x12': [1.5, 11.25],
  '6x6': [5.5, 5.5],
  '6x8': [5.5, 7.5],
}

/** Thickness of every 2x. */
export const PLY: Inch = 1.5

/** Wall plates and sills are cut from straight 16′ stock; the splice chooser works to this. */
export const PLATE_STOCK: Inch = 192
/** 2x10 and up, timbers and truss lumber come in 20′ lengths. */
export const LONG_STOCK: Inch = 240

const ROOF_KINDS: ReadonlySet<Member['kind']> = new Set([
  'chord',
  'web',
  'gable-stud',
  'barge',
  'lookout',
])
const LONG_SECTIONS: ReadonlySet<Section> = new Set(['2x10', '2x12', '6x6', '6x8'])

/** Longest piece a member may be cut from. */
export function stockLength(m: Pick<Member, 'kind' | 'section'>): Inch {
  if (m.section === 'concrete') return Infinity
  if (m.section === 'osb') return OSB.l
  // Truss plants stock 20′ chord lumber.
  return ROOF_KINDS.has(m.kind) || LONG_SECTIONS.has(m.section) ? LONG_STOCK : PLATE_STOCK
}

/** R602.3.2: end joints in the top plate and the cap above it are offset at least 24″. */
export const PLATE_LAP: Inch = 24

/** Exterior headers: two 2x12 plies flush with both wall faces (R602.7). */
export const EXT_HEADER = { section: '2x12', plies: 2 } as const
/** Exterior ROs wider than this get two jacks a side (the 6′ slider). */
export const WIDE_RO: Inch = 72
/**
 * R602.7.4: a nonbearing wall may use a single flat 2x header over openings up to 8′ when the
 * nailing surface above is within 24″. Interior walls here are nonbearing (the trusses
 * clear-span), so they take one.
 */
export const FLAT_HEADER = { gap: 24, span: 96 } as const

/** ¾″ OSB subfloor in 4×8 sheets, long side across the joists. */
export const OSB = { t: 0.75, w: 48, l: 96 } as const

/**
 * Floor joists: DF-L No. 2 2x10 at 16″. R502.3.1(2) allows 15′-5″ (185″) at 40 psf live,
 * 10 psf dead, L/360. Southern pine No. 2 would not reach this span, so the species is fixed.
 */
export const JOIST = { section: '2x10', spacing: 16, species: 'DF-L No. 2', spanMax: 185 } as const
/** Flush built-up girder and its piers. Ply joints fall on alternate piers. */
export const GIRDER = { plies: 3, pierSpacing: 72 } as const

/** Concrete stem wall (outer face on the building line) and girder piers. Footings are not drawn. */
export const STEM = { w: 8 } as const
export const PIER = { w: 16 } as const

/** R317.1: wood closer than this to crawlspace grade must be treated (joists, girders, sills). */
export const GRADE_CLEARANCE = { joist: 18, girder: 12, sill: 8 } as const
/** R502.6: joists bear at least 1½″ on wood. */
export const MIN_BEARING: Inch = 1.5
/** R404.1.6: foundation walls stand at least 6″ above grade. */
export const STEM_ABOVE_GRADE: Inch = 6

/** Truss lumber; the gable trusses carry 2x4 gable studs on the wall-stud layout. */
export const TRUSS = { chord: '2x4', web: '2x4', gableStud: 16 } as const
/** Rake ladders: 2x4 barge rafter and lookouts at 24″. */
export const RAKE = { section: '2x4', spacing: 24 } as const

/**
 * Members that share a plane (one truss, one rake ladder) and must overlap at their joints are
 * thinned this much per side per rank, so no two co-planar faces fight for the same pixels.
 */
export const THIN: Inch = 1 / 32

export const PORCH = {
  pier: 16,
  /** Pier tops stand this far above grade. */
  pierAboveGrade: 12,
  /** Underside of the beam above the porch deck. */
  beamClear: 82,
  post: '6x6',
  beam: '6x8',
  ledger: '2x8',
  rafter: '2x6',
  spacing: 24,
  /** The ledger stands off the studs by the wall sheathing still to come. */
  sheathing: 7 / 16,
  /** Smallest gap between the shed's rafters and the main truss tails. */
  tuck: 1.5,
} as const

/** Named elevations of the frame, from the HouseSpec datums down and up. */
export function frameDatums(spec: HouseSpec) {
  const { grade, plate, floor } = spec.datums
  const joistTop = floor - OSB.t
  const sillTop = joistTop - SECTIONS[JOIST.section][1]
  const stemTop = sillTop - PLY
  const bottomPlateTop = floor + PLY
  const topPlateTop = plate - PLY
  const studTop = topPlateTop - PLY
  return {
    grade,
    stemTop,
    sillTop,
    joistBottom: sillTop,
    joistTop,
    floor,
    bottomPlateTop,
    studTop,
    topPlateTop,
    plate,
  }
}

export type FrameDatums = ReturnType<typeof frameDatums>
