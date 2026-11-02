/**
 * Wall framing, one pass per resolved wall, in wall coordinates (s along the axis, t across it):
 * - bottom plates: exactly chapter 1's poché pieces, plus one under each window RO;
 * - end studs, opening framing (kings, jacks, headers, rough sills, cripples), backing where
 *   other walls land, and common studs at 16″ (from the building line outside, from s0 inside);
 * - a top plate spliced on stud centres, and a cap that laps across corners and tees.
 * Exterior walls are framed flat and tilted up, so they also get their hinge (Tilt).
 */
import { along as rectAlong } from '@/lib/geom/rect'
import { sideOf } from '@/lib/framing/floor'
import { axisBox, member, type Box } from '@/lib/framing/geom3'
import {
  EXT_HEADER,
  FLAT_HEADER,
  PLATE_STOCK,
  PLY,
  SECTIONS,
  WIDE_RO,
  type FrameDatums,
} from '@/lib/framing/spec'
import { chooseJoints, piecesBetween } from '@/lib/framing/splice'
import type { Member, MemberKind, Section, Tilt, Vec3 } from '@/lib/framing/types'
import { cross, Z } from '@/lib/framing/vec3'
import type { ResolvedHouse, ResolvedOpening, ResolvedWall } from '@/lib/house/resolve'
import type { Inch } from '@/lib/units'

export interface WallFrame {
  wall: ResolvedWall
  /** Bottom plates (group 'plates'), in s order. */
  plates: Member[]
  /** The wall's own assembly (group 'wall/<id>'): studs through top plate, by (s, z). */
  frame: Member[]
  /** Cap plates (group 'caps'), in s order. */
  caps: Member[]
  tilt?: Tilt
}

type Span = readonly [Inch, Inch]

/** One member in wall coordinates. Flat members (plates, headers, sills) have their grain along s. */
interface Piece {
  id: string
  kind: MemberKind
  section: Section
  s: Span
  t: Span
  z: Span
  grain: 's' | 'z'
  opening?: string
  piece?: number
}

const overlaps = (a: Span, b: Span) => a[0] < b[1] && b[0] < a[1]
const centre = (a: Span) => (a[0] + a[1]) / 2

/**
 * Cap layout for every wall. A wall whose end butts another wall's face carries its cap across
 * that wall's top plate to the far face, and the host's cap breaks there. R602.3.2 requires this
 * overlap at corners and bearing partitions; lapping every tee as well is allowed and ties the
 * partitions in. Where two walls land on the same spot from opposite sides, the first in spec
 * order laps and the second stops at the host's face.
 */
export function capLayout(house: ResolvedHouse): Map<string, { run: Span; breaks: Span[] }> {
  const plans = new Map(
    house.walls.map((w) => [w.spec.id, { run: [w.s0, w.s1] as Span, breaks: [] as Span[] }]),
  )
  for (const b of house.walls)
    for (const c of b.contacts) {
      if (c.kind !== 'butt') continue
      const a = house.wall(c.wall)
      const hc = a.contacts.find((x) => x.wall === b.spec.id && x.kind !== 'butt')
      if (!hc)
        throw new Error(`${b.spec.id} butts ${a.spec.id}, but ${a.spec.id} has no matching contact`)
      const host = plans.get(a.spec.id)!
      if (host.breaks.some((x) => x[0] < hc.s1 && hc.s0 < x[1])) continue
      host.breaks.push([hc.s0, hc.s1])
      const far = rectAlong(a.spec.rect, b.axis)
      const own = plans.get(b.spec.id)!
      own.run = c.face === 'lo' ? [far[0], own.run[1]] : [own.run[0], far[1]]
    }
  return plans
}

/** The cap runs of one wall: its (extended) run minus the breaks where other caps cross it. */
export function capRuns(plan: { run: Span; breaks: Span[] }): Span[] {
  const out: Span[] = []
  let at = plan.run[0]
  for (const [b0, b1] of [...plan.breaks].sort((p, q) => p[0] - q[0])) {
    if (b0 > at) out.push([at, b0])
    at = Math.max(at, b1)
  }
  if (plan.run[1] > at) out.push([at, plan.run[1]])
  return out
}

/** Header depth over an opening: two 2x12 plies outside, a flat 2x inside (R602.7, R602.7.4). */
export const headerDepth = (w: ResolvedWall): Inch =>
  w.spec.kind === 'exterior' ? SECTIONS[EXT_HEADER.section][1] : PLY

/** Jacks per side: the wide exterior slider gets two. */
export const jacksPerSide = (w: ResolvedWall, o: ResolvedOpening): number =>
  w.spec.kind === 'exterior' && o.ro.w > WIDE_RO ? 2 : 1

/** Shapes this round frames; throws with a reason otherwise. */
export function assertWallsFramable(house: ResolvedHouse, z: FrameDatums) {
  for (const w of house.walls)
    for (const o of w.openings) {
      const top = o.head + headerDepth(w)
      if (top > z.studTop)
        throw new Error(`${o.spec.id}: no room for a ${headerDepth(w)}″ header under the top plate`)
      if (
        w.spec.kind === 'interior' &&
        (z.studTop - top > FLAT_HEADER.gap || o.ro.w > FLAT_HEADER.span)
      )
        throw new Error(`${o.spec.id}: too wide or too low for a flat header (R602.7.4)`)
      if (o.spec.kind === 'window' && o.sill - PLY <= z.bottomPlateTop)
        throw new Error(`${o.spec.id}: sill too low for a rough sill and cripples`)
    }
}

export function frameWalls(house: ResolvedHouse, z: FrameDatums): WallFrame[] {
  const caps = capLayout(house)
  return house.walls.map((w) => frameWall(house, w, z, capRuns(caps.get(w.spec.id)!)))
}

function frameWall(house: ResolvedHouse, w: ResolvedWall, z: FrameDatums, runs: Span[]): WallFrame {
  const id = w.spec.id
  const ext = w.spec.kind === 'exterior'
  const stud = w.asm.stud
  const full: Span = [w.t0, w.t1]
  const zb = z.bottomPlateTop
  const zt = z.studTop
  const T = PLY
  const vertical = (pid: string, kind: MemberKind, s: Span, zs: Span, opening?: string): Piece => ({
    id: pid,
    kind,
    section: stud,
    s,
    t: full,
    z: zs,
    grain: 'z',
    ...(opening ? { opening } : {}),
  })

  // ── 1–2. End studs, then each opening's kings, jacks, header, rough sill and sill cripples. ──
  const fixed: Piece[] = [
    vertical(`${id}/stud/end-lo`, 'stud', [w.s0, w.s0 + T], [zb, zt]),
    vertical(`${id}/stud/end-hi`, 'stud', [w.s1 - T, w.s1], [zb, zt]),
  ]
  const opening: Piece[] = []
  for (const o of w.openings) {
    const oid = o.spec.id
    const nj = jacksPerSide(w, o)
    for (let j = 1; j <= nj; j++) {
      fixed.push(
        vertical(
          `${id}/${oid}/jack-lo-${j}`,
          'jack',
          [o.s0 - T * j, o.s0 - T * (j - 1)],
          [zb, o.head],
          oid,
        ),
      )
      fixed.push(
        vertical(
          `${id}/${oid}/jack-hi-${j}`,
          'jack',
          [o.s1 + T * (j - 1), o.s1 + T * j],
          [zb, o.head],
          oid,
        ),
      )
    }
    fixed.push(
      vertical(`${id}/${oid}/king-lo`, 'king', [o.s0 - T * (nj + 1), o.s0 - T * nj], [zb, zt], oid),
    )
    fixed.push(
      vertical(`${id}/${oid}/king-hi`, 'king', [o.s1 + T * nj, o.s1 + T * (nj + 1)], [zb, zt], oid),
    )
    const span: Span = [o.s0 - T * nj, o.s1 + T * nj]
    const head: Span = [o.head, o.head + headerDepth(w)]
    const header = (pid: string, section: Section, t: Span): Piece => ({
      id: pid,
      kind: 'header',
      section,
      s: span,
      t,
      z: head,
      grain: 's',
      opening: oid,
    })
    if (ext) {
      opening.push(header(`${id}/${oid}/header-0`, EXT_HEADER.section, [w.t0, w.t0 + T]))
      opening.push(header(`${id}/${oid}/header-1`, EXT_HEADER.section, [w.t1 - T, w.t1]))
    } else opening.push(header(`${id}/${oid}/header`, stud, full))
    if (o.spec.kind === 'window') {
      opening.push({
        id: `${id}/${oid}/sill`,
        kind: 'rough-sill',
        section: stud,
        s: [o.s0, o.s1],
        t: full,
        z: [o.sill - T, o.sill],
        grain: 's',
        opening: oid,
      })
      opening.push(
        vertical(`${id}/${oid}/cripple-dn-lo`, 'cripple', [o.s0, o.s0 + T], [zb, o.sill - T], oid),
      )
      opening.push(
        vertical(`${id}/${oid}/cripple-dn-hi`, 'cripple', [o.s1 - T, o.s1], [zb, o.sill - T], oid),
      )
    }
  }

  // ── 3. Backing: a stud just outside each face of a wall that lands here, so both walls' board
  // has nailing in the corner. One that hits a king or jack slides toward the landing wall; the
  // validator's 3″ RO clearance keeps it over the face line. Identical backings merge. ─────────
  const backing: Piece[] = []
  for (const c of w.contacts) {
    if (c.kind === 'butt') continue
    for (const side of ['lo', 'hi'] as const) {
      const f = side === 'lo' ? c.s0 : c.s1
      if (f <= w.s0 + T || f >= w.s1 - T) continue // the end stud backs it
      let s: Span = side === 'lo' ? [f - T, f] : [f, f + T]
      const hit = fixed.find((q) => overlaps(q.s, s))
      if (hit) s = side === 'lo' ? [hit.s[1], hit.s[1] + T] : [hit.s[0] - T, hit.s[0]]
      if (s[0] > f || s[1] < f || fixed.some((q) => overlaps(q.s, s)))
        throw new Error(`${id}: no room for backing where ${c.wall} lands`)
      const twin = backing.find((q) => overlaps(q.s, s))
      if (twin) {
        if (twin.s[0] <= f && f <= twin.s[1]) continue
        throw new Error(`${id}: backing for ${c.wall} collides with ${twin.id}`)
      }
      backing.push(vertical(`${id}/stud/${c.wall}-${side}`, 'stud', s, [zb, zt]))
    }
  }

  // ── 4. Common studs on layout. A slot that hits any of the above is dropped; one inside an
  // RO becomes cripples over the header (and under the rough sill). ─────────────────────────
  const origin = ext ? house.spec.footprint[w.axis === 'x' ? 0 : 1] : w.s0
  const common: Piece[] = []
  const taken = [...fixed, ...backing]
  for (let k = 1; origin + w.asm.spacing * k + T / 2 <= w.s1; k++) {
    const sc = origin + w.asm.spacing * k
    const s: Span = [sc - T / 2, sc + T / 2]
    if (s[0] < w.s0 || taken.some((q) => overlaps(q.s, s))) continue
    const o = w.openings.find((x) => x.s0 <= s[0] && s[1] <= x.s1)
    if (!o) {
      common.push(vertical(`${id}/stud/k${k}`, 'stud', s, [zb, zt]))
      continue
    }
    const oid = o.spec.id
    opening.push(
      vertical(`${id}/${oid}/cripple-up-k${k}`, 'cripple', s, [o.head + headerDepth(w), zt], oid),
    )
    if (
      o.spec.kind === 'window' &&
      !opening.some((q) => q.kind === 'cripple' && q.z[0] === zb && overlaps(q.s, s))
    )
      opening.push(vertical(`${id}/${oid}/cripple-dn-k${k}`, 'cripple', s, [zb, o.sill - T], oid))
  }

  const verticals = [...fixed, ...backing, ...common, ...opening]
  const centresUnder = (zs: number, kinds: readonly MemberKind[]) =>
    verticals
      .filter((q) => kinds.includes(q.kind) && (q.z[0] === zs || q.z[1] === zs))
      .map((q) => centre(q.s))

  // ── 5. Plates. Bottom plates are the poché pieces (spliced on a stud if longer than stock),
  // plus one under each window; doors get none. ────────────────────────────────────────────
  const plates: Piece[] = []
  const onPlate = centresUnder(zb, ['stud', 'king', 'jack'])
  w.pieces.forEach((p, i) => {
    const [a, b] = rectAlong(p, w.axis)
    const parts = piecesBetween(a, b, chooseJoints(a, b, PLATE_STOCK, onPlate))
    parts.forEach((s, j) =>
      plates.push({
        id: parts.length > 1 ? `${id}/plate/p${i}-${j}` : `${id}/plate/p${i}`,
        kind: 'plate-bottom',
        section: stud,
        s,
        t: full,
        z: [z.floor, zb],
        grain: 's',
        piece: i,
      }),
    )
  })
  for (const o of w.openings)
    if (o.spec.kind === 'window')
      plates.push({
        id: `${id}/plate/${o.spec.id}`,
        kind: 'plate-bottom',
        section: stud,
        s: rectAlong(o.cut, w.axis),
        t: full,
        z: [z.floor, zb],
        grain: 's',
        opening: o.spec.id,
      })

  // Top plate joints sit on stud centres, 24″ clear of every cap joint; cap splices then stay
  // 24″ clear of the top plate joints (R602.3.2).
  const underTop = centresUnder(zt, ['stud', 'king', 'cripple']).filter(
    (x) => x > w.s0 + T && x < w.s1 - T,
  )
  const capEnds = runs.flatMap((r) => [r[0], r[1]])
  const topJoints = chooseJoints(w.s0, w.s1, PLATE_STOCK, underTop, capEnds)
  const top: Piece[] = piecesBetween(w.s0, w.s1, topJoints).map((s, j) => ({
    id: `${id}/top/${j}`,
    kind: 'plate-top',
    section: stud,
    s,
    t: full,
    z: [zt, zt + T],
    grain: 's',
  }))
  const cap: Piece[] = []
  for (const r of runs)
    for (const s of piecesBetween(
      r[0],
      r[1],
      chooseJoints(r[0], r[1], PLATE_STOCK, underTop, topJoints),
    ))
      cap.push({
        id: `${id}/cap/${cap.length}`,
        kind: 'plate-cap',
        section: stud,
        s,
        t: full,
        z: [zt + T, z.plate],
        grain: 's',
      })

  // ── Out to plan space. ────────────────────────────────────────────────────────────────────
  const toMember = (q: Piece, group: string): Member =>
    member(
      {
        id: q.id,
        kind: q.kind,
        material: 'wood',
        section: q.section,
        group,
        wall: id,
        s: centre(q.s),
        ...(q.piece !== undefined ? { piece: q.piece } : {}),
        ...(q.opening ? { opening: q.opening } : {}),
      },
      toBox(w, q),
    )
  const bySZ = (p: Piece, q: Piece) =>
    centre(p.s) - centre(q.s) ||
    centre(p.z) - centre(q.z) ||
    centre(p.t) - centre(q.t) ||
    (p.id < q.id ? -1 : 1)
  const bySpan = (p: Piece, q: Piece) => p.s[0] - q.s[0]
  const group = `wall/${id}`
  return {
    wall: w,
    plates: plates.sort(bySpan).map((q) => toMember(q, 'plates')),
    frame: [...verticals, ...top].sort(bySZ).map((q) => toMember(q, group)),
    caps: cap.sort(bySpan).map((q) => toMember(q, 'caps')),
    ...(ext ? { tilt: tiltOf(house, w, zb) } : {}),
  }
}

function toBox(w: ResolvedWall, q: Piece): Box {
  const grain = q.grain === 'z' ? 'z' : w.axis
  return w.axis === 'x'
    ? axisBox([q.s[0], q.t[0], q.z[0]], [q.s[1], q.t[1], q.z[1]], grain)
    : axisBox([q.t[0], q.s[0], q.z[0]], [q.t[1], q.s[1], q.z[1]], grain)
}

/**
 * The hinge of an exterior wall: the inner top edge of its bottom plate. Walls that run through
 * the corners go up first (batch 0); the walls that butt between them follow (batch 1), since a
 * through wall swings through the corner the butting wall stands in.
 */
function tiltOf(house: ResolvedHouse, w: ResolvedWall, zb: Inch): Tilt {
  const side = sideOf(w, house)
  const inward: Vec3 =
    side === 's' ? [0, 1, 0] : side === 'n' ? [0, -1, 0] : side === 'w' ? [1, 0, 0] : [-1, 0, 0]
  const tIn = side === 's' || side === 'w' ? w.t1 : w.t0
  const sMid = (w.s0 + w.s1) / 2
  const axis = cross(Z, inward)
  return {
    wall: w.spec.id,
    batch: w.contacts.some((c) => c.kind === 'butt') ? 1 : 0,
    pivot: w.axis === 'x' ? [sMid, tIn, zb] : [tIn, sMid, zb],
    axis: [axis[0] + 0, axis[1] + 0, axis[2] + 0],
    inward,
  }
}
