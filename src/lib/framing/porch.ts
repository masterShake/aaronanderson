/**
 * Porch framing: concrete piers under PT 6x6 posts, a 6x8 beam, a 2x8 ledger on the house wall
 * and 2x6 rafters for the shed roof, tucked under the main truss tails. The porch floor and steps
 * come later.
 *
 * The rafters' underside passes through the beam's inner top edge, so each seats on the beam
 * with a birdsmouth (a small box overlap) and hangs from the ledger, flush with its top.
 */
import { axisBox, between, member, type Box } from '@/lib/framing/geom3'
import type { RoofLines } from '@/lib/framing/roof'
import { LONG_STOCK, PLATE_STOCK, PLY, PORCH, SECTIONS, type FrameDatums } from '@/lib/framing/spec'
import { chooseJoints, piecesBetween } from '@/lib/framing/splice'
import type { Member, MemberKind, Section } from '@/lib/framing/types'
import { X } from '@/lib/framing/vec3'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { Inch } from '@/lib/units'

const grid16 = (v: Inch) => Math.round(v * 16) / 16

/**
 * The beam and ledger stop 1/16″ inside the end rafters so their end grain never shares a plane
 * with a rafter's outer face (the rafters overlap both at their seats).
 */
const END_INSET: Inch = 1 / 16

export interface PorchLines {
  beamBottom: Inch
  beamTop: Inch
  /** Rafter underside: z at plan y. */
  underside(y: Inch): Inch
  /** Rafter top: z at plan y. */
  top(y: Inch): Inch
  ledger: { y: readonly [Inch, Inch]; z: readonly [Inch, Inch] }
}

export function porchLines(house: ResolvedHouse): PorchLines | null {
  const { porch, roof, footprint: fp, datums } = house.spec
  if (!porch.posts.length) return null
  const slope = roof.porch.pitch / 12
  const cos = 1 / Math.hypot(1, slope)
  const depth = SECTIONS[PORCH.rafter][1]
  const beamBottom = datums.porchDeck + PORCH.beamClear
  const beamTop = beamBottom + SECTIONS[PORCH.beam][1]
  const seatY = Math.max(...porch.posts.map((p) => p[3])) // the beam's inner face
  const underside = (y: Inch) => beamTop + slope * (y - seatY)
  const top = (y: Inch) => underside(y) + depth / cos
  const ledgerY = [fp[1] - PORCH.sheathing - PLY, fp[1] - PORCH.sheathing] as const
  const ledgerTop = grid16(top(ledgerY[0]))
  return {
    beamBottom,
    beamTop,
    underside,
    top,
    ledger: { y: ledgerY, z: [ledgerTop - SECTIONS[PORCH.ledger][1], ledgerTop] },
  }
}

/** Porch shapes this round frames; throws with a reason otherwise. */
export function assertPorchFramable(house: ResolvedHouse, z: FrameDatums, roof: RoofLines) {
  const P = porchLines(house)
  if (!P) return
  const { porch } = house.spec
  const ys = new Set(porch.posts.map((p) => `${p[1]},${p[3]}`))
  if (ys.size !== 1) throw new Error('Porch posts must stand in one row under one beam')
  const gap = roof.lowerEdge(roof.tail0) - P.top(roof.tail0)
  if (gap < PORCH.tuck)
    throw new Error(`The porch shed rises within ${gap.toFixed(2)}″ of the truss tails`)
  if (P.ledger.z[1] > z.studTop) throw new Error('The porch ledger would sit above the wall studs')
}

export function framePorch(house: ResolvedHouse, z: FrameDatums): Member[] {
  const P = porchLines(house)
  if (!P) return []
  const { porch, roof } = house.spec
  const out: Member[] = []
  const add = (id: string, kind: MemberKind, section: Section, box: Box, treated = false) =>
    out.push(
      member(
        {
          id: `porch/${id}`,
          kind,
          material: section === 'concrete' ? 'concrete' : 'wood',
          section,
          ...(treated ? { treated: true as const } : {}),
          group: 'porch',
        },
        box,
      ),
    )
  const posts = [...porch.posts].sort((p, q) => p[0] - q[0])
  const pierTop = z.grade + PORCH.pierAboveGrade
  const r = PORCH.pier / 2
  posts.forEach((p, i) => {
    const cx = (p[0] + p[2]) / 2
    const cy = (p[1] + p[3]) / 2
    add(
      `pier-${i + 1}`,
      'pier',
      'concrete',
      axisBox([cx - r, cy - r, z.grade], [cx + r, cy + r, pierTop], 'z'),
    )
  })
  // R317.1.4: wood columns are decay resistant or treated.
  posts.forEach((p, i) =>
    add(
      `post-${i + 1}`,
      'post',
      PORCH.post,
      axisBox([p[0], p[1], pierTop], [p[2], p[3], P.beamBottom], 'z'),
      true,
    ),
  )

  const [rx0, ry0, rx1] = roof.porch.rect
  const xa = rx0 + END_INSET
  const xb = rx1 - END_INSET
  // Beam joints fall over posts.
  const postX = posts.map((p) => (p[0] + p[2]) / 2)
  const [py0, py1] = [posts[0][1], posts[0][3]]
  piecesBetween(xa, xb, chooseJoints(xa, xb, LONG_STOCK, postX)).forEach(([a, b], i) =>
    add(`beam-${i}`, 'beam', PORCH.beam, axisBox([a, py0, P.beamBottom], [b, py1, P.beamTop], 'x')),
  )

  // Rafters: one flush with each end of the shed, commons at 24″ from the west end.
  const ends = [rx0 + PLY / 2, rx1 - PLY / 2]
  const xs = [ends[0]]
  for (let k = 1; rx0 + PORCH.spacing * k + PLY / 2 <= rx1 - PLY; k++)
    xs.push(rx0 + PORCH.spacing * k)
  xs.push(ends[1])

  // Ledger joints fall on rafter centres.
  const ly = P.ledger.y
  const lz = P.ledger.z
  piecesBetween(xa, xb, chooseJoints(xa, xb, PLATE_STOCK, xs)).forEach(([a, b], i) =>
    add(`ledger-${i}`, 'ledger', PORCH.ledger, axisBox([a, ly[0], lz[0]], [b, ly[1], lz[1]], 'x')),
  )

  const depth = SECTIONS[PORCH.rafter][1]
  const cos = 1 / Math.hypot(1, roof.porch.pitch / 12)
  const centre = (y: Inch) => P.underside(y) + depth / 2 / cos
  xs.forEach((x, i) =>
    add(
      `rafter-${String(i + 1).padStart(2, '0')}`,
      'rafter',
      PORCH.rafter,
      between([x, ry0, centre(ry0)], [x, ly[0], centre(ly[0])], X, PLY, depth),
    ),
  )
  return out
}
