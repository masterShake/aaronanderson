/**
 * Derived geometry, shared by the plan drawing now and the framing later. Everything here is a
 * pure function of the HouseSpec.
 *
 * Wall frame: s runs along the wall's axis (s0 → s1), t across its thickness (t0 → t1). For an
 * E–W wall s is x and t is y; for a N–S wall s is y and t is x. Framing lays studs along s.
 */
import { outline, type OutlinePiece } from '@/lib/geom/outline'
import {
  across,
  along,
  area,
  fromAxis,
  height,
  longAxis,
  subtractIntervals,
  width,
  type Axis,
  type Rect,
} from '@/lib/geom/rect'
import type { Assembly, HouseSpec, Opening, Room, Wall } from '@/lib/house/types'
import { sqft, type Inch } from '@/lib/units'

export const DEFAULT_HEAD: Inch = 82.5

export interface WallContact {
  wall: string
  /**
   * tee:    another wall's end lands on this wall's side face, away from this wall's ends.
   * corner: another wall's end lands on this wall's side face within this wall's end zone.
   * butt:   this wall's end lands on another wall's side face.
   */
  kind: 'tee' | 'corner' | 'butt'
  /** tee/corner: the side of this wall touched (lo = t0 face). butt: the end of this wall (lo = s0). */
  face: 'lo' | 'hi'
  /** Interval along this wall's axis covered by the contact. */
  s0: Inch
  s1: Inch
}

export interface ResolvedOpening {
  spec: Opening
  /** Rough opening interval along the host axis. */
  s0: Inch
  s1: Inch
  ro: { w: Inch; h: Inch }
  /** Top and bottom of the rough opening above the subfloor (bottom is 0 for doors). */
  head: Inch
  sill: Inch
  /** RO cut through the full wall thickness, in plan. */
  cut: Rect
}

export interface ResolvedWall {
  spec: Wall
  asm: Assembly
  axis: Axis
  s0: Inch
  s1: Inch
  t0: Inch
  t1: Inch
  height: Inch
  contacts: WallContact[]
  openings: ResolvedOpening[]
  /** The wall rect with the RO cuts removed: poché now, bottom plates later. */
  pieces: Rect[]
}

export interface ResolvedRoom {
  spec: Room
  /** Net area in square feet (rect minus cuts). */
  area: number
  /** Finished rect width and depth. */
  size: readonly [w: Inch, d: Inch]
}

export interface ResolvedHouse {
  spec: HouseSpec
  walls: ResolvedWall[]
  wall(id: string): ResolvedWall
  opening(id: string): ResolvedOpening
  /** Exact wall boundary (union of wall rects minus RO cuts), each piece tagged with its wall index. */
  outline: OutlinePiece[]
  rooms: ResolvedRoom[]
  room(id: string): ResolvedRoom
}

export function roughOpening(o: Opening): { w: Inch; h: Inch } {
  if (o.ro) return o.ro
  if (o.kind === 'window') return { w: o.w + 0.5, h: o.h + 0.5 }
  return { w: o.op === 'slider' ? o.w + 0.5 : o.w + 2, h: o.head ?? DEFAULT_HEAD }
}

export function resolveHouse(spec: HouseSpec): ResolvedHouse {
  const walls: ResolvedWall[] = spec.walls.map((w) => {
    const axis = longAxis(w.rect)
    const [s0, s1] = along(w.rect, axis)
    const [t0, t1] = across(w.rect, axis)
    return {
      spec: w,
      asm: spec.assemblies[w.assembly],
      axis,
      s0,
      s1,
      t0,
      t1,
      height: spec.datums.plate,
      contacts: [],
      openings: [],
      pieces: [],
    }
  })
  const byId = new Map(walls.map((w) => [w.spec.id, w]))

  for (const a of walls) for (const b of walls) if (a !== b) addContacts(a, b)

  for (const o of spec.openings) {
    const host = byId.get(o.wall)
    if (!host) continue
    const ro = roughOpening(o)
    const head = o.head ?? DEFAULT_HEAD
    const s0 = o.at - ro.w / 2
    const s1 = o.at + ro.w / 2
    host.openings.push({
      spec: o,
      s0,
      s1,
      ro,
      head,
      sill: head - ro.h,
      cut: fromAxis(host.axis, [s0, s1], [host.t0, host.t1]),
    })
  }
  for (const w of walls) {
    w.openings.sort((p, q) => p.s0 - q.s0)
    w.contacts.sort((p, q) => p.s0 - q.s0)
    w.pieces = subtractIntervals(
      w.spec.rect,
      w.axis,
      w.openings.map((o) => [Math.max(o.s0, w.s0), Math.min(o.s1, w.s1)] as const),
    )
  }

  const openings = new Map(walls.flatMap((w) => w.openings.map((o) => [o.spec.id, o] as const)))
  const rooms = spec.rooms.map((r): ResolvedRoom => {
    const cutArea = (r.cut ?? []).reduce((sum, c) => sum + area(c), 0)
    return { spec: r, area: sqft(area(r.rect) - cutArea), size: [width(r.rect), height(r.rect)] }
  })
  const roomById = new Map(rooms.map((r) => [r.spec.id, r]))

  return {
    spec,
    walls,
    wall: (id) => must(byId.get(id), `wall ${id}`),
    opening: (id) => must(openings.get(id), `opening ${id}`),
    outline: outline(
      walls.map((w) => w.spec.rect),
      walls.flatMap((w) => w.openings.map((o) => o.cut)),
    ),
    rooms,
    room: (id) => must(roomById.get(id), `room ${id}`),
  }
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`Unknown ${what}`)
  return v
}

/** Record how wall b touches wall a (from a's point of view). */
function addContacts(a: ResolvedWall, b: ResolvedWall) {
  const rb = b.spec.rect
  // b touches one of a's side faces (the faces parallel to a's axis)?
  for (const face of ['lo', 'hi'] as const) {
    const t = face === 'lo' ? a.t0 : a.t1
    const [bt0, bt1] = across(rb, a.axis)
    const touches = face === 'lo' ? bt1 === t : bt0 === t
    if (!touches) continue
    const [bs0, bs1] = along(rb, a.axis)
    const s0 = Math.max(bs0, a.s0)
    const s1 = Math.min(bs1, a.s1)
    if (s1 <= s0) continue
    const depth = a.t1 - a.t0
    const atEnd = s0 < a.s0 + depth || s1 > a.s1 - depth
    a.contacts.push({ wall: b.spec.id, kind: atEnd ? 'corner' : 'tee', face, s0, s1 })
  }
  // a's end faces touch b's side?
  for (const end of ['lo', 'hi'] as const) {
    const s = end === 'lo' ? a.s0 : a.s1
    const [bs0, bs1] = along(rb, a.axis)
    const touches = end === 'lo' ? bs1 === s : bs0 === s
    if (!touches) continue
    const [bt0, bt1] = across(rb, a.axis)
    if (Math.min(bt1, a.t1) - Math.max(bt0, a.t0) <= 0) continue
    // Only a butt if b runs perpendicular across a's end (b's long axis is a's cross axis).
    if (longAxis(rb) === a.axis) continue
    a.contacts.push({ wall: b.spec.id, kind: 'butt', face: end, s0: s, s1: s })
  }
}

/** Which room (finished rect, net of cuts) contains a plan point. */
export function roomAt(house: ResolvedHouse, p: readonly [Inch, Inch]): ResolvedRoom | undefined {
  return house.rooms.find(
    (r) =>
      inRect(r.spec.rect, p) && !(r.spec.cut ?? []).some((c) => inRect(c, p)) && r.spec.use !== 'porch',
  )
}

const inRect = (r: Rect, [x, y]: readonly [Inch, Inch]) => x > r[0] && x < r[2] && y > r[1] && y < r[3]

/** A point just inside the room-side face of a wall at a position along its axis. */
export function probeBeside(w: ResolvedWall, s: Inch, face: 'lo' | 'hi', offset = 2): readonly [Inch, Inch] {
  const t = face === 'lo' ? w.t0 - offset : w.t1 + offset
  return w.axis === 'x' ? [s, t] : [t, s]
}
