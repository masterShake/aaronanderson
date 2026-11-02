import { describe, expect, it } from 'vitest'
import { mulberry32, outCubic } from '@/lib/framing/flight'
import { frameHouse } from '@/lib/framing/frame'
import { aabb, corners, flatPose, obbOverlap, tiltPose, type Box } from '@/lib/framing/geom3'
import {
  AI_SETTLE,
  BLOCKS,
  DISSOLVE,
  FLY,
  JITTER,
  PHASES,
  SHEET_GONE,
  TILT,
  TUMBLE,
  WALL_INK,
  wallsForward,
  type Win,
} from '@/lib/framing/script'
import {
  elementWindows,
  FLIGHT_STRIDE,
  MODE,
  planFraming,
  type PhaseId,
  type Schedule,
} from '@/lib/framing/schedule'
import type { Box3, Frame, FramePlan, Member, PoseOut } from '@/lib/framing/types'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import type { HouseSpec } from '@/lib/house/types'
import { planDrawing } from '@/lib/plan/drawing'

const house = resolveHouse(HOUSE_NO_1)
const frame = frameHouse(house)
const { members } = frame
const n = members.length
const { schedule: s, plan } = planFraming(frame, house)

const t0 = (i: number) => s.win[i * 2]
const t1 = (i: number) => s.win[i * 2 + 1]
const all = members.map((_, i) => i)
const homes = members.map((m) => aabb(m))
const keyframes = BLOCKS.map((b) => b.keyframe)
const DEG = Math.PI / 180
const MIN_AXIS = 1 / 64

const buffers = (): PoseOut => ({
  wood: {
    matrix: new Float32Array(plan.order.wood.length * 16),
    state: new Float32Array(plan.order.wood.length * 4),
  },
  concrete: {
    matrix: new Float32Array(plan.order.concrete.length * 16),
    state: new Float32Array(plan.order.concrete.length * 4),
  },
})
const poseAt = (p: number, out = buffers(), fp: FramePlan = plan) => ({
  out,
  counts: { ...fp.pose(p, out) },
})

/** A member's home as the column-major matrix the scene uploads. */
function homeMatrix(m: Member): number[] {
  const w = [
    m.u[1] * m.v[2] - m.u[2] * m.v[1],
    m.u[2] * m.v[0] - m.u[0] * m.v[2],
    m.u[0] * m.v[1] - m.u[1] * m.v[0],
  ]
  const col = (a: readonly number[], k: number) => [a[0] * k, a[1] * k, a[2] * k, 0]
  return [...col(m.u, m.size[0]), ...col(m.v, m.size[1]), ...col(w, m.size[2]), ...m.c, 1].map(
    Math.fround,
  )
}

const overlaps = (a: Box3, b: Box3, tol: number) =>
  [0, 1, 2].every((k) => a[0][k] < b[1][k] - tol && b[0][k] < a[1][k] - tol)
const inside = (a: Box3, b: Box3, tol = 1e-6) =>
  [0, 1, 2].every((k) => a[0][k] >= b[0][k] - tol && a[1][k] <= b[1][k] + tol)
const union = (bs: readonly Box3[]): Box3 => [
  [0, 1, 2].map((k) => Math.min(...bs.map((b) => b[0][k]))) as unknown as Box3[0],
  [0, 1, 2].map((k) => Math.max(...bs.map((b) => b[1][k]))) as unknown as Box3[1],
]
const planArea = (a: Box3, b: Box3) =>
  Math.max(0, Math.min(a[1][0], b[1][0]) - Math.max(a[0][0], b[0][0])) *
  Math.max(0, Math.min(a[1][1], b[1][1]) - Math.max(a[0][1], b[0][1]))
const meets = (a: Win, b: Win) => a[0] < b[1] && b[0] < a[1]
const groupOf = (i: number) => (s.group[i] >= 0 ? s.groups[s.group[i]] : null)
/** Settled for good: landed, its group done, its blue gone. */
const settledAt = (i: number) => Math.max(t1(i), groupOf(i)?.win[1] ?? 0) + AI_SETTLE
const boxAt = (i: number, p: number): Box => (p >= settledAt(i) ? members[i] : s.at(i, p).box)

const phaseKey = (i: number) => (s.phase[i] === 'walls' ? `walls:${members[i].group}` : s.phase[i])
const phaseIds = [...new Set(all.map(phaseKey))]

/** Most members in flight at once (trusses count as units), sampled every 0.0005. */
function peakInFlight(list: readonly number[], units: boolean): number {
  const lo = Math.min(...list.map(t0))
  const hi = Math.max(...list.map(t1))
  let peak = 0
  for (let p = lo; p <= hi; p += 0.0005) {
    const flying = list.filter((i) => t0(i) < p && p < t1(i))
    peak = Math.max(peak, units ? new Set(flying.map((i) => members[i].group)).size : flying.length)
  }
  return peak
}

/** The same frame with its members and assemblies in another order. */
function shuffled(f: Frame, seed: number): Frame {
  const rnd = mulberry32(seed)
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  const perm = shuffle(f.members.map((_, i) => i))
  const where = new Int32Array(perm.length)
  perm.forEach((old, i) => (where[old] = i))
  return {
    ...f,
    members: perm.map((old) => f.members[old]),
    assemblies: shuffle(
      f.assemblies.map((a) => ({ ...a, members: a.members.map((i) => where[i]) })),
    ),
  }
}

const perId = (f: Frame, sch: Schedule) =>
  new Map(
    f.members.map((m, i) => [
      m.id,
      {
        win: [sch.win[i * 2], sch.win[i * 2 + 1]],
        mode: sch.mode[i],
        phase: sch.phase[i],
        group: sch.group[i] >= 0 ? sch.groups[sch.group[i]].id : null,
        flight: [...sch.flight.subarray(i * FLIGHT_STRIDE, (i + 1) * FLIGHT_STRIDE)],
      },
    ]),
  )

describe('planFraming: House No. 1', () => {
  it('is deterministic, whatever order the members come in', () => {
    const again = planFraming(frameHouse(house), house).schedule
    expect(again.win).toEqual(s.win)
    expect(again.flight).toEqual(s.flight)
    expect(again.boxes).toEqual(s.boxes)
    const f2 = shuffled(frame, 1234)
    const s2 = planFraming(f2, house).schedule
    expect(perId(f2, s2)).toEqual(perId(frame, s))
    expect(s2.boxes).toEqual(s.boxes)
    expect([...s2.wallInk].sort()).toEqual([...s.wallInk].sort())
  })

  it('schedules every member inside its phase, without squeezing any', () => {
    const tiltBeat = (i: number) => {
      const side = members[i].group.slice('wall/ext-'.length)
      return TILT.find((t) => t.side === side)!
    }
    for (const i of all) {
      expect(t0(i), members[i].id).toBeGreaterThan(0)
      expect(t1(i)).toBeGreaterThan(t0(i))
      expect(t1(i)).toBeLessThanOrEqual(1)
      const win =
        s.phase[i] === 'walls' ? tiltBeat(i).frame : PHASES[s.phase[i] as keyof typeof PHASES]
      expect([s.phaseWin[i * 2], s.phaseWin[i * 2 + 1]]).toEqual(win)
      expect(t0(i), members[i].id).toBeGreaterThanOrEqual(win[0] - 1e-12)
      expect(t1(i), members[i].id).toBeLessThanOrEqual(win[1] + 1e-12)
    }
    for (const [id, f] of Object.entries(s.squeeze)) expect(f, id).toBe(1)
    expect(s.firstAt).toBe(Math.min(...all.map(t0)))
    expect(s.settledAt).toBe(Math.max(...all.map(settledAt)))
    expect(plan.firstAt).toBe(s.firstAt)
    expect(plan.settledAt).toBe(s.settledAt)
  })

  it('gives each member the motion its phase calls for', () => {
    const expected: Record<PhaseId, (m: Member) => number> = {
      morph: () => MODE.morph,
      floor: () => MODE.slide,
      pour: () => MODE.pour,
      deck: () => MODE.slide,
      walls: () => MODE.fly,
      caps: () => MODE.fly,
      interior: () => MODE.fly,
      trusses: () => MODE.ride,
      porch: (m) =>
        m.material === 'concrete' ? MODE.pour : m.kind === 'ledger' ? MODE.slide : MODE.fly,
    }
    for (const i of all) expect(s.mode[i], members[i].id).toBe(expected[s.phase[i]](members[i]))
    for (const m of members.filter((x) => x.kind === 'plate-bottom'))
      expect(s.phase[members.indexOf(m)]).toBe('morph')
    const tilts = new Set(frame.assemblies.filter((a) => a.tilt).map((a) => a.id))
    const units = new Set(frame.assemblies.filter((a) => a.motion === 'unit').map((a) => a.id))
    for (const i of all) {
      const g = groupOf(i)
      if (tilts.has(members[i].group)) expect(g?.kind).toBe('tilt')
      else if (units.has(members[i].group)) expect(g?.kind).toBe('unit')
      else expect(g).toBeNull()
    }
  })

  it('draws nothing at p = 0 and exactly the finished frame from settledAt on', () => {
    expect(poseAt(0).counts).toEqual({ wood: 0, concrete: 0 })
    expect(poseAt(s.firstAt).counts).toEqual({ wood: 0, concrete: 0 })
    expect(s.settledAt).toBeLessThan(1)
    for (const p of [s.settledAt, 1]) {
      const { out, counts } = poseAt(p)
      expect(counts).toEqual({ wood: plan.order.wood.length, concrete: plan.order.concrete.length })
      const off: string[] = []
      for (const material of ['wood', 'concrete'] as const)
        plan.order[material].forEach((m, j) => {
          const want = homeMatrix(members[m])
          const got = out[material].matrix
          const state = out[material].state
          if (want.some((x, k) => Math.abs(got[j * 16 + k] - x) > 1e-6)) off.push(members[m].id)
          if (state[j * 4] !== 1 || state[j * 4 + 1] !== 0 || state[j * 4 + 2] || state[j * 4 + 3])
            off.push(`${members[m].id} state`)
        })
      expect(off, `p = ${p}`).toEqual([])
    }
  })

  it('draws in start order: each mesh draws a prefix of its order', () => {
    for (const material of ['wood', 'concrete'] as const) {
      const order = [...plan.order[material]]
      expect(new Set(order).size).toBe(order.length)
      expect(order.every((i) => members[i].material === material)).toBe(true)
      for (let j = 1; j < order.length; j++) {
        const a = order[j - 1]
        const b = order[j]
        expect(t0(a) < t0(b) || (t0(a) === t0(b) && members[a].id < members[b].id)).toBe(true)
      }
    }
    expect(plan.order.wood.length + plan.order.concrete.length).toBe(n)
  })

  it('holds still at every keyframe: nothing in flight, nothing blue', () => {
    const windows: Win[] = [...all.map((i): Win => [t0(i), t1(i)]), ...s.groups.map((g) => g.win)]
    for (const k of keyframes)
      for (const w of windows) expect(w[0] < k && k < w[1], `${w} spans ${k}`).toBe(false)
    for (const k of keyframes) {
      const { out, counts } = poseAt(k)
      for (const material of ['wood', 'concrete'] as const)
        for (let j = 0; j < counts[material]; j++) {
          const m = plan.order[material][j]
          expect(
            [...out[material].state.subarray(j * 4, j * 4 + 4)],
            `${members[m].id} at ${k}`,
          ).toEqual([1, 0, 0, 0])
        }
    }
  })

  it('turns edges blue while placing, settling to wood over AI_SETTLE', () => {
    for (const i of [0, 120, 400, 700, 1000]) {
      const g = groupOf(i)
      const end = g?.kind === 'tilt' ? g.win[1] : t1(i)
      expect(s.at(i, (t0(i) + t1(i)) / 2).ai).toBe(1)
      expect(s.at(i, end + AI_SETTLE / 2).ai).toBeCloseTo(0.5, 6)
      expect(s.at(i, end + AI_SETTLE).ai).toBe(0)
    }
  })

  // ── Exterior walls ────────────────────────────────────────────────────────────────────────

  const tiltGroups = s.groups.filter((g) => g.kind === 'tilt')
  const tilts = frame.assemblies.filter((a) => a.tilt)
  const tiltOf = (id: string) => tilts.find((a) => a.id === id)!.tilt!
  const flatOf = (id: string) =>
    union(
      tiltGroups
        .find((g) => g.id === id)!
        .members.map((i) => aabb(flatPose(members[i], tiltOf(id)))),
    )
  const standingOf = (id: string) =>
    union(tiltGroups.find((g) => g.id === id)!.members.map((i) => homes[i]))
  const flatFrom = (id: string) => Math.min(...tiltGroups.find((g) => g.id === id)!.members.map(t0))

  it('keeps each frame still while its members fly in, and raises one wall at a time', () => {
    expect(tiltGroups.map((g) => g.id).sort()).toEqual(tilts.map((a) => a.id).sort())
    for (const g of tiltGroups) {
      expect(g.angle).toBe(Math.PI / 2)
      for (const i of g.members) expect(t1(i), members[i].id).toBeLessThanOrEqual(g.win[0])
    }
    for (let p = 0.29; p <= 0.56; p += 0.0005)
      expect(tiltGroups.filter((g) => g.win[0] < p && p < g.win[1]).length).toBeLessThanOrEqual(1)
  })

  it('lays every flat frame clear of the other flat frames and of standing or rising walls', () => {
    for (const a of tiltGroups)
      for (const b of tiltGroups) {
        if (a === b) continue
        const lying: Win = [flatFrom(a.id), a.win[0]]
        if (meets(lying, [flatFrom(b.id), b.win[0]]))
          expect(planArea(flatOf(a.id), flatOf(b.id)), `${a.id} / ${b.id} flat`).toBe(0)
        // While b swings up it sweeps everything between its flat frame and its rect.
        if (meets(lying, b.win))
          expect(
            planArea(flatOf(a.id), union([standingOf(b.id), flatOf(b.id)])),
            `${a.id} / ${b.id} rising`,
          ).toBe(0)
        if (meets(lying, [b.win[1], 2]))
          expect(planArea(flatOf(a.id), standingOf(b.id)), `${a.id} / ${b.id} standing`).toBe(0)
      }
  })

  it('never digs into the deck while a wall rises', () => {
    for (const g of tiltGroups) {
      let low = Infinity
      for (let q = 0; q <= 24; q++) {
        const p = g.win[0] + ((g.win[1] - g.win[0]) * q) / 24
        for (const i of g.members)
          for (const c of corners(s.at(i, p).box)) low = Math.min(low, c[2])
      }
      // And over the whole quarter turn, by the model's own hinge.
      for (let deg = 0; deg <= 90; deg += 5)
        for (const i of g.members)
          for (const c of corners(tiltPose(members[i], tiltOf(g.id), deg * DEG)))
            low = Math.min(low, c[2])
      expect(low, g.id).toBeGreaterThanOrEqual(-1e-6)
    }
  })

  it('lands each wall member in its flat frame, then stands it at home', () => {
    for (const g of tiltGroups)
      for (const i of g.members) {
        const landed = s.at(i, t1(i)).box
        const flat = flatPose(members[i], tiltOf(g.id))
        for (const k of [0, 1, 2]) {
          expect(landed.c[k]).toBeCloseTo(flat.c[k], 9)
          expect(landed.u[k]).toBeCloseTo(flat.u[k], 9)
          expect(landed.v[k]).toBeCloseTo(flat.v[k], 9)
        }
        const up = s.at(i, g.win[1]).box
        for (const k of [0, 1, 2]) expect(up.c[k]).toBeCloseTo(members[i].c[k], 9)
      }
  })

  // ── Sweeps and density ────────────────────────────────────────────────────────────────────

  it('sweeps in order: studs along each wall, joists across each bay, trusses west to east', () => {
    const monotone = (list: number[], key: (i: number) => number, what: string) => {
      const sorted = [...list].sort((a, b) => key(a) - key(b))
      for (let j = 1; j < sorted.length; j++)
        expect(t0(sorted[j]), `${what}: ${members[sorted[j]].id}`).toBeGreaterThanOrEqual(
          t0(sorted[j - 1]),
        )
    }
    for (const a of tilts) {
      const beat = TILT.find((t) => a.id.endsWith(`-${t.side}`))!
      const studs = a.members.filter((i) => members[i].kind === 'stud')
      monotone(studs, (i) => beat.sweep * members[i].s!, a.id)
    }
    for (const bay of ['s', 'n'])
      monotone(
        all.filter((i) => members[i].id.startsWith(`joist/${bay}/`)),
        (i) => members[i].c[0],
        `bay ${bay}`,
      )
    const trusses = s.groups.filter((g) => g.id.startsWith('truss/'))
    const x = (g: (typeof trusses)[number]) => members[g.members[0]].c[0]
    for (let j = 1; j < trusses.length; j++) {
      expect(x(trusses[j])).toBeGreaterThan(x(trusses[j - 1]))
      expect(trusses[j].win[0]).toBeGreaterThan(trusses[j - 1].win[0])
    }
    const start = (id: string) => s.groups.find((g) => g.id === id)!.win[0]
    expect(start('rake/w')).toBeGreaterThan(start('truss/01'))
    expect(start('rake/w')).toBeLessThan(start('truss/02'))
    expect(start('rake/e')).toBeGreaterThan(start('truss/25'))
    monotone(
      all.filter((i) => s.phase[i] === 'morph'),
      (i) => Math.hypot(members[i].c[0], members[i].c[1]),
      'plates',
    )
    // Back to front: by the nearest point of each stud along the 'walls' view.
    const [fx, fy] = wallsForward()
    const near = ([lo, hi]: Box3) => fx * (fx >= 0 ? lo[0] : hi[0]) + fy * (fy >= 0 ? lo[1] : hi[1])
    monotone(
      all.filter((i) => s.phase[i] === 'interior' && members[i].kind === 'stud'),
      (i) => -near(homes[i]),
      'interior studs, back to front',
    )
  })

  it('lands every member after what it rests on', () => {
    const touching = (a: Box3, b: Box3) => {
      let real = 0
      for (let k = 0; k < 3; k++) {
        const o = Math.min(a[1][k], b[1][k]) - Math.max(a[0][k], b[0][k])
        if (o < -1e-6) return false
        if (o > 1e-6) real++
      }
      return real >= 2
    }
    const pairs: [string, string][] = [
      ['joist', 'girder'],
      ['joist', 'rim'],
      ['joist', 'sill'],
      ['rim', 'sill'],
      ['header', 'jack'],
      ['jack', 'king'],
      ['cripple', 'header'],
      ['cripple', 'rough-sill'],
      ['plate-cap', 'plate-top'],
      ['post', 'pier'],
      ['beam', 'post'],
      ['rafter', 'beam'],
      ['rafter', 'ledger'],
    ]
    for (const [upper, lower] of pairs)
      for (const i of all.filter((j) => members[j].kind === upper))
        for (const j of all.filter((q) => members[q].kind === lower && s.phase[q] === s.phase[i]))
          if (touching(homes[i], homes[j]))
            expect(t1(i), `${members[i].id} on ${members[j].id}`).toBeGreaterThan(t1(j))
    // Interior studs stand before the top plate goes on them; in a flat frame the plate comes first.
    for (const i of all.filter((j) => members[j].kind === 'plate-top'))
      for (const j of all.filter(
        (q) => members[q].kind === 'stud' && members[q].wall === members[i].wall,
      ))
        if (touching(homes[i], homes[j]))
          if (s.phase[i] === 'interior') expect(t1(i)).toBeGreaterThan(t1(j))
          else expect(t1(j)).toBeGreaterThan(t1(i))
  })

  it('keeps 3–40 members in flight in every phase (trusses count as units)', () => {
    const peaks: Record<string, number> = {}
    for (const id of [...phaseIds, 'walls']) {
      const list = all.filter(
        (i) => phaseKey(i) === id || (id === 'walls' && s.phase[i] === 'walls'),
      )
      peaks[id] = peakInFlight(list, id === 'trusses')
    }
    for (const [id, peak] of Object.entries(peaks)) {
      expect(peak, id).toBeGreaterThanOrEqual(3)
      expect(peak, id).toBeLessThanOrEqual(40)
    }
  })

  // ── Flights ───────────────────────────────────────────────────────────────────────────────

  const flyers = all.filter((i) => s.mode[i] === MODE.fly)
  const landingOf = (i: number): Box => {
    const g = groupOf(i)
    return g?.kind === 'tilt' ? flatPose(members[i], tiltOf(g.id)) : members[i]
  }

  it('lands each flight exactly, coming straight down at rest', () => {
    for (const i of flyers) {
      const want = landingOf(i)
      const got = s.at(i, t1(i)).box
      for (const k of [0, 1, 2]) expect(got.c[k]).toBeCloseTo(want.c[k], 9)
      const dur = t1(i) - t0(i)
      const eps = 1e-4
      const before = s.at(i, t1(i) - eps * dur).box
      const vz = (got.c[2] - before.c[2]) / eps
      const vh = Math.hypot(got.c[0] - before.c[0], got.c[1] - before.c[1]) / eps
      expect(Math.abs(vz), members[i].id).toBeLessThan(0.1)
      expect(vh, members[i].id).toBeLessThan(0.01)
      // Mid-flight it is still coming down.
      const mid = s.at(i, t0(i) + 0.5 * dur).box
      const later = s.at(i, t0(i) + (0.5 + eps) * dur).box
      expect(later.c[2]).toBeLessThan(mid.c[2])
    }
  })

  it('seeds each flight from its id: up and upstream, tumbling across the grain, capped', () => {
    for (const i of flyers) {
      const m = members[i]
      const f = s.flight.subarray(i * FLIGHT_STRIDE, (i + 1) * FLIGHT_STRIDE)
      const ph = s.phase[i] as keyof typeof FLY
      const plate = m.kind === 'plate-top' || m.kind === 'plate-cap'
      const base = plate ? FLY[ph].plateRise : FLY[ph].rise
      expect(f[2], m.id).toBeGreaterThanOrEqual(base * JITTER.rise[0] - 1e-9)
      expect(f[2], m.id).toBeLessThanOrEqual(base * JITTER.rise[1] + 1e-9)
      expect(Math.hypot(f[0], f[1]), m.id).toBeLessThanOrEqual(
        FLY[ph].drift * JITTER.drift[1] + 1e-9,
      )
      const axis = [f[3], f[4], f[5]]
      const u = landingOf(i).u
      expect(Math.hypot(...axis)).toBeCloseTo(1, 12)
      expect(Math.abs(axis[0] * u[0] + axis[1] * u[1] + axis[2] * u[2]), m.id).toBeLessThan(1e-9)
      expect(Math.abs(f[6]), m.id).toBeLessThanOrEqual(
        Math.min(TUMBLE.max * DEG, TUMBLE.reach / m.size[0]) + 1e-12,
      )
      expect(f[7]).toBe(0)
    }
    // Most flights keep their full seeded drift; the rest were eased off what already stands.
    const drifting = flyers.filter(
      (i) => Math.hypot(s.flight[i * FLIGHT_STRIDE], s.flight[i * FLIGHT_STRIDE + 1]) > 0,
    )
    expect(drifting.length / flyers.length).toBeGreaterThan(0.85)
  })

  it('flies clear of walls already standing and of the trusses over the porch', () => {
    const wallMember = (j: number) => members[j].group.startsWith('wall/')
    const truss = (j: number) => groupOf(j)?.kind === 'unit'
    for (const i of flyers) {
      const m = members[i]
      const ph = s.phase[i]
      if (ph === 'caps' || (ph === 'walls' && !/ext-[we]$/.test(m.group))) continue
      const own = `wall/${m.wall}`
      const candidates = all.filter(
        (j) =>
          j !== i &&
          members[j].group !== own &&
          t1(j) <= t0(i) &&
          settledAt(j) <= t0(i) &&
          (ph === 'porch' ? truss(j) || wallMember(j) : wallMember(j)),
      )
      for (const k of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
        const box = s.at(i, t0(i) + k * (t1(i) - t0(i))).box
        const bb = aabb(box)
        for (const j of candidates)
          if (overlaps(bb, homes[j], 1 / 16))
            expect(
              obbOverlap(box, members[j]),
              `${m.id} × ${members[j].id} at k ${k}`,
            ).toBeLessThanOrEqual(1 / 16 + 1e-9)
      }
    }
  })

  it('nests trusses in flight without crossing', () => {
    const units = all.filter((i) => groupOf(i)?.kind === 'unit')
    const [lo, hi] = PHASES.trusses
    for (let q = 0; q <= 48; q++) {
      const p = lo + ((hi - lo) * q) / 48
      const drawn = units.filter((i) => t0(i) < p).map((i) => ({ i, box: boxAt(i, p) }))
      const bbs = drawn.map((d) => aabb(d.box))
      for (let a = 0; a < drawn.length; a++)
        for (let b = a + 1; b < drawn.length; b++) {
          if (members[drawn[a].i].group === members[drawn[b].i].group) continue
          if (!overlaps(bbs[a], bbs[b], MIN_AXIS)) continue
          expect(
            obbOverlap(drawn[a].box, drawn[b].box),
            `${members[drawn[a].i].id} × ${members[drawn[b].i].id} at ${p}`,
          ).toBeLessThanOrEqual(MIN_AXIS)
        }
    }
  })

  // ── Slides and pours ──────────────────────────────────────────────────────────────────────

  const slides = all.filter((i) => s.mode[i] === MODE.slide)
  const samples = (list: readonly number[], steps: number) => {
    const lo = Math.min(...list.map(t0))
    const hi = Math.max(...list.map(t1))
    return Array.from({ length: steps + 1 }, (_, q) => lo + ((hi - lo) * q) / steps)
  }

  it('slides in at the final height, turning only about z, never through a placed plate', () => {
    for (const i of slides) {
      const m = members[i]
      for (const k of [0, 0.3, 0.7]) {
        const box = s.at(i, t0(i) + k * (t1(i) - t0(i))).box
        expect(box.c[2], m.id).toBeCloseTo(m.c[2], 12)
        const tilt = Math.acos(
          Math.min(
            1,
            Math.abs(
              box.u[2] * m.u[2] + box.v[2] * m.v[2] + (1 - Math.abs(m.u[2]) - Math.abs(m.v[2])),
            ),
          ),
        )
        expect(tilt).toBeLessThan(1e-9)
        const yaw = Math.atan2(
          box.u[0] * m.u[1] - box.u[1] * m.u[0],
          box.u[0] * m.u[0] + box.u[1] * m.u[1],
        )
        expect(Math.abs(yaw)).toBeLessThanOrEqual(8 * DEG + 1e-12)
      }
    }
    const plates = all.filter((i) => members[i].kind === 'plate-bottom')
    for (const p of samples(slides, 400))
      for (const i of slides.filter((j) => t0(j) < p && p < t1(j))) {
        const bb = aabb(s.at(i, p).box)
        for (const j of plates)
          if (t1(j) <= p)
            expect(overlaps(bb, homes[j], 1e-6), `${members[i].id} under ${members[j].id}`).toBe(
              false,
            )
      }
  })

  it('never slides one member through another, placed or sliding', () => {
    for (const ph of ['floor', 'deck', 'porch'] as const) {
      const mine = slides.filter((i) => s.phase[i] === ph)
      for (const p of samples(mine, 120)) {
        const drawn = all.filter((j) => t0(j) < p).map((j) => ({ j, box: boxAt(j, p) }))
        const bbs = new Map(drawn.map((d) => [d.j, aabb(d.box)]))
        for (const i of mine.filter((q) => t0(q) < p && p < t1(q))) {
          const box = boxAt(i, p)
          const bb = bbs.get(i)!
          for (const d of drawn) {
            if (d.j === i || !overlaps(bb, bbs.get(d.j)!, MIN_AXIS)) continue
            // Porch rafters seat on the ledger: that joint is listed in the model.
            if (members[d.j].kind === 'rafter' && members[i].kind === 'ledger') continue
            expect(
              obbOverlap(box, d.box),
              `${members[i].id} × ${members[d.j].id} at ${p}`,
            ).toBeLessThanOrEqual(MIN_AXIS)
          }
        }
      }
    }
  })

  it('pours concrete up from its bottom face', () => {
    for (const i of all.filter((j) => members[j].material === 'concrete')) {
      const m = members[i]
      const H = m.size[m.u[2] !== 0 ? 0 : m.v[2] !== 0 ? 1 : 2]
      for (const k of [0, 0.01, 0.25, 0.5, 0.9, 1]) {
        const { box, alpha } = s.at(i, t0(i) + k * (t1(i) - t0(i)))
        const [lo, hi] = aabb(box)
        expect(lo[2], m.id).toBeCloseTo(homes[i][0][2], 9)
        expect(hi[2] - lo[2]).toBeCloseTo(Math.max(outCubic(k) * H, MIN_AXIS), 9)
        expect(alpha).toBe(k > 0 ? 1 : 0)
      }
      expect(homes[i][0][2]).toBe(frame.datums.grade)
    }
  })

  // ── The sheet ─────────────────────────────────────────────────────────────────────────────

  it('retires each wall’s ink once its last plate is wood, and every dissolve before the sheet goes', () => {
    const drawing = planDrawing(house)
    const wins = elementWindows(drawing, s)
    expect(wins.length).toBe(drawing.elements.length * 2)
    drawing.elements.forEach((e, k) => {
      const [w0, w1] = [wins[k * 2], wins[k * 2 + 1]]
      expect(w1).toBeLessThanOrEqual(SHEET_GONE)
      if (e.kind === 'wall') {
        const plates = all.filter(
          (i) => members[i].kind === 'plate-bottom' && members[i].wall === e.id,
        )
        expect(plates.length).toBeGreaterThan(0)
        expect(w0).toBe(Math.fround(Math.max(...plates.map(t1))))
        expect(w1).toBeCloseTo(w0 + WALL_INK, 6)
      } else {
        const d = DISSOLVE.find((x) => x.kinds.includes(e.kind))!
        expect([w0, w1]).toEqual(d.win.map(Math.fround))
      }
    })
  })

  // ── Framing ───────────────────────────────────────────────────────────────────────────────

  it('frames every flight start in its shot’s box', () => {
    expect(s.boxes.hero).toEqual(frame.bounds)
    expect(inside(s.boxes.deck, s.boxes.walls)).toBe(true)
    expect(inside(s.boxes.hero, s.boxes.roof)).toBe(true)
    const startBox = (i: number) => aabb(s.at(i, t0(i)).box)
    for (const i of all) {
      const ph = s.phase[i]
      if (ph !== 'trusses' && ph !== 'porch')
        expect(inside(homes[i], s.boxes.deck), members[i].id).toBe(true)
      if (s.mode[i] === MODE.morph || s.mode[i] === MODE.pour) continue
      if (ph === 'floor' || ph === 'deck' || ph === 'walls')
        expect(inside(startBox(i), s.boxes.deck), members[i].id).toBe(true)
      if (ph === 'interior' || ph === 'caps')
        expect(inside(startBox(i), s.boxes.walls), members[i].id).toBe(true)
      if (ph === 'porch') expect(inside(startBox(i), s.boxes.roof), members[i].id).toBe(true)
    }
    for (const g of s.groups.filter((x) => x.kind === 'unit'))
      for (let q = 0; q <= 10; q++)
        for (const i of g.members)
          expect(
            inside(aabb(s.at(i, g.win[0] + ((g.win[1] - g.win[0]) * q) / 10).box), s.boxes.roof),
          ).toBe(true)
  })

  // ── The pose buffers ──────────────────────────────────────────────────────────────────────

  it('writes valid instances at every progress, drawing ever more of them', () => {
    let last = { wood: 0, concrete: 0 }
    const out = buffers()
    const bad: string[] = []
    for (let p = 0; p <= 1.0001; p += 0.0025) {
      const { counts } = poseAt(p, out)
      if (counts.wood < last.wood || counts.concrete < last.concrete)
        bad.push(`count falls at ${p}`)
      last = counts
      for (const material of ['wood', 'concrete'] as const) {
        const { matrix: M, state: S } = out[material]
        for (let j = 0; j < counts[material]; j++) {
          const a = S[j * 4]
          const o = j * 16
          const lengths = [0, 4, 8].map((c) => Math.hypot(M[o + c], M[o + c + 1], M[o + c + 2]))
          const ok =
            a >= 0 &&
            a <= 1 &&
            S[j * 4 + 1] >= 0 &&
            S[j * 4 + 1] <= 1 &&
            S[j * 4 + 2] === 0 &&
            S[j * 4 + 3] === 0 &&
            M[o + 3] === 0 &&
            M[o + 7] === 0 &&
            M[o + 11] === 0 &&
            M[o + 15] === 1 &&
            lengths.every((l) => (a > 0 ? l >= MIN_AXIS * 0.999 : l === 0)) &&
            [12, 13, 14].every((k) => Number.isFinite(M[o + k]))
          if (!ok) bad.push(`${members[plan.order[material][j]].id} at ${p}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('poses purely: any earlier call leaves no trace', () => {
    const rnd = mulberry32(99)
    const reused = buffers()
    const same = (a: Float32Array, b: Float32Array, len: number) => {
      for (let k = 0; k < len; k++) if (!Object.is(a[k], b[k])) return false
      return true
    }
    for (let q = 0; q < 24; q++) {
      const a = rnd()
      const b = q % 4 === 0 ? keyframes[q % keyframes.length] : rnd()
      poseAt(a, reused)
      const got = poseAt(b, reused)
      const fresh = poseAt(b)
      expect(got.counts).toEqual(fresh.counts)
      for (const material of ['wood', 'concrete'] as const) {
        const c = fresh.counts[material]
        expect(
          same(got.out[material].matrix, fresh.out[material].matrix, c * 16),
          `${a} → ${b}`,
        ).toBe(true)
        expect(same(got.out[material].state, fresh.out[material].state, c * 4), `${a} → ${b}`).toBe(
          true,
        )
      }
    }
  })

  it('poses a frame in well under a millisecond', () => {
    const out = buffers()
    for (let p = 0; p <= 1; p += 0.01) plan.pose(p, out)
    const start = performance.now()
    let calls = 0
    for (let p = 0.3; p <= 0.9; p += 0.001, calls++) plan.pose(p, out)
    expect((performance.now() - start) / calls).toBeLessThan(1)
  })
})

/** The model tests' 24′×20′ house: one room, one door, one window, a small porch, the same roof rules. */
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

describe('planFraming: the 24′×20′ test house', () => {
  const small = resolveHouse(SMALL)
  const f = frameHouse(small)
  const { schedule: q, plan: qp } = planFraming(f, small)
  const ids = f.members.map((_, i) => i)
  const w0 = (i: number) => q.win[i * 2]
  const w1 = (i: number) => q.win[i * 2 + 1]

  it('schedules every member inside its window, clear of every keyframe', () => {
    for (const i of ids) {
      expect(w0(i), f.members[i].id).toBeGreaterThanOrEqual(q.phaseWin[i * 2] - 1e-12)
      expect(w1(i), f.members[i].id).toBeLessThanOrEqual(q.phaseWin[i * 2 + 1] + 1e-12)
      for (const k of keyframes) expect(w0(i) < k && k < w1(i)).toBe(false)
    }
    for (const g of q.groups)
      for (const k of keyframes) expect(g.win[0] < k && k < g.win[1]).toBe(false)
    for (const g of q.groups.filter((x) => x.kind === 'tilt'))
      for (const i of g.members) expect(w1(i)).toBeLessThanOrEqual(g.win[0])
    expect(perId(shuffled(f, 7), planFraming(shuffled(f, 7), small).schedule)).toEqual(perId(f, q))
  })

  it('ends on the finished frame, with nothing in flight at any keyframe', () => {
    const out: PoseOut = {
      wood: {
        matrix: new Float32Array(qp.order.wood.length * 16),
        state: new Float32Array(qp.order.wood.length * 4),
      },
      concrete: {
        matrix: new Float32Array(qp.order.concrete.length * 16),
        state: new Float32Array(qp.order.concrete.length * 4),
      },
    }
    for (const k of keyframes) {
      const counts = qp.pose(k, out)
      for (const material of ['wood', 'concrete'] as const)
        for (let j = 0; j < counts[material]; j++) expect(out[material].state[j * 4 + 1]).toBe(0)
    }
    const counts = qp.pose(1, out)
    expect(counts.wood + counts.concrete).toBe(f.members.length)
    const off = [...qp.order.wood].filter((m, j) =>
      homeMatrix(f.members[m]).some((x, k) => Math.abs(out.wood.matrix[j * 16 + k] - x) > 1e-6),
    )
    expect(off).toEqual([])
    for (const id of phaseIds.filter((p) => p !== 'interior'))
      if (q.phase.includes(id as PhaseId))
        expect(
          peakInFlightOf(
            q,
            f,
            ids.filter((i) => q.phase[i] === id),
            id === 'trusses',
          ),
        ).toBeLessThanOrEqual(40)
  })
})

function peakInFlightOf(sch: Schedule, f: Frame, list: readonly number[], units: boolean): number {
  let peak = 0
  for (let p = 0; p <= 1; p += 0.0005) {
    const flying = list.filter((i) => sch.win[i * 2] < p && p < sch.win[i * 2 + 1])
    peak = Math.max(
      peak,
      units ? new Set(flying.map((i) => f.members[i].group)).size : flying.length,
    )
  }
  return peak
}
