import { describe, expect, it } from 'vitest'
import { frameHouse } from '@/lib/framing/frame'
import { frameFloor, sideOf } from '@/lib/framing/floor'
import {
  aabb,
  boundsOf,
  corners,
  faceClashes,
  flatPose,
  obbOverlap,
  tiltPose,
  type Box,
} from '@/lib/framing/geom3'
import {
  frameDatums,
  GRADE_CLEARANCE,
  JOIST,
  MIN_BEARING,
  OSB,
  PLATE_LAP,
  PLY,
  STEM_ABOVE_GRADE,
  stockLength,
} from '@/lib/framing/spec'
import type { Frame, Member, Tilt } from '@/lib/framing/types'
import { fromAxis, type Rect } from '@/lib/geom/rect'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse, type ResolvedWall } from '@/lib/house/resolve'
import type { HouseSpec } from '@/lib/house/types'
import { validateHouse } from '@/lib/house/validate'
import { planDrawing } from '@/lib/plan/drawing'

/** A 24′×20′ single room with one door and one window, a small porch and the same roof rules. */
const SMALL: HouseSpec = {
  ...HOUSE_NO_1,
  meta: { ...HOUSE_NO_1.meta, name: 'TEST HOUSE' },
  footprint: [0, 0, 288, 240],
  walls: [
    { id: 'ext-s', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 0, 288, 5.5] },
    { id: 'ext-e', kind: 'exterior', assembly: 'ext-2x6', rect: [282.5, 5.5, 288, 234.5] },
    { id: 'ext-n', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 234.5, 288, 240] },
    { id: 'ext-w', kind: 'exterior', assembly: 'ext-2x6', rect: [0, 5.5, 5.5, 234.5] },
  ],
  openings: [
    {
      id: 'D01',
      kind: 'door',
      op: 'swing',
      exterior: true,
      wall: 'ext-s',
      at: 144,
      w: 36,
      h: 80,
      hinge: 'lo',
      side: 'hi',
    },
    { id: 'W01', kind: 'window', tag: 1, wall: 'ext-n', at: 144, op: 'single-hung', w: 36, h: 48 },
  ],
  rooms: [
    { id: 'studio', name: 'STUDIO', use: 'living', rect: [6, 6, 282, 234] },
    { id: 'porch', name: 'PORCH', use: 'porch', rect: [96, -48, 192, 0] },
  ],
  fixtures: [],
  devices: [],
  porch: {
    rect: [96, -48, 192, 0],
    posts: [
      [96.25, -47.5, 101.75, -42],
      [186.25, -47.5, 191.75, -42],
    ],
    steps: { rect: [120, -64, 168, -48], risers: 2 },
  },
  roof: {
    main: { ...HOUSE_NO_1.roof.main, ridgeAt: 120 },
    porch: { type: 'shed', pitch: 3, rect: [90, -60, 198, -12] },
  },
  dims: [],
}

const HOUSES = [
  ['House No. 1', HOUSE_NO_1],
  ['the 24′×20′ test house', SMALL],
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

type Span = readonly [number, number]

const TOL = 1e-6
const isTruss = (m: Member) => m.group.startsWith('truss/') || m.group.startsWith('rake/')
const ids = (frame: Frame, pairs: readonly (readonly [number, number])[]) =>
  pairs.map(([i, j]) => `${frame.members[i].id} × ${frame.members[j].id}`)

/** Pairs of boxes that interpenetrate (AABB sweep, then the separating-axis test). */
function interpenetrating(boxes: readonly Box[], allowed: (i: number, j: number) => boolean) {
  const bb = boxes.map(aabb)
  const order = boxes.map((_, i) => i).sort((a, b) => bb[a][0][0] - bb[b][0][0])
  const out: [number, number][] = []
  for (let a = 0; a < order.length; a++) {
    const i = order[a]
    for (let b = a + 1; b < order.length; b++) {
      const j = order[b]
      if (bb[j][0][0] >= bb[i][1][0] - TOL) break
      if (bb[j][0][1] >= bb[i][1][1] - TOL || bb[i][0][1] >= bb[j][1][1] - TOL) continue
      if (bb[j][0][2] >= bb[i][1][2] - TOL || bb[i][0][2] >= bb[j][1][2] - TOL) continue
      if (obbOverlap(boxes[i], boxes[j]) > TOL && !allowed(i, j)) out.push([i, j])
    }
  }
  return out
}

/** Listed joints: anything within one truss or rake ladder, and porch rafters at their seats. */
const jointAllowed = (members: readonly Member[]) => (i: number, j: number) => {
  const a = members[i]
  const b = members[j]
  if (a.group === b.group && isTruss(a)) return true
  const kinds = new Set([a.kind, b.kind])
  return kinds.has('rafter') && (kinds.has('ledger') || kinds.has('beam'))
}

const planRect = (m: Box): Rect => {
  const [lo, hi] = aabb(m)
  return [lo[0], lo[1], hi[0], hi[1]]
}
const sSpan = (w: ResolvedWall, m: Box): Span => {
  const [lo, hi] = aabb(m)
  const k = w.axis === 'x' ? 0 : 1
  return [lo[k], hi[k]]
}
const zSpan = (m: Box): Span => {
  const [lo, hi] = aabb(m)
  return [lo[2], hi[2]]
}
const sMid = (w: ResolvedWall, m: Box) => (sSpan(w, m)[0] + sSpan(w, m)[1]) / 2

/** Is [a, b] covered by the union of spans? */
function covered([a, b]: Span, spans: readonly Span[]): boolean {
  let at = a
  for (const [p, q] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (p > at) break
    at = Math.max(at, q)
  }
  return at >= b
}

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
const rectArea = (r: Rect) => (r[2] - r[0]) * (r[3] - r[1])

/** Members of the frame lying where they are at a given moment of the raise. */
function tiltSets(frame: Frame) {
  const tilts = frame.assemblies.filter((a) => a.tilt)
  const base = frame.assemblies
    .filter((a) => ['plates', 'floor', 'foundation', 'deck'].includes(a.id))
    .flatMap((a) => a.members.map((i) => frame.members[i]))
  const home = (a: (typeof tilts)[number]) => a.members.map((i) => frame.members[i])
  const flat = (a: (typeof tilts)[number]) => home(a).map((m) => flatPose(m, a.tilt!))
  return { tilts, base, home, flat }
}

describe.each(HOUSES)('frameHouse: %s', (_, spec) => {
  const house = resolveHouse(spec)
  const frame = frameHouse(house)
  const { members } = frame
  const z = frameDatums(spec)
  const fp = spec.footprint
  const byWall = (w: ResolvedWall) => members.filter((m) => m.wall === w.spec.id)

  it('starts from a valid house', () => {
    expect(validateHouse(spec)).toEqual([])
  })

  it('is deterministic', () => {
    expect(frameHouse(resolveHouse(spec))).toEqual(frame)
  })

  it('is well-formed', () => {
    expect(new Set(members.map((m) => m.id)).size).toBe(members.length)
    const owner = new Map<number, string>()
    for (const a of frame.assemblies)
      for (const i of a.members) {
        expect(owner.has(i), `${members[i].id} in two assemblies`).toBe(false)
        owner.set(i, a.id)
      }
    expect(owner.size).toBe(members.length)
    for (const [i, m] of members.entries()) {
      expect(owner.get(i), m.id).toBe(m.group)
      for (const x of [...m.c, ...m.u, ...m.v, ...m.size])
        expect(Number.isFinite(x), m.id).toBe(true)
      expect(Math.hypot(...m.u), m.id).toBeCloseTo(1, 12)
      expect(Math.hypot(...m.v), m.id).toBeCloseTo(1, 12)
      expect(Math.abs(m.u[0] * m.v[0] + m.u[1] * m.v[1] + m.u[2] * m.v[2]), m.id).toBeLessThan(
        1e-12,
      )
      expect(Math.min(...m.size), m.id).toBeGreaterThan(0)
      expect(m.material === 'concrete', m.id).toBe(m.section === 'concrete')
    }
    for (const a of frame.assemblies) expect(Boolean(a.tilt), a.id).toBe(a.motion === 'tilt')
  })

  it('lists members in beat order, each assembly contiguous', () => {
    const order = frame.assemblies.map((a) => a.id)
    const tilts = frame.assemblies.filter((a) => a.tilt).map((a) => a.id)
    const interior = order.filter((id) => id.startsWith('wall/') && !tilts.includes(id))
    const trusses = order.filter((id) => id.startsWith('truss/'))
    expect(order).toEqual([
      'plates',
      'floor',
      'foundation',
      'deck',
      ...tilts,
      ...interior,
      'caps',
      ...trusses,
      'rake/w',
      'rake/e',
      'porch',
    ])
    expect(trusses).toEqual([...trusses].sort())
    const batches = frame.assemblies.filter((a) => a.tilt).map((a) => a.tilt!.batch)
    expect(batches).toEqual([...batches].sort())
    let next = 0
    for (const a of frame.assemblies)
      for (const i of a.members) {
        expect(i).toBe(next)
        next++
      }
  })

  it('lists wall assemblies by (s, z)', () => {
    for (const a of frame.assemblies.filter((x) => x.id.startsWith('wall/'))) {
      const w = house.wall(a.id.slice(5))
      const keys = a.members.map((i) => [
        members[i].s!,
        (zSpan(members[i])[0] + zSpan(members[i])[1]) / 2,
      ])
      for (let k = 1; k < keys.length; k++)
        expect(
          keys[k][0] - keys[k - 1][0] || keys[k][1] - keys[k - 1][1],
          `${a.id} at ${k}`,
        ).toBeGreaterThanOrEqual(0)
      for (const i of a.members) expect(members[i].s).toBe(sMid(w, members[i]))
    }
  })

  it('stays on the 1/16″ grid where it is axis-aligned', () => {
    const axisAligned = (v: readonly number[]) => v.filter((x) => x !== 0).length === 1
    for (const m of members) {
      if (!axisAligned(m.u) || !axisAligned(m.v)) continue
      const step = isTruss(m) ? 32 : 16 // thinned truss ranks sit on 1/32″
      for (const x of aabb(m).flat()) expect(Number.isInteger(x * step), `${m.id}: ${x}`).toBe(true)
    }
  })

  it('reports its bounds and datums', () => {
    expect(frame.bounds).toEqual(boundsOf(members))
    for (const k of [
      'grade',
      'stemTop',
      'sillTop',
      'joistTop',
      'floor',
      'plate',
      'studTop',
      'heel',
      'ridge',
    ])
      expect(Number.isFinite(frame.datums[k]), k).toBe(true)
    expect(frame.datums.floor).toBe(0)
    expect(frame.datums.plate).toBe(spec.datums.plate)
    expect(frame.datums.grade).toBe(spec.datums.grade)
  })

  it('only touches, except at listed joints', () => {
    expect(ids(frame, interpenetrating(members, jointAllowed(members)))).toEqual([])
  })

  it('has no co-planar faces that would z-fight', () => {
    expect(ids(frame, faceClashes(members))).toEqual([])
  })

  it('cuts every member from stock', () => {
    for (const m of members) expect(m.size[0], m.id).toBeLessThanOrEqual(stockLength(m))
  })

  // ── Walls ─────────────────────────────────────────────────────────────────────────────────

  it('lays bottom plates exactly on the wall pieces, plus one under each window', () => {
    for (const w of house.walls) {
      const mine = byWall(w).filter((m) => m.kind === 'plate-bottom')
      w.pieces.forEach((p, i) => {
        const parts = mine.filter((m) => m.piece === i)
        expect(parts.length, `${w.spec.id} piece ${i}`).toBeGreaterThan(0)
        const area = parts.reduce((sum, m) => sum + rectArea(planRect(m)), 0)
        const inside = parts.reduce((sum, m) => sum + overlapArea(planRect(m), p), 0)
        expect(area).toBe(rectArea(p))
        expect(inside).toBe(area)
        for (const m of parts) expect(zSpan(m)).toEqual([z.floor, z.bottomPlateTop])
      })
      for (const o of w.openings) {
        const under = mine.filter((m) => m.opening === o.spec.id)
        if (o.spec.kind === 'door') expect(under, o.spec.id).toEqual([])
        else expect(under.map(planRect), o.spec.id).toEqual([o.cut])
      }
      expect(mine.every((m) => m.piece !== undefined || m.opening !== undefined)).toBe(true)
    }
    expect(
      members.filter((m) => m.kind === 'plate-bottom').every((m) => m.group === 'plates'),
    ).toBe(true)
  })

  it('stands studs on bottom plates and runs them up to the top plates; caps cover the top plates', () => {
    for (const w of house.walls) {
      const mine = byWall(w)
      const bottoms = mine.filter((m) => m.kind === 'plate-bottom').map((m) => sSpan(w, m))
      const tops = mine.filter((m) => m.kind === 'plate-top').map((m) => sSpan(w, m))
      expect(covered([w.s0, w.s1], tops), w.spec.id).toBe(true)
      for (const m of mine) {
        const zs = zSpan(m)
        const standing =
          ['stud', 'king', 'jack'].includes(m.kind) ||
          (m.kind === 'cripple' && zs[0] === z.bottomPlateTop)
        const reaching =
          ['stud', 'king'].includes(m.kind) || (m.kind === 'cripple' && zs[1] === z.studTop)
        if (standing) {
          expect(zs[0], m.id).toBe(z.bottomPlateTop)
          expect(covered(sSpan(w, m), bottoms), m.id).toBe(true)
        }
        if (reaching) {
          expect(zs[1], m.id).toBe(z.studTop)
          expect(covered(sSpan(w, m), tops), m.id).toBe(true)
        }
      }
    }
    const caps = members.filter((m) => m.kind === 'plate-cap').map(planRect)
    const tops = members.filter((m) => m.kind === 'plate-top').map(planRect)
    for (const t of tops) expect(caps.reduce((s, c) => s + overlapArea(c, t), 0)).toBe(rectArea(t))
    for (const c of caps) expect(tops.reduce((s, t) => s + overlapArea(c, t), 0)).toBe(rectArea(c))
  })

  it('frames each opening: jacks at the RO, kings at the jacks, header on the jacks', () => {
    for (const w of house.walls)
      for (const o of w.openings) {
        const mine = byWall(w).filter((m) => m.opening === o.spec.id)
        const span = (suffix: string) =>
          sSpan(
            w,
            mine.find((m) => m.id.endsWith(`/${suffix}`))!,
          )
        const nj = mine.filter((m) => m.kind === 'jack').length / 2
        expect(nj).toBe(w.spec.kind === 'exterior' && o.ro.w > 72 ? 2 : 1)
        for (let j = 1; j <= nj; j++) {
          expect(span(`jack-lo-${j}`)).toEqual([o.s0 - PLY * j, o.s0 - PLY * (j - 1)])
          expect(span(`jack-hi-${j}`)).toEqual([o.s1 + PLY * (j - 1), o.s1 + PLY * j])
        }
        expect(span('king-lo')[1]).toBe(o.s0 - PLY * nj)
        expect(span('king-hi')[0]).toBe(o.s1 + PLY * nj)
        for (const m of mine.filter((x) => x.kind === 'jack')) expect(zSpan(m)[1]).toBe(o.head)
        const headers = mine.filter((m) => m.kind === 'header')
        expect(headers.length).toBe(w.spec.kind === 'exterior' ? 2 : 1)
        for (const h of headers) {
          expect(zSpan(h)[0]).toBe(o.head)
          expect(sSpan(w, h)).toEqual([o.s0 - PLY * nj, o.s1 + PLY * nj])
        }
        const sills = mine.filter((m) => m.kind === 'rough-sill')
        if (o.spec.kind === 'window') {
          expect(sills.map((m) => zSpan(m)[1])).toEqual([o.sill])
          expect(sSpan(w, sills[0])).toEqual([o.s0, o.s1])
        } else expect(sills).toEqual([])
      }
  })

  it('lays common studs at 16″ from the building line (exterior) or s0 (interior)', () => {
    for (const w of house.walls) {
      const mine = byWall(w)
      const origin = w.spec.kind === 'exterior' ? fp[w.axis === 'x' ? 0 : 1] : w.s0
      const fixed = mine
        .filter(
          (m) =>
            m.kind === 'king' ||
            m.kind === 'jack' ||
            (m.kind === 'stud' && !/\/stud\/k\d+$/.test(m.id)),
        )
        .map((m) => sSpan(w, m))
      const common = new Set(mine.filter((m) => /\/stud\/k\d+$/.test(m.id)).map((m) => sMid(w, m)))
      const upper = new Set(
        mine
          .filter((m) => m.kind === 'cripple' && zSpan(m)[1] === z.studTop)
          .map((m) => sMid(w, m)),
      )
      for (const c of common)
        expect(Number.isInteger((c - origin) / w.asm.spacing), `${w.spec.id} ${c}`).toBe(true)
      for (let k = 1; origin + w.asm.spacing * k + PLY / 2 <= w.s1; k++) {
        const sc = origin + w.asm.spacing * k
        const s: Span = [sc - PLY / 2, sc + PLY / 2]
        if (s[0] < w.s0 || fixed.some((f) => f[0] < s[1] && s[0] < f[1])) {
          expect(common.has(sc), `${w.spec.id} slot ${sc}`).toBe(false)
          continue
        }
        const inRO = w.openings.some((o) => o.s0 <= s[0] && s[1] <= o.s1)
        expect((inRO ? upper : common).has(sc), `${w.spec.id} slot ${sc}`).toBe(true)
      }
    }
  })

  it('backs every wall that lands on another', () => {
    for (const w of house.walls) {
      const studs = byWall(w)
        .filter((m) => m.kind === 'stud')
        .map((m) => sSpan(w, m))
      for (const c of w.contacts)
        if (c.kind !== 'butt')
          for (const f of [c.s0, c.s1])
            expect(
              studs.some(([a, b]) => a <= f && f <= b),
              `${w.spec.id} at ${f}`,
            ).toBe(true)
    }
  })

  it('splices plates on stud centres, with top and cap joints 24″ apart (R602.3.2)', () => {
    for (const w of house.walls) {
      const mine = byWall(w)
      const centres = new Set(
        mine
          .filter((m) => ['stud', 'king', 'jack', 'cripple'].includes(m.kind))
          .map((m) => sMid(w, m)),
      )
      const joints = (list: Member[]) => {
        const spans = list.map((m) => sSpan(w, m)).sort((a, b) => a[0] - b[0])
        return spans.slice(1).map((s, i) => {
          expect(s[0], `${w.spec.id} plates abut`).toBe(spans[i][1])
          return s[0]
        })
      }
      const top = joints(mine.filter((m) => m.kind === 'plate-top'))
      for (const j of top) expect(centres.has(j), `${w.spec.id} top joint ${j}`).toBe(true)
      w.pieces.forEach((_, i) => {
        for (const j of joints(mine.filter((m) => m.piece === i)))
          expect(centres.has(j), `${w.spec.id} plate joint ${j}`).toBe(true)
      })
      const capEnds = mine.filter((m) => m.kind === 'plate-cap').flatMap((m) => sSpan(w, m))
      for (const j of top)
        for (const c of capEnds)
          expect(Math.abs(j - c), `${w.spec.id} ${j}/${c}`).toBeGreaterThanOrEqual(PLATE_LAP)
    }
  })

  it('laps one cap across the host at every butt joint', () => {
    const caps = members.filter((m) => m.kind === 'plate-cap')
    for (const b of house.walls)
      for (const c of b.contacts) {
        if (c.kind !== 'butt') continue
        const a = house.wall(c.wall)
        const hc = a.contacts.find((x) => x.wall === b.spec.id && x.kind !== 'butt')!
        const region = fromAxis(a.axis, [hc.s0, hc.s1], [a.t0, a.t1])
        const over = caps.filter((m) => overlapArea(planRect(m), region) > 0)
        expect(over.length, `${b.spec.id} on ${a.spec.id}`).toBe(1)
        expect(overlapArea(planRect(over[0]), region)).toBe(rectArea(region))
        const landing = a.contacts
          .filter((x) => x.kind !== 'butt' && x.s0 === hc.s0 && x.s1 === hc.s1)
          .map((x) => x.wall)
        expect(landing).toContain(over[0].wall)
      }
  })

  // ── Tilt-up ───────────────────────────────────────────────────────────────────────────────

  it('raises only the frame: no bottom plates or caps in a tilt assembly', () => {
    const { tilts, home } = tiltSets(frame)
    expect(tilts.map((a) => a.id).sort()).toEqual(
      house.walls
        .filter((w) => w.spec.kind === 'exterior')
        .map((w) => `wall/${w.spec.id}`)
        .sort(),
    )
    for (const a of tilts) {
      const kinds = new Set(home(a).map((m) => m.kind))
      expect(kinds.has('plate-bottom') || kinds.has('plate-cap')).toBe(false)
      expect(kinds.has('plate-top') && kinds.has('stud')).toBe(true)
    }
  })

  it('lays each flat frame above the deck, inside the footprint, clear of the other in its batch', () => {
    const { tilts, base, flat } = tiltSets(frame)
    for (const batch of [0, 1]) {
      const lying = tilts.filter((a) => a.tilt!.batch === batch)
      const standing = tilts
        .filter((a) => a.tilt!.batch < batch)
        .flatMap((a) => a.members.map((i) => members[i]))
      const boxes = [...base, ...standing, ...lying.flatMap(flat)]
      for (const b of lying.flatMap(flat))
        for (const p of corners(b)) {
          expect(p[2]).toBeGreaterThanOrEqual(z.bottomPlateTop - 1e-9)
          expect(
            p[0] >= fp[0] - 1e-9 &&
              p[0] <= fp[2] + 1e-9 &&
              p[1] >= fp[1] - 1e-9 &&
              p[1] <= fp[3] + 1e-9,
          ).toBe(true)
        }
      expect(interpenetrating(boxes, () => false).length, `batch ${batch}`).toBe(0)
      expect(faceClashes(boxes).length, `batch ${batch}`).toBe(0)
    }
  })

  it('never digs in or hits a standing wall while raising', () => {
    const { tilts, base, home, flat } = tiltSets(frame)
    tilts.forEach((a, i) => {
      const t: Tilt = a.tilt!
      const others = [
        ...base,
        ...tilts.slice(0, i).flatMap(home),
        ...tilts
          .slice(i + 1)
          .filter((b) => b.tilt!.batch === t.batch)
          .flatMap(flat),
      ]
      for (let deg = 0; deg <= 90; deg += 7.5) {
        const posed = home(a).map((m) => tiltPose(m, t, (deg * Math.PI) / 180))
        for (const b of posed)
          for (const p of corners(b))
            expect(p[2], `${a.id} at ${deg}°`).toBeGreaterThanOrEqual(z.bottomPlateTop - 1e-9)
        const n = posed.length
        const hits = interpenetrating([...posed, ...others], (p, q) => p < n && q < n)
        expect(hits.length, `${a.id} at ${deg}°`).toBe(0)
      }
    })
  })

  // ── Floor, deck, roof, porch ──────────────────────────────────────────────────────────────

  it('spans every joist bay within R502.3.1(2), bearing 1½″ or more', () => {
    const floor = frameFloor(house, z)
    for (const b of floor.bays) expect(b.clear, b.name).toBeLessThanOrEqual(JOIST.spanMax)
    const sills = members.filter((m) => m.kind === 'sill').map(planRect)
    for (const j of members.filter((m) => m.kind === 'joist')) {
      const r = planRect(j)
      const bearing = sills.reduce((s, q) => s + overlapArea(r, q), 0) / (r[2] - r[0])
      if (r[1] === fp[1] + PLY || r[3] === fp[3] - PLY)
        expect(bearing, j.id).toBeGreaterThanOrEqual(MIN_BEARING)
      if (/\/x\d+$/.test(j.id))
        expect(Number.isInteger((j.c[0] - fp[0]) / JOIST.spacing), j.id).toBe(true)
    }
  })

  it('keeps wood clear of crawlspace grade (R317.1) and the stem wall above grade (R404.1.6)', () => {
    const grade = spec.datums.grade
    for (const m of members) {
      const bottom = zSpan(m)[0]
      if (m.kind === 'joist' || m.kind === 'rim')
        expect(bottom - grade, m.id).toBeGreaterThanOrEqual(GRADE_CLEARANCE.joist)
      if (m.kind === 'girder')
        expect(bottom - grade, m.id).toBeGreaterThanOrEqual(GRADE_CLEARANCE.girder)
      if (m.kind === 'sill')
        expect(bottom - grade, m.id).toBeGreaterThanOrEqual(GRADE_CLEARANCE.sill)
      if (m.kind === 'stem-wall')
        expect(zSpan(m)[1] - grade, m.id).toBeGreaterThanOrEqual(STEM_ABOVE_GRADE)
      if (m.material === 'wood' && bottom < grade + GRADE_CLEARANCE.sill)
        expect(m.treated, m.id).toBe(true)
    }
  })

  it('decks the footprint exactly with staggered sheets, ends on joists, touching only the floor and plates', () => {
    const sheets = members.filter((m) => m.kind === 'subfloor')
    expect(sheets.reduce((s, m) => s + rectArea(planRect(m)), 0)).toBe(rectArea(fp))
    for (const [i, a] of sheets.entries()) {
      expect(zSpan(a)).toEqual([z.joistTop, z.floor])
      expect(overlapArea(planRect(a), fp)).toBe(rectArea(planRect(a)))
      for (const b of sheets.slice(i + 1)) expect(overlapArea(planRect(a), planRect(b))).toBe(0)
    }
    const joists = members.filter((m) => m.kind === 'joist').map(planRect)
    const bays = frameFloor(house, z).bays
    const rows = new Map<number, { yb: number; xs: number[] }>()
    for (const m of sheets) {
      const r = planRect(m)
      expect(r[2] - r[0]).toBeLessThanOrEqual(OSB.l)
      expect(r[3] - r[1]).toBeLessThanOrEqual(OSB.w)
      const row = rows.get(r[1]) ?? { yb: r[3], xs: [] }
      row.xs.push(r[0], r[2])
      rows.set(r[1], row)
    }
    const joints = [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ya, { yb, xs }]) => ({
        ya,
        yb,
        xs: [...new Set(xs)].filter((x) => x > fp[0] && x < fp[2]),
      }))
    for (const [r, { ya, yb, xs }] of joints.entries()) {
      for (const x of xs) {
        // Every 8′ end lands on a joist centre (16″ layout), in every bay the row crosses.
        expect(Number.isInteger((x - fp[0]) / JOIST.spacing), `row ${r} joint ${x}`).toBe(true)
        for (const b of bays.filter((q) => q.y0 < yb && ya < q.y1))
          expect(
            joists.some((j) => (j[0] + j[2]) / 2 === x && j[1] === b.y0),
            `row ${r} joint ${x} over bay ${b.name}`,
          ).toBe(true)
      }
      if (r > 0)
        for (const x of xs)
          expect(joints[r - 1].xs.includes(x), `row ${r} joint ${x} lines up`).toBe(false)
    }
    // What the deck touches: joist, rim and girder tops below, plate bottoms above, other sheets.
    for (const s of sheets) {
      const [lo, hi] = aabb(s)
      for (const m of members) {
        if (m === s) continue
        const [p, q] = aabb(m)
        if ([0, 1, 2].some((k) => p[k] > hi[k] + TOL || lo[k] > q[k] + TOL)) continue
        const ok =
          m.kind === 'subfloor' ||
          (['joist', 'rim', 'girder'].includes(m.kind) && q[2] === z.joistTop) ||
          (m.kind === 'plate-bottom' && p[2] === z.floor)
        expect(ok, `${s.id} touches ${m.id}`).toBe(true)
      }
    }
  })

  it('sets trusses at 24″ from the building line, gables flush, all bearing on the S and N caps', () => {
    const trusses = frame.assemblies.filter((a) => a.id.startsWith('truss/'))
    const caps = members.filter((m) => m.kind === 'plate-cap')
    const bearing = house.walls.filter((w) => w.spec.kind === 'exterior' && w.axis === 'x')
    expect(bearing.map((w) => sideOf(w, house)).sort()).toEqual(['n', 's'])
    trusses.forEach((a, i) => {
      const chords = a.members.map((k) => members[k]).filter((m) => m.id.includes('/bot-'))
      expect(chords.length).toBe(2)
      const r = planRect(chords[0])
      const x = (r[0] + r[2]) / 2
      if (i === 0) expect(r[0]).toBe(fp[0])
      else if (i === trusses.length - 1) expect(r[2]).toBe(fp[2])
      else expect(Number.isInteger((x - fp[0]) / spec.roof.main.spacing), a.id).toBe(true)
      for (const m of chords) expect(zSpan(m)[0]).toBe(spec.datums.plate)
      for (const w of bearing) {
        const seat: Rect = [r[0], w.t0, r[2], w.t1]
        const under = caps.filter((c) => zSpan(c)[1] === spec.datums.plate)
        expect(
          under.reduce((s, c) => s + overlapArea(planRect(c), seat), 0),
          `${a.id} on ${w.spec.id}`,
        ).toBe(rectArea(seat))
      }
    })
  })

  it('tucks the porch shed under the truss tails', () => {
    const rafters = members.filter((m) => m.kind === 'rafter')
    const tails = members.filter((m) => m.id.endsWith('/top-s'))
    expect(rafters.length).toBeGreaterThan(0)
    const rafterTop = Math.max(...rafters.flatMap((m) => corners(m).map((p) => p[2])))
    const tailBottom = Math.min(...tails.flatMap((m) => corners(m).map((p) => p[2])))
    expect(tailBottom - rafterTop).toBeGreaterThan(1.5)
    for (const m of members.filter((x) => x.kind === 'post')) expect(m.treated).toBe(true)
  })
})

describe('frameHouse: House No. 1', () => {
  const house = resolveHouse(HOUSE_NO_1)
  const frame = frameHouse(house)

  it('has the expected members', () => {
    const counts: Record<string, number> = {}
    for (const m of frame.members) counts[m.kind] = (counts[m.kind] ?? 0) + 1
    expect(counts).toEqual({
      'stem-wall': 4,
      pier: 11,
      sill: 10,
      rim: 10,
      girder: 13,
      joist: 76,
      subfloor: 52,
      'plate-bottom': 49,
      stud: 233,
      king: 42,
      jack: 44,
      header: 33,
      'rough-sill': 10,
      cripple: 97,
      'plate-top': 27,
      'plate-cap': 37,
      chord: 100,
      web: 92,
      'gable-stud': 46,
      barge: 4,
      lookout: 32,
      post: 4,
      beam: 2,
      ledger: 2,
      rafter: 14,
    })
    expect(frame.members.length).toBe(1044)
    expect(frame.members.filter((m) => m.material === 'concrete').length).toBe(15)
    expect(frame.assemblies.length).toBe(50)
  })

  it('reports the datums a builder would check', () => {
    const d = frame.datums
    expect([d.grade, d.stemTop, d.sillTop, d.joistTop, d.floor, d.studTop, d.plate]).toEqual([
      -30, -11.5, -10, -0.75, 0, 106.125, 109.125,
    ])
    expect(d.heelHeight).toBeCloseTo(7.413, 3)
    expect(d.heel).toBeCloseTo(116.538, 3)
    expect(d.ridge).toBeCloseTo(212.538, 3)
    expect(frame.bounds[0]).toEqual([-12, expect.closeTo(-84.667, 3), -30])
    expect(frame.bounds[1]).toEqual([588, expect.closeTo(396.783, 3), expect.closeTo(212.538, 3)])
  })

  it('lays its poché plates exactly where chapter 1 drew the poché', () => {
    const plan = planDrawing(house)
    const box = (pts: readonly (readonly [number, number])[]) => {
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].join(',')
    }
    const poche = plan.fills
      .filter((f) => f.kind === 'poche')
      .map((f) => `${plan.elements[f.el].id}:${box(f.poly)}`)
    // Union the plate members of each poché piece (only ext-n's long piece is spliced).
    const pieces = new Map<string, Member[]>()
    for (const m of frame.members)
      if (m.kind === 'plate-bottom' && m.piece !== undefined) {
        const key = `${m.wall}#${m.piece}`
        pieces.set(key, [...(pieces.get(key) ?? []), m])
      }
    const plates = [...pieces.values()].map((list) => {
      const pts = list.flatMap((m) => {
        const r = planRect(m)
        return [
          [r[0], r[1]],
          [r[2], r[3]],
        ] as [number, number][]
      })
      return `${list[0].wall}:${box(pts)}`
    })
    expect(plates.sort()).toEqual(poche.sort())
    expect(
      frame.members.filter((m) => m.kind === 'plate-bottom' && m.piece === undefined).length,
    ).toBe(10)
  })

  it('frames the floor as designed', () => {
    const floor = frameFloor(house, frameDatums(HOUSE_NO_1))
    expect(floor.girders).toEqual([192])
    expect(floor.bays.map((b) => [b.name, b.y0, b.y1, b.clear])).toEqual([
      ['s', 1.5, 189.75, 184.25],
      ['n', 194.25, 382.5, 184.25],
    ])
    const partition = frame.members.filter((m) => m.kind === 'joist' && !/\/x\d+$/.test(m.id))
    expect(partition.map((m) => [m.id, m.c[0]])).toEqual([
      ['joist/s/bed2-bed3', 156],
      ['joist/s/clo3-front', 184.5],
      ['joist/s/bed3-great', 312],
      ['joist/n/primary-e', 161.5],
      ['joist/n/wet', 247],
      ['joist/n/laundry-great', 312],
    ])
    const piers = frame.members.filter((m) => m.kind === 'pier' && m.group === 'foundation')
    expect(piers.map((m) => m.c[0])).toEqual([72, 144, 216, 288, 360, 432, 504])
  })

  it('frames in a few milliseconds', () => {
    frameHouse(house)
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) frameHouse(house)
    expect((performance.now() - t0) / 5).toBeLessThan(25)
  })
})
