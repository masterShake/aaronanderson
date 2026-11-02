/**
 * Roof framing for a gable with the ridge along x: 2x4 Fink common trusses at 24″ from the
 * building line, a gable truss flush with each end wall (gable studs on the wall-stud layout),
 * and a 2x4 rake ladder (barge rafter and lookouts) outside each gable for the rake overhang.
 *
 * Trusses lie in a y–z plane and bear on the cap plates. The top chord's lower edge passes
 * through the bottom chord's top corner at the building line, which sets the heel height.
 * Members that share a truss plane overlap at the heel, peak and panel points, so each rank is
 * thinned 1/32″ per side (spec THIN) to keep co-planar faces apart.
 */
import { axisBox, between, member, type Box } from '@/lib/framing/geom3'
import { PLY, RAKE, SECTIONS, THIN, TRUSS, type FrameDatums } from '@/lib/framing/spec'
import type { Member, MemberKind, Vec3 } from '@/lib/framing/types'
import { X } from '@/lib/framing/vec3'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { Inch } from '@/lib/units'

/** Section lines of the main roof, shared with the porch (which tucks under the truss tails). */
export interface RoofLines {
  /** Rise per inch of run. */
  slope: number
  cos: number
  sin: number
  /** Chord depth. */
  depth: Inch
  y0: Inch
  y1: Inch
  ridgeAt: Inch
  /** Tail ends (fascia lines) south and north. */
  tail0: Inch
  tail1: Inch
  /** Top of the bottom chord. */
  chordTop: Inch
  /** Bottom chord top to top chord top, at the building line. */
  heelHeight: Inch
  /** Top of the top chords at the ridge. */
  ridge: Inch
  /** Underside of the top chords at plan y (either slope). */
  lowerEdge(y: Inch): Inch
}

export function roofLines(house: ResolvedHouse, z: FrameDatums): RoofLines {
  const { footprint: fp, roof } = house.spec
  const slope = roof.main.pitch / 12
  const cos = 1 / Math.hypot(1, slope)
  const sin = slope * cos
  const depth = SECTIONS[TRUSS.chord][1]
  const chordTop = z.plate + depth
  const ridgeAt = roof.main.ridgeAt
  const lowerEdge = (y: Inch) => chordTop + slope * Math.min(y - fp[1], fp[3] - y)
  return {
    slope,
    cos,
    sin,
    depth,
    y0: fp[1],
    y1: fp[3],
    ridgeAt,
    tail0: fp[1] - roof.main.eave,
    tail1: fp[3] + roof.main.eave,
    chordTop,
    heelHeight: depth + depth / cos,
    ridge: lowerEdge(ridgeAt) + depth / cos,
    lowerEdge,
  }
}

/** Thickness of a member of the given rank within one plane. */
const ranked = (rank: number) => PLY - 2 * THIN * rank

export interface RoofFrame {
  /** One list per truss, west to east: truss/01 is the west gable. */
  trusses: { id: string; members: Member[] }[]
  rakes: { id: string; members: Member[] }[]
}

export function frameRoof(house: ResolvedHouse, z: FrameDatums): RoofFrame {
  const L = roofLines(house, z)
  const fp = house.spec.footprint
  const main = house.spec.roof.main
  const D = L.depth
  const sec = TRUSS.chord
  // Centreline of a top chord at plan y on the south slope (s) or north slope (n).
  const centreZ = (y: Inch) => L.lowerEdge(y) + D / 2 / L.cos
  const peakZ = L.ridge // upper edges meet at the ridge line
  const peakWP = centreZ(L.ridgeAt) // centrelines meet here (web working point)
  const bottomWP = z.plate + D / 2

  /** Top chord from its tail centre to the end whose upper corner sits on the peak. */
  const topChord = (x: Inch, side: 's' | 'n', thick: Inch): Box => {
    const tailY = side === 's' ? L.tail0 : L.tail1
    const dy = (D / 2) * L.sin
    const endY = side === 's' ? L.ridgeAt + dy : L.ridgeAt - dy
    return between([x, tailY, centreZ(tailY)], [x, endY, peakZ - (D / 2) * L.cos], X, thick, D)
  }

  const trusses: RoofFrame['trusses'] = []
  const xs: { x: Inch; gable: boolean }[] = [{ x: fp[0] + PLY / 2, gable: true }]
  for (let k = 1; fp[0] + main.spacing * k + PLY / 2 <= fp[2] - PLY; k++)
    xs.push({ x: fp[0] + main.spacing * k, gable: false })
  xs.push({ x: fp[2] - PLY / 2, gable: true })

  xs.forEach(({ x, gable }, i) => {
    const id = `truss/${String(i + 1).padStart(2, '0')}`
    const members: Member[] = []
    const add = (suffix: string, kind: MemberKind, box: Box) =>
      members.push(
        member({ id: `${id}/${suffix}`, kind, material: 'wood', section: sec, group: id }, box),
      )
    // Bottom chord in two 16′ halves, spliced at the ridge line.
    const t0 = ranked(0) / 2
    add('bot-s', 'chord', axisBox([x - t0, L.y0, z.plate], [x + t0, L.ridgeAt, L.chordTop], 'y'))
    add('bot-n', 'chord', axisBox([x - t0, L.ridgeAt, z.plate], [x + t0, L.y1, L.chordTop], 'y'))
    add('top-s', 'chord', topChord(x, 's', ranked(1)))
    add('top-n', 'chord', topChord(x, 'n', ranked(2)))
    if (gable) {
      // Gable studs over the end wall's stud layout, cut to the top chord's underside at their
      // uphill face (the downhill corner hides inside the chord).
      const t3 = ranked(3) / 2
      for (let k = 1; L.y0 + TRUSS.gableStud * k + PLY / 2 < L.y1; k++) {
        const y = L.y0 + TRUSS.gableStud * k
        const ya = y - PLY / 2
        const yb = y + PLY / 2
        const top =
          ya < L.ridgeAt && L.ridgeAt < yb
            ? L.lowerEdge(L.ridgeAt)
            : Math.max(L.lowerEdge(ya), L.lowerEdge(yb))
        if (top - L.chordTop < PLY) continue
        add(
          `stud-y${String(y).padStart(3, '0')}`,
          'gable-stud',
          axisBox([x - t3, ya, L.chordTop], [x + t3, yb, top], 'z'),
        )
      }
    } else {
      // Fink webs between working points: bottom chord third points, top chord quarter points
      // and the peak. Webs meeting at a joint alternate ranks 3 and 4.
      const span = L.y1 - L.y0
      const b1: Vec3 = [x, L.y0 + span / 3, bottomWP]
      const b2: Vec3 = [x, L.y0 + (2 * span) / 3, bottomWP]
      const q1: Vec3 = [x, L.y0 + span / 4, centreZ(L.y0 + span / 4)]
      const q2: Vec3 = [x, L.y0 + (3 * span) / 4, centreZ(L.y0 + (3 * span) / 4)]
      const pk: Vec3 = [x, L.ridgeAt, peakWP]
      const webs: [Vec3, Vec3][] = [
        [q1, b1],
        [b1, pk],
        [pk, b2],
        [b2, q2],
      ]
      webs.forEach(([p, q], j) =>
        add(`web-${j + 1}`, 'web', between(p, q, X, ranked(3 + (j % 2)), D)),
      )
    }
    trusses.push({ id, members })
  })

  // ── Rake ladders: a barge rafter on the chord profile and lookouts back to the gable truss,
  // their top faces in the roof plane. The two barges overlap at the peak, so they take ranks
  // 0 and 1 like the top chords. ────────────────────────────────────────────────────────────
  const rakes: RoofFrame['rakes'] = []
  for (const end of ['w', 'e'] as const) {
    const id = `rake/${end}`
    const out = end === 'w' ? -1 : 1
    const bargeX = (end === 'w' ? fp[0] : fp[2]) + out * (main.rake - PLY / 2)
    const gableX = end === 'w' ? fp[0] + PLY / 2 : fp[2] - PLY / 2
    const members: Member[] = []
    const add = (suffix: string, kind: MemberKind, box: Box) =>
      members.push(
        member(
          { id: `${id}/${suffix}`, kind, material: 'wood', section: RAKE.section, group: id },
          box,
        ),
      )
    add('barge-s', 'barge', topChord(bargeX, 's', ranked(0)))
    add('barge-n', 'barge', topChord(bargeX, 'n', ranked(1)))
    for (const side of ['s', 'n'] as const) {
      const bargeFace = bargeX - out * (ranked(side === 's' ? 0 : 1) / 2)
      const chordFace = gableX + out * (ranked(side === 's' ? 1 : 2) / 2)
      const [xa, xb] = end === 'w' ? [bargeFace, chordFace] : [chordFace, bargeFace]
      const slope: Vec3 = side === 's' ? [0, L.cos, L.sin] : [0, -L.cos, L.sin]
      for (let j = 0; L.y0 + RAKE.spacing * j <= L.ridgeAt - RAKE.spacing; j++) {
        const y = side === 's' ? L.y0 + RAKE.spacing * j : L.y1 - RAKE.spacing * j
        const zc = centreZ(y)
        add(
          `lookout-${side}-${String(y).padStart(3, '0')}`,
          'lookout',
          between([xa, y, zc], [xb, y, zc], slope, PLY, D),
        )
      }
    }
    rakes.push({ id, members })
  }

  return { trusses, rakes }
}
