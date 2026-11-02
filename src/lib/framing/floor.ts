/**
 * Foundation, floor frame and subfloor: concrete stem walls and girder piers, PT sills, rim and
 * end joists, a flush built-up girder, 2x10 joists running N–S, and the ¾″ OSB deck.
 */
import { axisBox, member, type Box } from '@/lib/framing/geom3'
import {
  GIRDER,
  JOIST,
  LONG_STOCK,
  OSB,
  PIER,
  PLATE_STOCK,
  PLY,
  STEM,
  type FrameDatums,
} from '@/lib/framing/spec'
import { chooseJoints, piecesBetween } from '@/lib/framing/splice'
import type { Member } from '@/lib/framing/types'
import type { ResolvedHouse, ResolvedWall } from '@/lib/house/resolve'
import type { Inch } from '@/lib/units'

export interface JoistBay {
  name: string
  /** Joist ends (rim face or girder face). */
  y0: Inch
  y1: Inch
  /** Clear span between the faces of the supports (sill or girder), R502.3.1. */
  clear: Inch
}

export interface FloorFrame {
  foundation: Member[]
  floor: Member[]
  deck: Member[]
  bays: JoistBay[]
  /** Girder centrelines (y). */
  girders: Inch[]
}

export type Side = 's' | 'e' | 'n' | 'w'
export const SIDES: readonly Side[] = ['s', 'e', 'n', 'w']

/** Which side of the building an exterior wall is on. */
export function sideOf(w: ResolvedWall, house: ResolvedHouse): Side {
  const fp = house.spec.footprint
  if (w.axis === 'x') return w.t0 === fp[1] ? 's' : 'n'
  return w.t0 === fp[0] ? 'w' : 'e'
}

/** Snap to the 1/16″ grid so derived positions stay exact. */
const grid16 = (v: Inch) => Math.round(v * 16) / 16
const tag = (v: Inch) => String(v).padStart(3, '0')

/** Smallest number of evenly spaced girders that keeps every joist bay within its span. */
export function girderLines(house: ResolvedHouse, sill: Inch): Inch[] {
  const [, y0, , y1] = house.spec.footprint
  const half = (GIRDER.plies * PLY) / 2
  for (let g = 0; g < 8; g++) {
    const lines = Array.from({ length: g }, (_, i) => grid16(y0 + ((y1 - y0) * (i + 1)) / (g + 1)))
    const faces = [y0 + sill, ...lines.flatMap((y) => [y - half, y + half]), y1 - sill]
    let ok = true
    for (let i = 0; i < faces.length; i += 2)
      if (faces[i + 1] - faces[i] > JOIST.spanMax) ok = false
    if (ok) return lines
  }
  throw new Error('Floor depth needs more than 7 girders')
}

export function frameFloor(house: ResolvedHouse, z: FrameDatums): FloorFrame {
  const fp = house.spec.footprint
  const [x0, y0, x1, y1] = fp
  const grade = z.grade
  const ext = house.walls.filter((w) => w.spec.kind === 'exterior')
  const bySide = new Map(ext.map((w) => [sideOf(w, house), w]))
  const sill = ext[0].asm.depth
  const joistTop = z.joistTop
  const joistBottom = z.joistBottom

  // ── Foundation: stem walls poured S, E, N, W with the outer face on the building line. ────
  const foundation: Member[] = []
  const concrete = (id: string, kind: 'stem-wall' | 'pier', box: Box) =>
    foundation.push(
      member({ id, kind, material: 'concrete', section: 'concrete', group: 'foundation' }, box),
    )
  const t = STEM.w
  const stems: Record<Side, Box> = {
    s: axisBox([x0, y0, grade], [x1, y0 + t, z.stemTop], 'x'),
    e: axisBox([x1 - t, y0 + t, grade], [x1, y1 - t, z.stemTop], 'y'),
    n: axisBox([x0, y1 - t, grade], [x1, y1, z.stemTop], 'x'),
    w: axisBox([x0, y0 + t, grade], [x0 + t, y1 - t, z.stemTop], 'y'),
  }
  for (const side of SIDES) concrete(`stem/${side}`, 'stem-wall', stems[side])

  // ── Girders: flush 3-ply 2x10 on piers. Flush keeps both bays on one joist layout, and a
  // dropped girder would sit under R317.1's 12″ from grade. ────────────────────────────────
  const girders = girderLines(house, sill)
  const halfG = (GIRDER.plies * PLY) / 2
  const bays = Math.ceil((x1 - x0) / GIRDER.pierSpacing)
  const piers = Array.from({ length: bays - 1 }, (_, k) =>
    grid16(x0 + ((x1 - x0) * (k + 1)) / bays),
  )
  const pr = PIER.w / 2
  for (const [gi, gy] of girders.entries())
    for (const px of piers)
      concrete(
        `pier/g${gi + 1}-x${tag(px)}`,
        'pier',
        axisBox([px - pr, gy - pr, grade], [px + pr, gy + pr, joistBottom], 'z'),
      )

  // ── Floor frame: sills, rim and end joists, girder plies, joists. ──────────────────────────
  const floor: Member[] = []
  const wood = (info: Omit<Member, 'material' | 'group' | keyof Box>, box: Box) =>
    floor.push(member({ ...info, material: 'wood', group: 'floor' }, box))
  const layout = (a: Inch, b: Inch) => {
    const out: Inch[] = []
    for (let k = 1; a + JOIST.spacing * k < b; k++) out.push(a + JOIST.spacing * k)
    return out
  }

  // PT sills on the exterior wall rects. Standard on concrete; R317.1(2) requires it where the
  // sill sits within 8″ of grade.
  for (const side of SIDES) {
    const w = bySide.get(side)!
    const along = w.axis === 'x' ? 0 : 1
    const joints = chooseJoints(w.s0, w.s1, PLATE_STOCK, layout(fp[along], w.s1))
    piecesBetween(w.s0, w.s1, joints).forEach(([s0, s1], i) => {
      const box =
        w.axis === 'x'
          ? axisBox([s0, w.t0, z.stemTop], [s1, w.t1, z.sillTop], 'x')
          : axisBox([w.t0, s0, z.stemTop], [w.t1, s1, z.sillTop], 'y')
      wood({ id: `sill/${side}-${i}`, kind: 'sill', section: '2x6', treated: true }, box)
    })
  }

  // Rim joists run through on the S and N; end joists sit between them on the E and W.
  const joistsX = layout(x0, x1 - PLY).filter((x) => x + PLY / 2 <= x1 - PLY)
  for (const side of SIDES) {
    if (side === 's' || side === 'n') {
      const ty = side === 's' ? [y0, y0 + PLY] : [y1 - PLY, y1]
      piecesBetween(x0, x1, chooseJoints(x0, x1, LONG_STOCK, joistsX)).forEach(([a, b], i) =>
        wood(
          { id: `rim/${side}-${i}`, kind: 'rim', section: '2x10' },
          axisBox([a, ty[0], joistBottom], [b, ty[1], joistTop], 'x'),
        ),
      )
    } else {
      const tx = side === 'w' ? [x0, x0 + PLY] : [x1 - PLY, x1]
      const a = y0 + PLY
      const b = y1 - PLY
      piecesBetween(a, b, chooseJoints(a, b, LONG_STOCK, [...girders, ...layout(y0, y1)])).forEach(
        ([p, q], i) =>
          wood(
            { id: `rim/${side}-${i}`, kind: 'rim', section: '2x10' },
            axisBox([tx[0], p, joistBottom], [tx[1], q, joistTop], 'y'),
          ),
      )
    }
  }

  // Girder plies between the end joists, bearing on the E and W sills. Ply joints fall over
  // alternate piers, staggered ply to ply.
  girders.forEach((gy, gi) => {
    for (let p = 0; p < GIRDER.plies; p++) {
      const ya = gy - halfG + PLY * p
      const joints = piers.filter((_, k) => (k + p) % 2 === 1)
      piecesBetween(x0 + PLY, x1 - PLY, joints).forEach(([a, b], i) =>
        wood(
          { id: `girder/${gi + 1}/p${p + 1}-${i}`, kind: 'girder', section: '2x10' },
          axisBox([a, ya, joistBottom], [b, ya + PLY, joistTop], 'x'),
        ),
      )
    }
  })

  // Joist bays: from the rim to the first girder, girder to girder, last girder to the far rim.
  const ends = [y0 + PLY, ...girders.flatMap((g) => [g - halfG, g + halfG]), y1 - PLY]
  const bayNames =
    girders.length === 1 ? ['s', 'n'] : ends.filter((_, i) => i % 2 === 0).map((_, i) => `b${i}`)
  const joistBays: JoistBay[] = []
  for (let i = 0; i < ends.length; i += 2) {
    const a = ends[i]
    const b = ends[i + 1]
    joistBays.push({
      name: bayNames[i / 2],
      y0: a,
      y1: b,
      clear: (i + 1 === ends.length - 1 ? y1 - sill : b) - (i === 0 ? y0 + sill : a),
    })
  }

  // Layout joists at 16″ from the building line, so the 8′ sheet ends land on joist centres.
  // Partitions parallel to the joists get a joist under them as a nailer (R502.4 requires one
  // only under bearing partitions); one that would crowd a layout joist is sistered to it.
  for (const bay of joistBays) {
    const xs: { x0: Inch; x1: Inch; id: string }[] = joistsX.map((x) => ({
      x0: x - PLY / 2,
      x1: x + PLY / 2,
      id: `joist/${bay.name}/x${tag(x)}`,
    }))
    const taken = [{ x0, x1: x0 + PLY }, ...xs, { x0: x1 - PLY, x1 }]
    for (const w of house.walls) {
      if (w.spec.kind !== 'interior' || w.axis !== 'y' || w.s1 <= bay.y0 || w.s0 >= bay.y1) continue
      if (joistsX.some((x) => x >= w.t0 && x <= w.t1)) continue
      const xc = (w.t0 + w.t1) / 2
      let j = { x0: xc - PLY / 2, x1: xc + PLY / 2 }
      const near = taken.find((q) => j.x0 < q.x1 + PLY && q.x0 < j.x1 + PLY)
      if (near)
        j =
          xc > (near.x0 + near.x1) / 2
            ? { x0: near.x1, x1: near.x1 + PLY }
            : { x0: near.x0 - PLY, x1: near.x0 }
      if (taken.some((q) => j.x0 < q.x1 && q.x0 < j.x1))
        throw new Error(`No room for a joist under ${w.spec.id}`)
      taken.push(j)
      xs.push({ ...j, id: `joist/${bay.name}/${w.spec.id}` })
    }
    xs.sort((p, q) => p.x0 - q.x0)
    for (const j of xs)
      wood(
        { id: j.id, kind: 'joist', section: JOIST.section },
        axisBox([j.x0, bay.y0, joistBottom], [j.x1, bay.y1, joistTop], 'y'),
      )
  }

  // ── Deck: 4×8 sheets, long side across the joists, end joints staggered 4′ row to row. ─────
  const deck: Member[] = []
  for (let r = 0; y0 + OSB.w * r < y1; r++) {
    const ya = y0 + OSB.w * r
    const yb = Math.min(ya + OSB.w, y1)
    const cuts: Inch[] = []
    for (let x = x0 + (r % 2) * (OSB.l / 2); x < x1; x += OSB.l) if (x > x0) cuts.push(x)
    piecesBetween(x0, x1, cuts).forEach(([a, b]) =>
      deck.push(
        member(
          {
            id: `deck/r${r}-${tag(a)}`,
            kind: 'subfloor',
            material: 'wood',
            section: 'osb',
            group: 'deck',
          },
          axisBox([a, ya, joistTop], [b, yb, z.floor], 'x'),
        ),
      ),
    )
  }

  return { foundation, floor, deck, bays: joistBays, girders }
}
