/**
 * IRC checks computed from the spec. The blue "AI" callouts in chapter 1 display these values,
 * and the validator requires every check to pass, so nothing on screen claims more than the
 * drawing supports. Thresholds are from IRC R304, R307, R310, R311 and R314 (2018–2024).
 */
import { height, width, type Rect } from '@/lib/geom/rect'
import { probeBeside, roomAt, type ResolvedHouse } from '@/lib/house/resolve'
import type { Fixture, Window } from '@/lib/house/types'
import { sqft, type Inch } from '@/lib/units'

export const EGRESS = { area: 5.7, w: 20, h: 24, sill: 44 } as const
export const HALL_MIN: Inch = 36
export const EGRESS_DOOR_MIN: Inch = 32
export const WC_SIDE: Inch = 15
export const WC_FRONT: Inch = 21
export const ROOM_MIN_SF = 70
export const ROOM_MIN_DIM: Inch = 84

/** Bottom of the clear opening sits about 2″ above the rough sill (frame and sash). */
const FRAME_ALLOWANCE: Inch = 2
/** Door clear width = slab width − stop and hinge allowance. */
const DOOR_CLEAR_ALLOWANCE: Inch = 2.5

export interface EgressWindow {
  id: string
  area: number
  w: Inch
  h: Inch
  sill: Inch
  pass: boolean
}

export interface CodeReport {
  egress: { room: string; windows: EgressWindow[]; pass: boolean }[]
  hall: { room: string; clear: Inch; pass: boolean }[]
  door: { opening: string; clear: Inch; pass: boolean }
  wc: { fixture: string; room: string; sides: readonly [Inch, Inch]; front: Inch; box: Rect; pass: boolean }[]
  alarms: { room: string; device: string | null; pass: boolean }[]
  roomSize: { room: string; area: number; minDim: Inch; pass: boolean }[]
  pass: boolean
}

/** The room a window or door serves: the room just inside its host wall. */
export function servedRoom(house: ResolvedHouse, openingId: string): string | null {
  const o = house.opening(openingId)
  const host = house.wall(o.spec.wall)
  const s = (o.s0 + o.s1) / 2
  for (const face of ['lo', 'hi'] as const) {
    const r = roomAt(house, probeBeside(host, s, face))
    if (r) return r.spec.id
  }
  return null
}

export function codeChecks(house: ResolvedHouse): CodeReport {
  const { spec } = house

  const windows = spec.openings.filter((o): o is Window => o.kind === 'window')
  const egress = house.rooms
    .filter((r) => r.spec.use === 'bedroom')
    .map((room) => {
      const served = windows.filter((w) => servedRoom(house, w.id) === room.spec.id)
      const results = served.map((w): EgressWindow => {
        const [nw, nh] = w.netClear ?? [0, 0]
        const sill = house.opening(w.id).sill + FRAME_ALLOWANCE
        const a = sqft(nw * nh)
        return {
          id: w.id,
          area: a,
          w: nw,
          h: nh,
          sill,
          pass: a >= EGRESS.area && nw >= EGRESS.w && nh >= EGRESS.h && sill <= EGRESS.sill,
        }
      })
      return { room: room.spec.id, windows: results, pass: results.some((r) => r.pass) }
    })

  const hall = house.rooms
    .filter((r) => r.spec.use === 'hall')
    .map((r) => {
      const clear = Math.min(width(r.spec.rect), height(r.spec.rect))
      return { room: r.spec.id, clear, pass: clear >= HALL_MIN }
    })

  const entry = spec.openings.find((o) => o.kind === 'door' && o.op === 'swing' && o.exterior)
  const doorClear = entry ? entry.w - DOOR_CLEAR_ALLOWANCE : 0
  const door = { opening: entry?.id ?? '', clear: doorClear, pass: doorClear >= EGRESS_DOOR_MIN }

  const wc = spec.fixtures.filter((f) => f.kind === 'wc').map((f) => wcClearance(house, f))

  const alarms = house.rooms
    .filter((r) => r.spec.use === 'bedroom' || r.spec.use === 'hall')
    .map((r) => {
      const d = spec.devices.find((dv) => dv.kind === 'smoke-alarm' && roomAt(house, dv.at)?.spec.id === r.spec.id)
      return { room: r.spec.id, device: d?.id ?? null, pass: Boolean(d) }
    })

  const roomSize = house.rooms
    .filter((r) => r.spec.use === 'bedroom' || r.spec.use === 'living')
    .map((r) => {
      const best = largestClearRect(r.spec.rect, r.spec.cut ?? [])
      return { room: r.spec.id, area: r.area, minDim: best, pass: r.area >= ROOM_MIN_SF && best >= ROOM_MIN_DIM }
    })

  const pass =
    egress.every((e) => e.pass) &&
    hall.every((h) => h.pass) &&
    door.pass &&
    wc.every((w) => w.pass) &&
    alarms.every((a) => a.pass) &&
    roomSize.every((r) => r.pass)

  return { egress, hall, door, wc, alarms, roomSize, pass }
}

/**
 * R307: 15″ from the WC centreline to any side obstruction, 21″ clear in front. Obstructions are
 * the room's finished faces and the other fixtures in the room.
 */
function wcClearance(house: ResolvedHouse, f: Fixture) {
  const room = house.room(f.room).spec
  const others = house.spec.fixtures.filter((o) => o.room === f.room && o !== f).map((o) => o.rect)
  const r = f.rect
  // Work in a frame where the WC faces "forward" along u, with sides along v.
  const alongX = f.facing === 'E' || f.facing === 'W'
  const u0 = alongX ? r[0] : r[1]
  const u1 = alongX ? r[2] : r[3]
  const vc = alongX ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2
  const forward = f.facing === 'E' || f.facing === 'N' ? 1 : -1
  const lo = (q: Rect) => (alongX ? q[1] : q[0])
  const hi = (q: Rect) => (alongX ? q[3] : q[2])
  const ulo = (q: Rect) => (alongX ? q[0] : q[1])
  const uhi = (q: Rect) => (alongX ? q[2] : q[3])

  // Sides: obstacles overlapping the WC's own depth band.
  let below = lo(room.rect)
  let above = hi(room.rect)
  for (const q of others) {
    if (uhi(q) <= u0 || ulo(q) >= u1) continue
    if (hi(q) <= vc) below = Math.max(below, hi(q))
    if (lo(q) >= vc) above = Math.min(above, lo(q))
  }
  const sides = [vc - below, above - vc] as const

  // Front: obstacles overlapping the 30″ band in front of the bowl.
  const front0 = forward > 0 ? u1 : u0
  let front = forward > 0 ? uhi(room.rect) - front0 : front0 - ulo(room.rect)
  for (const q of others) {
    if (hi(q) <= vc - WC_SIDE || lo(q) >= vc + WC_SIDE) continue
    const gap = forward > 0 ? ulo(q) - front0 : front0 - uhi(q)
    if (gap >= 0) front = Math.min(front, gap)
  }

  const boxU: [Inch, Inch] = forward > 0 ? [u0, u1 + WC_FRONT] : [u0 - WC_FRONT, u1]
  const boxV: [Inch, Inch] = [vc - WC_SIDE, vc + WC_SIDE]
  const box: Rect = alongX ? [boxU[0], boxV[0], boxU[1], boxV[1]] : [boxV[0], boxU[0], boxV[1], boxU[1]]

  return {
    fixture: f.id,
    room: f.room,
    sides,
    front,
    box,
    pass: sides[0] >= WC_SIDE && sides[1] >= WC_SIDE && front >= WC_FRONT,
  }
}

/**
 * R304: the least dimension of the best clear rectangle left after removing a corner cut. With at
 * most one cut per room the candidates are "full width, shortened depth" and "shortened width,
 * full depth"; the room passes if either is at least 7′ both ways.
 */
function largestClearRect(r: Rect, cuts: readonly Rect[]): Inch {
  const w = width(r)
  const d = height(r)
  if (cuts.length === 0) return Math.min(w, d)
  const c = cuts[0]
  return Math.max(Math.min(w, d - height(c)), Math.min(w - width(c), d))
}
