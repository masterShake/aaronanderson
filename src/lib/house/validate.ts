/**
 * Invariants for a HouseSpec. `validateHouse(HOUSE_NO_1)` must return []. Each rule protects
 * something the drawing or the future framing relies on; see docs/handoff.md.
 */
import { codeChecks } from '@/lib/house/code-checks'
import {
  across,
  along,
  area,
  height,
  insideRect,
  intersection,
  overlaps,
  width,
  type Rect,
} from '@/lib/geom/rect'
import { resolveHouse, type ResolvedHouse, type ResolvedOpening, type ResolvedWall } from '@/lib/house/resolve'
import type { Door, HouseSpec } from '@/lib/house/types'
import { GWB, isSixteenth, type Inch } from '@/lib/units'

export interface Issue {
  rule: string
  at: string
  message: string
}

/** Minimum distance from a rough opening to a wall end or to another wall landing on its host. */
export const RO_END_CLEARANCE: Inch = 3
/** Minimum solid wall between two rough openings in the same host. */
export const RO_GAP: Inch = 6
/** Minimum header depth available between the RO head and the double top plate. */
export const MIN_HEADER: Inch = 3.5

/** Fixture kinds that sit within the footprint of a run or a top (they overlap it by design). */
const NESTED: Record<string, readonly string[]> = {
  'sink-double': ['counter', 'island'],
  dw: ['counter', 'island'],
  range: ['counter', 'island'],
}

export function validateHouse(spec: HouseSpec): Issue[] {
  const issues: Issue[] = []
  const add = (rule: string, at: string, message: string) => issues.push({ rule, at, message })

  // 1. Unique ids, resolvable references.
  const ids = (kind: string, list: readonly { id: string }[]) => {
    const seen = new Set<string>()
    for (const { id } of list) {
      if (seen.has(id)) add('unique-id', `${kind}:${id}`, `Duplicate ${kind} id`)
      seen.add(id)
    }
    return seen
  }
  const wallIds = ids('wall', spec.walls)
  const roomIds = ids('room', spec.rooms)
  ids('opening', spec.openings)
  ids('fixture', spec.fixtures)
  ids('device', spec.devices)
  ids('dim', spec.dims)
  for (const o of spec.openings) if (!wallIds.has(o.wall)) add('reference', `opening:${o.id}`, `Unknown wall ${o.wall}`)
  for (const f of spec.fixtures) {
    if (!roomIds.has(f.room)) add('reference', `fixture:${f.id}`, `Unknown room ${f.room}`)
    if (f.wall && !wallIds.has(f.wall)) add('reference', `fixture:${f.id}`, `Unknown wall ${f.wall}`)
  }
  for (const d of spec.devices) if (!roomIds.has(d.room)) add('reference', `device:${d.id}`, `Unknown room ${d.room}`)
  for (const d of spec.dims)
    for (const r of d.refs) if (!wallIds.has(r.wall)) add('reference', `dim:${d.id}`, `Unknown wall ${r.wall}`)
  if (issues.length) return issues // later rules assume references resolve

  // 2. Every authored number is finite and on the 1/16″ grid.
  scanNumbers(spec, 'spec', (path, v) => {
    if (!isSixteenth(v)) add('sixteenth', path, `${v} is not a multiple of 1/16″`)
  })

  const house = resolveHouse(spec)

  // 3. Walls: thickness equals assembly depth, no overlaps, every end joined.
  for (const w of house.walls) {
    const thickness = Math.min(width(w.spec.rect), height(w.spec.rect))
    if (thickness !== w.asm.depth)
      add('wall-thickness', `wall:${w.spec.id}`, `Thickness ${thickness} ≠ ${w.spec.assembly} depth ${w.asm.depth}`)
    for (const end of ['lo', 'hi'] as const) {
      const joined = w.contacts.some(
        (c) =>
          (c.kind === 'butt' && c.face === end) ||
          (c.kind === 'corner' && (end === 'lo' ? c.s0 === w.s0 : c.s1 === w.s1)),
      )
      if (!joined) add('wall-end', `wall:${w.spec.id}`, `The ${end} end is not joined to another wall`)
    }
  }
  for (let i = 0; i < spec.walls.length; i++)
    for (let j = i + 1; j < spec.walls.length; j++)
      if (overlaps(spec.walls[i].rect, spec.walls[j].rect))
        add('wall-overlap', `wall:${spec.walls[i].id}`, `Overlaps ${spec.walls[j].id}`)

  // 4. Exterior walls tile the perimeter band of the footprint.
  const fp = spec.footprint
  const ext = house.walls.filter((w) => w.spec.kind === 'exterior')
  const depth = ext[0]?.asm.depth ?? 0
  const band = area(fp) - (width(fp) - 2 * depth) * (height(fp) - 2 * depth)
  const extArea = ext.reduce((s, w) => s + area(w.spec.rect), 0)
  if (extArea !== band || ext.some((w) => !insideRect(w.spec.rect, fp)))
    add('exterior-band', 'walls', 'Exterior walls do not tile the footprint perimeter')

  // 5. Openings.
  for (const w of house.walls) {
    for (const o of w.openings) {
      const at = `opening:${o.spec.id}`
      if (o.s0 < w.s0 + RO_END_CLEARANCE || o.s1 > w.s1 - RO_END_CLEARANCE)
        add('ro-span', at, `RO ${o.s0}–${o.s1} is within ${RO_END_CLEARANCE}″ of the ends of ${w.spec.id}`)
      for (const c of w.contacts) {
        if (c.kind === 'butt') continue
        if (o.s0 < c.s1 + RO_END_CLEARANCE && o.s1 > c.s0 - RO_END_CLEARANCE)
          add('ro-tee', at, `RO is within ${RO_END_CLEARANCE}″ of ${c.wall} landing on ${w.spec.id}`)
      }
      const plateUnder = w.height - 1.5 * w.asm.topPlates
      if (plateUnder - o.head < MIN_HEADER) add('header', at, `Only ${plateUnder - o.head}″ for a header`)
      if (o.sill < 0) add('sill', at, 'RO bottom is below the subfloor')
    }
    for (let i = 0; i + 1 < w.openings.length; i++)
      if (w.openings[i + 1].s0 - w.openings[i].s1 < RO_GAP)
        add('ro-gap', `opening:${w.openings[i + 1].spec.id}`, `Less than ${RO_GAP}″ from ${w.openings[i].spec.id}`)
    for (const o of w.openings) {
      if (o.spec.kind !== 'door' || o.spec.op !== 'swing') continue
      const quad = swingQuadrant(w, o)
      for (const other of spec.walls)
        if (other.id !== w.spec.id && overlaps(quad, other.rect))
          add('swing', `opening:${o.spec.id}`, `Door swing hits wall ${other.id}`)
      for (const f of spec.fixtures)
        if (f.z[0] < 80 && overlaps(quad, f.rect)) add('swing', `opening:${o.spec.id}`, `Door swing hits ${f.id}`)
    }
  }

  // 6. Rooms: inside the building's finished interior (porch outside it), no overlaps.
  const interior: Rect = [fp[0] + depth + GWB, fp[1] + depth + GWB, fp[2] - depth - GWB, fp[3] - depth - GWB]
  const rooms = spec.rooms.filter((r) => r.use !== 'porch')
  for (const r of rooms) {
    if (!insideRect(r.rect, interior)) add('room-inside', `room:${r.id}`, 'Outside the finished interior')
    for (const w of spec.walls) {
      const shared = intersection(r.rect, w.rect)
      // Walls inside a carved-out part of the room (closet walls in a bedroom) are expected.
      if (shared && !(r.cut ?? []).some((c) => insideRect(shared, c)))
        add('room-wall', `room:${r.id}`, `Overlaps wall ${w.id}`)
    }
    for (const c of r.cut ?? []) if (!insideRect(c, r.rect)) add('room-cut', `room:${r.id}`, 'Cut outside its room')
  }
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const shared = intersection(rooms[i].rect, rooms[j].rect)
      if (!shared) continue
      const absorbed = [...(rooms[i].cut ?? []), ...(rooms[j].cut ?? [])].some((c) => insideRect(shared, c))
      if (!absorbed) add('room-overlap', `room:${rooms[i].id}`, `Overlaps ${rooms[j].id}`)
    }

  // 7. Fixtures: inside their room, no clashes at the same height, backing wall adjacent.
  for (const f of spec.fixtures) {
    const room = spec.rooms.find((r) => r.id === f.room)
    if (room && !insideRect(f.rect, room.rect, GWB)) add('fixture-room', `fixture:${f.id}`, `Outside ${f.room}`)
    if (f.wall) {
      const wall = house.wall(f.wall).spec.rect
      if (!adjacent(f.rect, wall, 1)) add('fixture-wall', `fixture:${f.id}`, `Not against ${f.wall}`)
    }
  }
  for (let i = 0; i < spec.fixtures.length; i++)
    for (let j = i + 1; j < spec.fixtures.length; j++) {
      const a = spec.fixtures[i]
      const b = spec.fixtures[j]
      if (!overlaps(a.rect, b.rect) || a.z[1] <= b.z[0] || b.z[1] <= a.z[0]) continue
      const nested =
        (NESTED[a.kind]?.includes(b.kind) && insideRect(a.rect, b.rect)) ||
        (NESTED[b.kind]?.includes(a.kind) && insideRect(b.rect, a.rect))
      if (!nested) add('fixture-clash', `fixture:${a.id}`, `Clashes with ${b.id}`)
    }

  // 8. Code checks.
  const report = codeChecks(house)
  for (const e of report.egress) if (!e.pass) add('code-R310', `room:${e.room}`, 'No compliant egress window')
  for (const h of report.hall) if (!h.pass) add('code-R311', `room:${h.room}`, `Hall clear ${h.clear}″ < 36″`)
  if (!report.door.pass) add('code-R311', `opening:${report.door.opening}`, 'Egress door under 32″ clear')
  for (const w of report.wc) if (!w.pass) add('code-R307', `fixture:${w.fixture}`, 'WC clearance under 15″/21″')
  for (const a of report.alarms) if (!a.pass) add('code-R314', `room:${a.room}`, 'No smoke alarm')
  for (const r of report.roomSize) if (!r.pass) add('code-R304', `room:${r.room}`, 'Under 70 SF or 7′')

  return issues
}

/** Square swept by a swing door's leaf: hinge 1″ inside the RO, on the side it opens into. */
export function swingQuadrant(w: ResolvedWall, o: ResolvedOpening): Rect {
  const door = o.spec as Door
  const leaf = door.w
  const hingeS = door.hinge === 'hi' ? o.s1 - 1 : o.s0 + 1
  const sSpan: [Inch, Inch] = door.hinge === 'hi' ? [hingeS - leaf, hingeS] : [hingeS, hingeS + leaf]
  const tSpan: [Inch, Inch] = door.side === 'lo' ? [w.t0 - leaf, w.t0] : [w.t1, w.t1 + leaf]
  return w.axis === 'x' ? [sSpan[0], tSpan[0], sSpan[1], tSpan[1]] : [tSpan[0], sSpan[0], tSpan[1], sSpan[1]]
}

/** Rect `a` sits beside rect `b` (gap ≤ tol along one axis, overlapping along the other). */
function adjacent(a: Rect, b: Rect, tol: Inch): boolean {
  for (const axis of ['x', 'y'] as const) {
    const [a0, a1] = along(a, axis)
    const [b0, b1] = along(b, axis)
    const [c0, c1] = across(a, axis)
    const [d0, d1] = across(b, axis)
    const overlapAcross = Math.min(c1, d1) - Math.max(c0, d0) > 0
    const gap = Math.max(b0 - a1, a0 - b1)
    if (overlapAcross && gap >= 0 && gap <= tol) return true
  }
  return false
}

function scanNumbers(v: unknown, path: string, visit: (path: string, n: number) => void) {
  if (typeof v === 'number') visit(path, v)
  else if (Array.isArray(v)) v.forEach((x, i) => scanNumbers(x, `${path}[${i}]`, visit))
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) scanNumbers(x, `${path}.${k}`, visit)
}

/** Convenience for callers that only need to know the house is sound. */
export function assertValidHouse(spec: HouseSpec): ResolvedHouse {
  const issues = validateHouse(spec)
  if (issues.length) throw new Error(`Invalid house:\n${issues.map((i) => `  ${i.rule} ${i.at}: ${i.message}`).join('\n')}`)
  return resolveHouse(spec)
}
