/**
 * planFraming(frame, house): when and how every member of the frame arrives, and the pose function
 * the scene calls each frame. Each member gets one window [t0, t1] in chapter progress and one
 * motion:
 * - morph: bottom plates fade in over the poché without moving;
 * - slide: floor members, deck sheets and the porch ledger travel in horizontally at their final
 *   height, in lanes ordered so that nothing slides through a member already there;
 * - fly: from a seeded start above and upstream, on an arc that ends in a vertical set-down, turning
 *   into line (outBack settle) as it fades in;
 * - pour: concrete grows up from its bottom face;
 * - ride: a truss or rake ladder flies as one rigid unit, rolling up from lying flat.
 * Exterior wall members fly into their wall's flat frame, then ride the frame as it swings up.
 *
 * Windows come from sweeps (script.ts): a phase's members are ordered by a key and offset by a lag
 * per kind, then pushed later where needed, so a member never lands before what it rests on and a
 * slide never passes through a member already placed. Everything derives from member ids and
 * geometry: shuffling the input changes nothing.
 */
import { sideOf } from '@/lib/framing/floor'
import {
  applyInto,
  clamp01,
  inOutCubic,
  inOutSine,
  outBack,
  outCubic,
  rngFor,
  rotationInto,
  smoothstep,
} from '@/lib/framing/flight'
import { aabb, flatPose, obbOverlap, type Box } from '@/lib/framing/geom3'
import {
  AI_SETTLE,
  BACK,
  DISSOLVE,
  DUR,
  FADE_IN,
  FLOOR_LAG,
  FLY,
  JITTER,
  LAG,
  PASS,
  PHASES,
  PORCH_LAG,
  SLIDE,
  STEM_STAGGER,
  TILT,
  TUMBLE,
  UNIT_START,
  WALL_INK,
  wallsForward,
  type ShotId,
  type Side,
  type TiltBeat,
  type Win,
} from '@/lib/framing/script'
import type {
  Assembly,
  Box3,
  Frame,
  FramePlan,
  Member,
  MemberKind,
  PoseCounts,
  PoseOut,
  PoseTarget,
  Vec3,
} from '@/lib/framing/types'
import { cross, dot, len, norm, X, Y, Z } from '@/lib/framing/vec3'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { ElementKind, PlanDrawing } from '@/lib/plan/types'

export const MODE = { morph: 0, slide: 1, fly: 2, pour: 3, ride: 4 } as const
export type Mode = (typeof MODE)[keyof typeof MODE]

export type PhaseId =
  'morph' | 'floor' | 'pour' | 'deck' | 'walls' | 'caps' | 'interior' | 'trusses' | 'porch'

/** An assembly that moves as one: an exterior wall's frame swinging up, or a truss in flight. */
export interface GroupMotion {
  id: string
  kind: 'tilt' | 'unit'
  /** A point on the turning axis and the unit axis (right-handed), plan inches. */
  pivot: Vec3
  axis: Vec3
  /** The angle about `axis` before the motion: π/2 lays a wall flat, ±π/2 a truss on its side. */
  angle: number
  /** Where a unit starts relative to home (east or outward, and up). Zero for a tilt. */
  offset: Vec3
  /** outBack overshoot of a unit's roll (0 is a plain outCubic). A tilt eases inOutCubic. */
  back: number
  /** tilt: the raise. unit: the flight. */
  win: Win
  members: readonly number[]
}

/** Numbers per member in Schedule.flight: drift x, drift y, rise, tumble axis xyz, tumble angle, yaw. */
export const FLIGHT_STRIDE = 8

export interface PosedMember {
  box: Box
  alpha: number
  ai: number
}

export interface Schedule {
  /** [t0, t1] per member. */
  win: Float64Array
  /** The window each member was swept in: its phase, or its wall's TILT frame. */
  phaseWin: Float64Array
  mode: Uint8Array
  phase: readonly PhaseId[]
  /** Index into groups, or −1. */
  group: Int16Array
  groups: readonly GroupMotion[]
  flight: Float64Array
  /** Camera envelopes (plan inches): homes plus the flight starts each shot must keep in frame. */
  boxes: Readonly<Record<ShotId, Box3>>
  /** Wall id → when its last bottom plate is opaque, so its ink can retire. */
  wallInk: ReadonlyMap<string, number>
  /** Per swept window (phase, or 'walls:<side>'): 1, or how far it had to be squeezed to fit. */
  squeeze: Readonly<Record<string, number>>
  firstAt: number
  settledAt: number
  /** One member at progress p, with its box rebuilt (allocates: for tests, debug and framing). */
  at(i: number, p: number): PosedMember
}

const HALF_PI = Math.PI / 2
const DEG = Math.PI / 180
const MIN_AXIS = 1 / 64
const TOUCH = 1e-6
/** A member lands at least this long after what it rests on. */
const DEP_GAP = 0.002
/** Flight progress sampled for clearance (alpha is under 0.08 before 0.1). */
const CLEAR_K = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
/** Overlap this small is invisible, so a flight may graze an obstacle by it. */
const CLEAR_TOL = 1 / 16
/** [drift, tumble] scales tried in turn until a flight clears what already stands. */
const CLEAR_TRIES: readonly (readonly [number, number])[] = [
  [1, 1],
  [0.5, 0.5],
  [0.25, 0.25],
  [0, 1],
  [0, 0.5],
  [0, 0],
]

/** Wall frames build top plate first; interior walls stand studs first, then plates and caps. */
const WALL_RANK: Readonly<Partial<Record<MemberKind, number>>> = {
  'plate-top': 0,
  stud: 1,
  king: 1,
  jack: 2,
  'rough-sill': 3,
  header: 4,
  cripple: 5,
  'plate-cap': 7,
}
const INTERIOR_RANK: Readonly<Partial<Record<MemberKind, number>>> = {
  ...WALL_RANK,
  'plate-top': 6,
}
const PORCH_RANK: Readonly<Partial<Record<MemberKind, number>>> = {
  pier: 0,
  post: 1,
  beam: 2,
  ledger: 2,
  rafter: 3,
}

interface Slot {
  i: number
  key: number
  dur: number
  lag: number
  rank: number
}

interface Obstacle {
  box: Box
  bb: Box3
}

/** One material's members in draw order (ascending start), with their starts for the prefix search. */
interface DrawList {
  ids: Int32Array
  starts: Float64Array
}

const byId = (members: readonly Member[]) => (a: number, b: number) =>
  members[a].id < members[b].id ? -1 : members[a].id > members[b].id ? 1 : 0

const boxOf = ([lo, hi]: Box3): Box => ({
  c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  u: X,
  v: Y,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
})

function union(boxes: Iterable<Box3>): Box3 {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const [l, h] of boxes)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], l[k])
      hi[k] = Math.max(hi[k], h[k])
    }
  return [
    [lo[0], lo[1], lo[2]],
    [hi[0], hi[1], hi[2]],
  ]
}

/** Overlap of two boxes on every axis by more than tol. */
const overlaps = (a: Box3, b: Box3, tol: number) =>
  a[0][0] < b[1][0] - tol &&
  b[0][0] < a[1][0] - tol &&
  a[0][1] < b[1][1] - tol &&
  b[0][1] < a[1][1] - tol &&
  a[0][2] < b[1][2] - tol &&
  b[0][2] < a[1][2] - tol

/** Face contact or interpenetration: no gap on any axis, real overlap on at least two. */
function contact(a: Box3, b: Box3): boolean {
  let real = 0
  for (let k = 0; k < 3; k++) {
    const o = Math.min(a[1][k], b[1][k]) - Math.max(a[0][k], b[0][k])
    if (o < -TOUCH) return false
    if (o > TOUCH) real++
  }
  return real >= 2
}

/** Plan distance from (ox, oy) to the nearest point of a box. */
function nearest([lo, hi]: Box3, ox: number, oy: number): number {
  const dx = Math.max(lo[0] - ox, 0, ox - hi[0])
  const dy = Math.max(lo[1] - oy, 0, oy - hi[1])
  return Math.hypot(dx, dy)
}

const busy = (a: number, b: number, p: number): number =>
  p < a ? 0 : p <= b ? 1 : 1 - smoothstep(b, b + AI_SETTLE, p)

const isVertical = (m: Member) => Math.abs(m.u[2]) > 0.5

export function planFraming(
  frame: Frame,
  house: ResolvedHouse,
): { schedule: Schedule; plan: FramePlan } {
  const { members, assemblies } = frame
  const n = members.length
  const fp = house.spec.footprint
  const [ox, oy] = [fp[0], fp[1]]
  const mid: Vec3 = [(fp[0] + fp[2]) / 2, (fp[1] + fp[3]) / 2, 0]
  const home = members.map((m) => aabb(m))
  const idOrder = byId(members)

  const t0 = new Float64Array(n)
  const t1 = new Float64Array(n)
  const phaseWin = new Float64Array(n * 2)
  const mode = new Uint8Array(n)
  const phase = new Array<PhaseId>(n)
  const groupOf = new Int16Array(n).fill(-1)
  const FL = new Float64Array(n * FLIGHT_STRIDE)
  const squeeze: Record<string, number> = {}

  // ── Home boxes as matrix columns (u·L, v·W, w·H) and centre; the vertical column for pours. ──
  const HOME = new Float64Array(n * 12)
  const HOME32 = new Float32Array(n * 16)
  const POUR = new Int8Array(n).fill(-1)
  members.forEach((m, i) => {
    const w = cross(m.u, m.v)
    const axes = [m.u, m.v, w]
    for (let j = 0; j < 3; j++)
      for (let a = 0; a < 3; a++) {
        HOME[i * 12 + j * 3 + a] = axes[j][a] * m.size[j]
        HOME32[i * 16 + j * 4 + a] = axes[j][a] * m.size[j]
      }
    for (let a = 0; a < 3; a++) {
      HOME[i * 12 + 9 + a] = m.c[a]
      HOME32[i * 16 + 12 + a] = m.c[a]
    }
    HOME32[i * 16 + 15] = 1
    if (m.material === 'concrete') POUR[i] = axes.findIndex((x) => Math.abs(x[2]) > 0.5)
  })

  // ── Phases and motions ────────────────────────────────────────────────────────────────────
  const exteriorWall = (id: string) => house.wall(id).spec.kind === 'exterior'
  const phaseOf = (m: Member, a: Assembly): PhaseId => {
    if (a.id === 'plates') return 'morph'
    if (a.id === 'floor') return 'floor'
    if (a.id === 'foundation') return 'pour'
    if (a.id === 'deck') return 'deck'
    if (a.id === 'porch') return 'porch'
    if (a.motion === 'tilt') return 'walls'
    if (a.motion === 'unit') return 'trusses'
    if (a.id === 'caps') return exteriorWall(m.wall!) ? 'caps' : 'interior'
    if (a.id.startsWith('wall/')) return 'interior'
    throw new Error(`No framing phase for assembly ${a.id}`)
  }
  for (const a of assemblies)
    for (const i of a.members) {
      const m = members[i]
      const ph = phaseOf(m, a)
      phase[i] = ph
      mode[i] =
        ph === 'morph'
          ? MODE.morph
          : ph === 'floor' || ph === 'deck' || m.kind === 'ledger'
            ? MODE.slide
            : m.material === 'concrete'
              ? MODE.pour
              : ph === 'trusses'
                ? MODE.ride
                : MODE.fly
    }

  // ── Slides: direction, distance and (perimeter members only) a seeded turn about z. ─────────
  const joistU = members.find((m) => m.kind === 'joist')?.u ?? Y
  const away = (a: Vec3): Vec3 => (a[0] + a[1] >= 0 ? a : [-a[0] + 0, -a[1] + 0, 0])
  const across = (u: Vec3): Vec3 => norm([-u[1], u[0], 0])
  const outward = (m: Member): Vec3 => {
    const a = across(m.u)
    return dot(a, [m.c[0] - mid[0], m.c[1] - mid[1], 0]) >= 0 ? a : [-a[0] + 0, -a[1] + 0, 0]
  }
  const parallelToJoists = (m: Member) => Math.abs(dot(m.u, joistU)) > 0.5
  for (let i = 0; i < n; i++) {
    if (mode[i] !== MODE.slide) continue
    const m = members[i]
    let dir: Vec3
    let dist: number = SLIDE.floor
    let perimeter = false
    if (m.kind === 'sill' || m.kind === 'rim') {
      dir = outward(m)
      perimeter = true
    } else if (m.kind === 'joist') dir = away(across(m.u))
    else if (m.kind === 'ledger') {
      dir = outward(m)
      dist = SLIDE.ledger
    } else {
      // Girder plies and deck sheets feed in along their length from the unbuilt end.
      dir = away(norm([m.u[0], m.u[1], 0]))
      if (m.kind === 'subfloor') dist = SLIDE.deck
    }
    const f = i * FLIGHT_STRIDE
    FL[f] = dir[0] * dist
    FL[f + 1] = dir[1] * dist
    if (perimeter) {
      // Capped so the leading end never reaches the member's own line before it arrives.
      const r = rngFor(m.id)
      const cap = Math.min(SLIDE.yaw * DEG, (0.5 * dist) / (m.size[0] / 2))
      FL[f + 7] = cap * (0.5 + 0.5 * r()) * (r() < 0.5 ? -1 : 1)
    }
  }

  // ── Posing (shared by the schedule's own checks, `at` and the per-frame pose). ────────────────
  const groups: GroupMotion[] = []
  const COL = new Float64Array(9)
  const CEN = new Float64Array(3)
  const ROT = new Float64Array(9)
  const GS = new Float64Array(12)

  const turn = (R: Float64Array) => {
    for (let j = 0; j < 9; j += 3) {
      const x = COL[j]
      const y = COL[j + 1]
      const z = COL[j + 2]
      COL[j] = R[0] * x + R[1] * y + R[2] * z
      COL[j + 1] = R[3] * x + R[4] * y + R[5] * z
      COL[j + 2] = R[6] * x + R[7] * y + R[8] * z
    }
  }

  /** Group g's rigid transform at p into out[o…o+11]: rotation (row-major), then translation. */
  function groupInto(g: number, p: number, out: Float64Array, o: number): void {
    const G = groups[g]
    const k = clamp01((p - G.win[0]) / (G.win[1] - G.win[0]))
    let angle = 0
    let dx = 0
    let dy = 0
    let dz = 0
    if (G.kind === 'tilt') angle = k >= 1 ? 0 : G.angle * (1 - inOutCubic(k))
    else {
      angle = k >= 1 ? 0 : G.angle * (1 - outBack(k, G.back))
      const e = 1 - outCubic(k)
      dx = G.offset[0] * e
      dy = G.offset[1] * e
      dz = G.offset[2] * (1 - inOutSine(k))
    }
    rotationInto(out, o, G.axis[0], G.axis[1], G.axis[2], angle)
    const px = G.pivot[0]
    const py = G.pivot[1]
    const pz = G.pivot[2]
    out[o + 9] = px - (out[o] * px + out[o + 1] * py + out[o + 2] * pz) + dx
    out[o + 10] = py - (out[o + 3] * px + out[o + 4] * py + out[o + 5] * pz) + dy
    out[o + 11] = pz - (out[o + 6] * px + out[o + 7] * py + out[o + 8] * pz) + dz
  }

  /** Member i at its own progress k, riding group transform G at go (or none): COL, CEN; returns alpha. */
  function poseK(i: number, k: number, G: Float64Array | null, go: number): number {
    const h = i * 12
    if (G) {
      for (let j = 0; j < 9; j += 3)
        applyInto(COL, j, G, go, HOME[h + j], HOME[h + j + 1], HOME[h + j + 2])
      applyInto(CEN, 0, G, go, HOME[h + 9], HOME[h + 10], HOME[h + 11])
      CEN[0] += G[go + 9]
      CEN[1] += G[go + 10]
      CEN[2] += G[go + 11]
    } else {
      for (let j = 0; j < 9; j++) COL[j] = HOME[h + j]
      CEN[0] = HOME[h + 9]
      CEN[1] = HOME[h + 10]
      CEN[2] = HOME[h + 11]
    }
    const f = i * FLIGHT_STRIDE
    switch (mode[i]) {
      case MODE.morph:
        return smoothstep(0, 1, k)
      case MODE.slide: {
        const r = 1 - outCubic(k)
        const yaw = FL[f + 7] * r * r
        if (yaw !== 0) {
          rotationInto(ROT, 0, 0, 0, 1, yaw)
          turn(ROT)
        }
        CEN[0] += FL[f] * r
        CEN[1] += FL[f + 1] * r
        return smoothstep(0, FADE_IN.slide, k)
      }
      case MODE.fly: {
        const angle = FL[f + 6] * (1 - outBack(k, BACK.fly))
        if (angle !== 0) {
          rotationInto(ROT, 0, FL[f + 3], FL[f + 4], FL[f + 5], angle)
          turn(ROT)
        }
        const e = 1 - outCubic(k)
        CEN[0] += FL[f] * e
        CEN[1] += FL[f + 1] * e
        CEN[2] += FL[f + 2] * (1 - inOutSine(k))
        return smoothstep(0, FADE_IN.fly, k)
      }
      case MODE.pour: {
        // Grows from the bottom face; never thinner than 1/64″, so normals stay finite.
        const j = POUR[i] * 3
        const H = Math.hypot(COL[j], COL[j + 1], COL[j + 2])
        const q = Math.max(outCubic(k), MIN_AXIS / H)
        COL[j] *= q
        COL[j + 1] *= q
        COL[j + 2] *= q
        CEN[2] -= (H * (1 - q)) / 2
        return k > 0 ? 1 : 0
      }
      default:
        return smoothstep(0, FADE_IN.unit, k)
    }
  }

  const kOf = (i: number, p: number) => clamp01((p - t0[i]) / (t1[i] - t0[i]))
  const aiOf = (i: number, p: number) => {
    const g = groupOf[i]
    const own = busy(t0[i], t1[i], p)
    if (g < 0 || groups[g].kind !== 'tilt') return own
    const w = groups[g].win
    return Math.max(own, busy(w[0], w[1], p))
  }
  /** Member i at progress p, into COL/CEN; returns alpha. */
  function poseAt(i: number, p: number): number {
    const g = groupOf[i]
    if (g >= 0) groupInto(g, p, GS, 0)
    return poseK(i, kOf(i, p), g >= 0 ? GS : null, 0)
  }
  /** The posed box's bounds from COL/CEN. */
  const posedBounds = (): Box3 => {
    const e = [0, 1, 2].map(
      (a) => (Math.abs(COL[a]) + Math.abs(COL[3 + a]) + Math.abs(COL[6 + a])) / 2,
    )
    return [
      [CEN[0] - e[0], CEN[1] - e[1], CEN[2] - e[2]],
      [CEN[0] + e[0], CEN[1] + e[1], CEN[2] + e[2]],
    ]
  }
  const posedBox = (): Box => {
    const L = Math.hypot(COL[0], COL[1], COL[2])
    const W = Math.hypot(COL[3], COL[4], COL[5])
    const H = Math.hypot(COL[6], COL[7], COL[8])
    return {
      c: [CEN[0], CEN[1], CEN[2]],
      u: [COL[0] / L, COL[1] / L, COL[2] / L],
      v: [COL[3] / W, COL[4] / W, COL[5] / W],
      size: [L, W, H],
    }
  }

  // ── Sweeps ────────────────────────────────────────────────────────────────────────────────
  /**
   * Starts spread evenly in key order (ordinal, not by distance), so the crew slows down where
   * members crowd, at openings and corners, instead of bunching flights up there.
   */
  function sweep(slots: readonly Slot[], win: Win): void {
    let tail = 0
    for (const s of slots) tail = Math.max(tail, s.lag + s.dur)
    const span = Math.max(0, win[1] - win[0] - tail)
    const ranked = [...slots].sort((a, b) => a.key - b.key || a.rank - b.rank || idOrder(a.i, b.i))
    ranked.forEach((s, r) => {
      t0[s.i] = win[0] + span * (ranked.length > 1 ? r / (ranked.length - 1) : 0) + s.lag
      t1[s.i] = t0[s.i] + s.dur
    })
  }

  /** The bounds a slide sweeps through, one box per stretch between samples of its path. */
  function slidePath(i: number): Box3[] {
    const out: Box3[] = []
    let prev: Box3 | null = null
    for (let s = 0; s <= 8; s++) {
      poseK(i, s / 8, null, 0)
      const bb = posedBounds()
      if (prev) out.push(union([prev, bb]))
      prev = bb
    }
    return out
  }

  /** For each slot, the lower-ranked slots it touches: what it rests on or is fixed to. */
  function supports(slots: readonly Slot[]): number[][] {
    const deps = slots.map(() => [] as number[])
    for (let a = 0; a < slots.length; a++)
      for (let b = 0; b < slots.length; b++)
        if (slots[a].rank < slots[b].rank && contact(home[slots[a].i], home[slots[b].i]))
          deps[b].push(a)
    return deps
  }

  /**
   * Pushes members later until each lands DEP_GAP after every lower-ranked member it touches, and
   * each slide starts no sooner than any slide whose path crosses its home (same speed and
   * distance, so the later one never catches up).
   */
  function resolve(slots: readonly Slot[], deps: readonly (readonly number[])[]): void {
    const lanes = slots.map(() => [] as number[])
    const paths = slots.map((s) => (mode[s.i] === MODE.slide ? slidePath(s.i) : null))
    for (let a = 0; a < slots.length; a++)
      for (let b = 0; b < slots.length; b++) {
        const path = paths[a]
        const there = home[slots[b].i]
        if (a !== b && path && paths[b] && path.some((bb) => overlaps(bb, there, MIN_AXIS)))
          lanes[b].push(a)
      }
    const order = slots
      .map((_, j) => j)
      .sort(
        (x, y) =>
          slots[x].rank - slots[y].rank ||
          t0[slots[x].i] - t0[slots[y].i] ||
          idOrder(slots[x].i, slots[y].i),
      )
    const moved: string[] = []
    for (let pass = 0; pass < 100; pass++) {
      moved.length = 0
      for (const j of order) {
        const s = slots[j]
        let start = t0[s.i]
        for (const a of deps[j]) start = Math.max(start, t1[slots[a].i] + DEP_GAP - s.dur)
        for (const a of lanes[j]) start = Math.max(start, t0[slots[a].i])
        if (start > t0[s.i]) {
          t0[s.i] = start
          t1[s.i] = start + s.dur
          moved.push(members[s.i].id)
        }
      }
      if (!moved.length) return
    }
    throw new Error(`Framing schedule did not settle: ${moved.join(', ')}`)
  }

  /** Scales a phase about its start if it overruns its window (it never does for House No. 1). */
  function fit(id: string, slots: readonly Slot[], win: Win): void {
    let end = -Infinity
    for (const s of slots) end = Math.max(end, t1[s.i])
    const f = end > win[1] + 1e-9 ? (win[1] - win[0]) / (end - win[0]) : 1
    squeeze[id] = f
    for (const s of slots) {
      phaseWin[s.i * 2] = win[0]
      phaseWin[s.i * 2 + 1] = win[1]
      if (f === 1) continue
      t0[s.i] = win[0] + (t0[s.i] - win[0]) * f
      t1[s.i] = win[0] + (t1[s.i] - win[0]) * f
    }
  }

  function schedule(id: string, slots: Slot[], win: Win): void {
    if (!slots.length) return
    const deps = supports(slots)
    // A member's key is never ahead of what it rests on, so the sweep order already respects it
    // and few members need pushing (pushed members would bunch up into bursts).
    const byRank = slots.map((_, j) => j).sort((a, b) => slots[a].rank - slots[b].rank)
    for (const j of byRank)
      for (const a of deps[j]) slots[j].key = Math.max(slots[j].key, slots[a].key)
    sweep(slots, win)
    resolve(slots, deps)
    fit(id, slots, win)
  }

  const indices = (pred: (m: Member, i: number) => boolean) =>
    members.flatMap((m, i) => (pred(m, i) ? [i] : []))
  const inPhase = (ph: PhaseId) => indices((_, i) => phase[i] === ph)

  // Morph: radially from the SW corner, where chapter 1's pen rests.
  schedule(
    'morph',
    inPhase('morph').map((i) => ({
      i,
      key: Math.hypot(members[i].c[0] - ox, members[i].c[1] - oy),
      dur: DUR.morph,
      lag: 0,
      rank: 0,
    })),
    PHASES.morph,
  )

  // Floor: sills, then what they carry, then the joists and the end joists beside them.
  schedule(
    'floor',
    inPhase('floor').map((i) => {
      const m = members[i]
      const joistLike = m.kind === 'joist' || (m.kind === 'rim' && parallelToJoists(m))
      const level = m.kind === 'sill' ? 0 : joistLike ? 2 : 1
      return {
        i,
        key: nearest(home[i], ox, oy),
        dur: DUR.slide,
        lag: [FLOOR_LAG.sill, FLOOR_LAG.carrier, FLOOR_LAG.joist][level],
        rank: level,
      }
    }),
    PHASES.floor,
  )

  // Pour: stem walls in turn counter-clockwise from the SW corner, then the piers west to east.
  {
    const ccw = ([x, y]: Vec3) => ccwAt(fp, sideNearest(fp, x, y), x, y)
    const found = inPhase('pour')
    const stems = found
      .filter((i) => members[i].kind === 'stem-wall')
      .sort((a, b) => ccw(members[a].c) - ccw(members[b].c) || idOrder(a, b))
    const piers = found
      .filter((i) => members[i].kind !== 'stem-wall')
      .sort(
        (a, b) =>
          members[a].c[0] - members[b].c[0] || members[a].c[1] - members[b].c[1] || idOrder(a, b),
      )
    const [w0, w1] = PHASES.pour
    stems.forEach((i, j) => {
      t0[i] = w0 + j * STEM_STAGGER
      t1[i] = t0[i] + DUR.stem
    })
    const p0 = w0 + stems.length * STEM_STAGGER
    const step = piers.length > 1 ? (w1 - DUR.pier - p0) / (piers.length - 1) : 0
    piers.forEach((i, j) => {
      t0[i] = p0 + j * step
      t1[i] = t0[i] + DUR.pier
    })
    fit(
      'pour',
      found.map((i) => ({ i, key: 0, dur: 0, lag: 0, rank: 0 })),
      PHASES.pour,
    )
  }

  // Deck: radially, each sheet feeding in along its row from the unbuilt end.
  schedule(
    'deck',
    inPhase('deck').map((i) => ({
      i,
      key: nearest(home[i], ox, oy),
      dur: DUR.slide,
      lag: 0,
      rank: 0,
    })),
    PHASES.deck,
  )

  // Exterior walls: counter-clockwise along each wall; long members keyed by their upstream end.
  const tilts = assemblies.filter((a) => a.tilt)
  const beatOf = new Map<string, TiltBeat>()
  for (const a of tilts) {
    const w = house.wall(a.tilt!.wall)
    const side = sideOf(w, house)
    const beat = TILT.find((b) => b.side === side)
    if (!beat) throw new Error(`No TILT beat for the ${side} wall`)
    beatOf.set(a.id, beat)
    const k = w.axis === 'x' ? 0 : 1
    schedule(
      `walls:${side}`,
      a.members.map((i) => {
        const kind = members[i].kind
        return {
          i,
          key: beat.sweep > 0 ? home[i][0][k] : -home[i][1][k],
          dur: wallDur(kind),
          lag: LAG[kind] ?? LAG.stud!,
          rank: WALL_RANK[kind] ?? 1,
        }
      }),
      beat.frame,
    )
  }

  // Exterior caps: counter-clockwise from the SW corner, each keyed by its upstream end.
  schedule(
    'caps',
    inPhase('caps').map((i) => {
      const side = sideOf(house.wall(members[i].wall!), house)
      const [lo, hi] = home[i]
      const key = Math.min(ccwAt(fp, side, lo[0], lo[1]), ccwAt(fp, side, hi[0], hi[1]))
      return { i, key, dur: DUR.cap, lag: 0, rank: 0 }
    }),
    PHASES.caps,
  )

  // Interior: back to front along the 'walls' view, each long member keyed by its nearest end.
  const fwd = wallsForward()
  const depth = ([lo, hi]: Box3) =>
    fwd[0] * (fwd[0] >= 0 ? lo[0] : hi[0]) + fwd[1] * (fwd[1] >= 0 ? lo[1] : hi[1])
  schedule(
    'interior',
    inPhase('interior').map((i) => {
      const kind = members[i].kind
      const lag =
        kind === 'plate-top' || kind === 'plate-cap'
          ? PASS[kind]
          : (LAG[kind] ?? LAG.stud!) - LAG.stud!
      return { i, key: -depth(home[i]), dur: wallDur(kind), lag, rank: INTERIOR_RANK[kind] ?? 1 }
    }),
    PHASES.interior,
  )

  // Trusses west to east as units; each rake ladder right after its gable truss.
  const units = assemblies.filter((a) => a.motion === 'unit')
  const unitBounds = new Map(units.map((a) => [a.id, union(a.members.map((i) => home[i]))]))
  const unitX = (a: Assembly) => {
    const [lo, hi] = unitBounds.get(a.id)!
    return (lo[0] + hi[0]) / 2
  }
  const isRake = (a: Assembly) => a.members.some((i) => members[i].kind === 'barge')
  const byX = (a: Assembly, b: Assembly) => unitX(a) - unitX(b) || (a.id < b.id ? -1 : 1)
  const trussList = units.filter((a) => !isRake(a)).sort(byX)
  const line: Assembly[] = []
  const rakes = units.filter(isRake).sort(byX)
  for (const t of trussList) {
    line.push(t)
    for (const r of rakes) {
      const nearestTruss = [...trussList].sort(
        (a, b) => Math.abs(unitX(a) - unitX(r)) - Math.abs(unitX(b) - unitX(r)) || byX(a, b),
      )[0]
      if (nearestTruss === t) line.push(r)
    }
  }
  {
    const [w0, w1] = PHASES.trusses
    const step = line.length > 1 ? (w1 - w0 - DUR.truss) / (line.length - 1) : 0
    line.forEach((a, j) => {
      for (const i of a.members) {
        t0[i] = w0 + j * step
        t1[i] = t0[i] + DUR.truss
      }
    })
    fit(
      'trusses',
      line.flatMap((a) => a.members.map((i) => ({ i, key: 0, dur: 0, lag: 0, rank: 0 }))),
      PHASES.trusses,
    )
  }

  // Porch: west to east, piers first, rafters last.
  schedule(
    'porch',
    inPhase('porch').map((i) => {
      const kind = members[i].kind
      return {
        i,
        key: home[i][0][0],
        dur: kind === 'pier' ? DUR.pier : DUR.porch,
        lag: PORCH_LAG[kind] ?? 0,
        rank: PORCH_RANK[kind] ?? 0,
      }
    }),
    PHASES.porch,
  )

  for (let i = 0; i < n; i++)
    if (!(t1[i] > t0[i] && t0[i] > 0)) throw new Error(`${members[i].id} was not scheduled`)

  // ── Groups ────────────────────────────────────────────────────────────────────────────────
  for (const a of tilts) {
    groups.push({
      id: a.id,
      kind: 'tilt',
      pivot: a.tilt!.pivot,
      axis: a.tilt!.axis,
      angle: HALF_PI,
      offset: [0, 0, 0],
      back: 0,
      win: beatOf.get(a.id)!.raise,
      members: a.members,
    })
  }
  for (const a of line) {
    const [lo, hi] = unitBounds.get(a.id)!
    const rake = isRake(a)
    // Trusses lie with the apex east, toward the trusses still to come; rake ladders lie outward,
    // hinged on their inner edge so they never swing into the gable they hang from.
    const west = rake && (lo[0] + hi[0]) / 2 < mid[0]
    const sign = west ? -1 : 1
    groups.push({
      id: a.id,
      kind: 'unit',
      pivot: rake
        ? [west ? hi[0] : lo[0], (lo[1] + hi[1]) / 2, lo[2]]
        : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, frame.datums.plate ?? lo[2]],
      axis: Y,
      angle: sign * HALF_PI,
      offset: [sign * UNIT_START.drift, 0, UNIT_START.rise],
      back: rake ? 0 : BACK.truss,
      win: [t0[a.members[0]], t1[a.members[0]]],
      members: a.members,
    })
  }
  groups.forEach((g, gi) => {
    for (const i of g.members) groupOf[i] = gi
  })
  // A frame lies flat until its raise, so no flight may overlap it.
  for (const g of groups)
    if (g.kind === 'tilt')
      for (const i of g.members)
        if (t1[i] > g.win[0]) throw new Error(`${members[i].id} is still flying when ${g.id} rises`)

  // ── Flights ───────────────────────────────────────────────────────────────────────────────
  const tiltOf = (i: number) => {
    const g = groupOf[i]
    return g >= 0 && groups[g].kind === 'tilt'
      ? assemblies.find((a) => a.id === groups[g].id)!.tilt!
      : null
  }
  const standing = new Map<string, Box3>()
  const lying = new Map<string, Box3>()
  for (const a of tilts) {
    const bb = union(a.members.map((i) => home[i]))
    standing.set(a.id, [[bb[0][0], bb[0][1], frame.datums.floor ?? 0], bb[1]])
    lying.set(a.id, union(a.members.map((i) => aabb(flatPose(members[i], a.tilt!)))))
  }
  const interiorWalls = assemblies.filter((a) => a.id.startsWith('wall/') && !a.tilt)
  const interiorBounds = new Map(
    interiorWalls.map((a) => [a.id, union(a.members.map((i) => home[i]))]),
  )
  const firstOf = new Map(
    interiorWalls.map((a) => [a.id, Math.min(...a.members.map((i) => t0[i]))]),
  )
  const solid = (bb: Box3): Obstacle => ({ box: boxOf(bb), bb })
  const unitObstacles: Obstacle[] = line.flatMap((a) =>
    a.members.map((i) => ({ box: members[i], bb: home[i] })),
  )

  /** What already stands (or is rising) around member i while it flies. */
  function obstaclesFor(i: number): Obstacle[] {
    const m = members[i]
    const out: Obstacle[] = []
    const walls = (accept: (a: Assembly) => boolean) => {
      for (const a of tilts) {
        if (!accept(a)) continue
        const raise = beatOf.get(a.id)!.raise
        if (raise[0] >= t1[i]) continue
        out.push(
          solid(
            raise[1] <= t0[i]
              ? standing.get(a.id)!
              : union([standing.get(a.id)!, lying.get(a.id)!]),
          ),
        )
      }
    }
    if (phase[i] === 'walls') walls((a) => a.id !== m.group)
    else if (phase[i] === 'interior') {
      walls(() => true)
      const own = `wall/${m.wall}`
      for (const a of interiorWalls)
        if (a.id !== own && firstOf.get(a.id)! < t1[i]) out.push(solid(interiorBounds.get(a.id)!))
    } else if (phase[i] === 'porch') {
      walls(() => true)
      out.push(...unitObstacles)
    }
    return out
  }

  function clears(i: number, obstacles: readonly Obstacle[]): boolean {
    if (!obstacles.length) return true
    const poses = CLEAR_K.map((k) => {
      poseAt(i, t0[i] + k * (t1[i] - t0[i]))
      return { bb: posedBounds(), box: posedBox() }
    })
    const reach = union(poses.map((q) => q.bb))
    const near = obstacles.filter((o) => overlaps(reach, o.bb, CLEAR_TOL))
    for (const q of poses)
      for (const o of near)
        if (overlaps(q.bb, o.bb, CLEAR_TOL) && obbOverlap(q.box, o.box) > CLEAR_TOL) return false
    return true
  }

  for (let i = 0; i < n; i++) {
    if (mode[i] !== MODE.fly) continue
    const m = members[i]
    const r = rngFor(m.id)
    const draws = [r(), r(), r(), r(), r(), r(), r()]
    const ph = phase[i] as 'walls' | 'caps' | 'interior' | 'porch'
    const cfg = FLY[ph]
    const plate = m.kind === 'plate-top' || m.kind === 'plate-cap'
    const rise = (plate ? cfg.plateRise : cfg.rise) * mix(JITTER.rise, draws[0])
    const drift = cfg.drift * mix(JITTER.drift, draws[1])
    const host = m.wall ? house.wall(m.wall) : null
    const along: Vec3 = host?.axis === 'y' ? Y : X
    let heading: Vec3
    if (ph === 'walls') heading = scale2(along, -beatOf.get(m.group)!.sweep)
    else if (ph === 'caps') heading = scale2(TANGENT[sideOf(host!, house)], -1)
    else if (ph === 'interior') heading = [fwd[0], fwd[1], 0]
    else heading = [-1, 0, 0]
    const turnBy = (draws[2] - 0.5) * 2 * JITTER.heading * DEG
    const hx = heading[0] * Math.cos(turnBy) - heading[1] * Math.sin(turnBy)
    const hy = heading[0] * Math.sin(turnBy) + heading[1] * Math.cos(turnBy)

    // Tumble about an axis across the grain. Wall verticals swing across their wall and rafters
    // pitch in their own plane, so neither sweeps through the neighbours it lands between.
    const tilt = tiltOf(i)
    const landing = tilt ? flatPose(m, tilt) : m
    let axis: Vec3
    if (host && isVertical(m)) axis = along
    else if (m.kind === 'rafter') axis = norm(cross(landing.u, Z))
    else {
      const zq = 2 * draws[3] - 1
      const phi = 2 * Math.PI * draws[4]
      const q: Vec3 = [
        Math.sqrt(1 - zq * zq) * Math.cos(phi),
        Math.sqrt(1 - zq * zq) * Math.sin(phi),
        zq,
      ]
      const c = cross(landing.u, q)
      axis = len(c) > 1e-6 ? norm(c) : norm(cross(landing.u, Math.abs(landing.u[2]) < 0.9 ? Z : X))
    }
    const angle =
      Math.min(TUMBLE.max * DEG, TUMBLE.reach / m.size[0]) *
      (0.5 + 0.5 * draws[5]) *
      (draws[6] < 0.5 ? -1 : 1)

    const f = i * FLIGHT_STRIDE
    FL[f + 2] = rise
    FL[f + 3] = axis[0]
    FL[f + 4] = axis[1]
    FL[f + 5] = axis[2]
    const obstacles = obstaclesFor(i)
    for (const [sd, sa] of CLEAR_TRIES) {
      FL[f] = hx * drift * sd
      FL[f + 1] = hy * drift * sd
      FL[f + 6] = angle * sa
      if (clears(i, obstacles)) break
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────────────────────
  const settle = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const g = groupOf[i]
    settle[i] = Math.max(t1[i], g >= 0 ? groups[g].win[1] : 0) + AI_SETTLE
  }
  let firstAt = Infinity
  let settledAt = 0
  for (let i = 0; i < n; i++) {
    firstAt = Math.min(firstAt, t0[i])
    settledAt = Math.max(settledAt, settle[i])
  }

  const wallInk = new Map<string, number>()
  members.forEach((m, i) => {
    if (m.kind === 'plate-bottom' && m.wall)
      wallInk.set(m.wall, Math.max(wallInk.get(m.wall) ?? 0, t1[i]))
  })

  const startBox = (i: number): Box3 => {
    poseAt(i, t0[i])
    return posedBounds()
  }
  const homes = (pred: (i: number) => boolean) => indices((_, i) => pred(i)).map((i) => home[i])
  const starts = (phases: readonly PhaseId[]) =>
    indices(
      (_, i) => phases.includes(phase[i]) && mode[i] !== MODE.morph && mode[i] !== MODE.pour,
    ).map(startBox)
  const deckBox = union([
    ...homes((i) => phase[i] !== 'trusses' && phase[i] !== 'porch'),
    ...starts(['floor', 'deck', 'walls']),
  ])
  const wallsBox = union([deckBox, ...starts(['interior', 'caps'])])
  const envelope: Box3[] = []
  for (const g of groups)
    if (g.kind === 'unit')
      for (let s = 0; s <= 10; s++) {
        const p = g.win[0] + (s / 10) * (g.win[1] - g.win[0])
        for (const i of g.members) {
          poseAt(i, p)
          envelope.push(posedBounds())
        }
      }
  const heroBox = union(home)
  const boxes: Record<ShotId, Box3> = {
    deck: deckBox,
    walls: wallsBox,
    roof: union([heroBox, ...envelope, ...starts(['porch'])]),
    hero: heroBox,
  }

  const win = new Float64Array(n * 2)
  for (let i = 0; i < n; i++) {
    win[i * 2] = t0[i]
    win[i * 2 + 1] = t1[i]
  }

  const schedule_: Schedule = {
    win,
    phaseWin,
    mode,
    phase,
    group: groupOf,
    groups,
    flight: FL,
    boxes,
    wallInk,
    squeeze,
    firstAt,
    settledAt,
    at(i, p) {
      const alpha = poseAt(i, p)
      return { box: posedBox(), alpha, ai: aiOf(i, p) }
    },
  }

  // ── The per-frame pose ────────────────────────────────────────────────────────────────────
  const drawOrder = (material: Member['material']): DrawList => {
    const ids = indices((m) => m.material === material).sort(
      (a, b) => t0[a] - t0[b] || idOrder(a, b),
    )
    return { ids: Int32Array.from(ids), starts: Float64Array.from(ids.map((i) => t0[i])) }
  }
  const wood = drawOrder('wood')
  const concrete = drawOrder('concrete')
  const GT = new Float64Array(groups.length * 12)
  const counts: PoseCounts = { wood: 0, concrete: 0 }

  /** How many start before p: t0 < p, a prefix of the draw order. */
  const started = (starts: Float64Array, p: number) => {
    let a = 0
    let b = starts.length
    while (a < b) {
      const c = (a + b) >> 1
      if (starts[c] < p) a = c + 1
      else b = c
    }
    return a
  }

  function drawAll(list: DrawList, target: PoseTarget, p: number): number {
    const count = started(list.starts, p)
    for (let j = 0; j < count; j++)
      write(list.ids[j], p, target.matrix, j * 16, target.state, j * 4)
    return count
  }

  function write(i: number, p: number, M: Float32Array, mo: number, S: Float32Array, so: number) {
    if (p >= settle[i]) {
      for (let j = 0; j < 16; j++) M[mo + j] = HOME32[i * 16 + j]
      S[so] = 1
      S[so + 1] = 0
      S[so + 2] = 0
      S[so + 3] = 0
      return
    }
    const g = groupOf[i]
    const alpha = poseK(i, kOf(i, p), g >= 0 ? GT : null, g * 12)
    const shown = alpha > 0
    for (let j = 0; j < 3; j++) {
      M[mo + j * 4] = shown ? COL[j * 3] : 0
      M[mo + j * 4 + 1] = shown ? COL[j * 3 + 1] : 0
      M[mo + j * 4 + 2] = shown ? COL[j * 3 + 2] : 0
      M[mo + j * 4 + 3] = 0
    }
    M[mo + 12] = CEN[0]
    M[mo + 13] = CEN[1]
    M[mo + 14] = CEN[2]
    M[mo + 15] = 1
    S[so] = alpha
    S[so + 1] = aiOf(i, p)
    S[so + 2] = 0
    S[so + 3] = 0
  }

  const plan: FramePlan = {
    order: { wood: wood.ids, concrete: concrete.ids },
    firstAt,
    settledAt,
    /** Writes every drawn instance in place; the returned counts object is reused between calls. */
    pose(p, out: PoseOut) {
      for (let g = 0; g < groups.length; g++) groupInto(g, p, GT, g * 12)
      counts.wood = drawAll(wood, out.wood, p)
      counts.concrete = drawAll(concrete, out.concrete, p)
      return counts
    },
  }

  return { schedule: schedule_, plan }
}

/** [w0, w1] per plan element: when its ink dissolves to paper (DISSOLVE by kind, walls by WALL_INK). */
export function elementWindows(plan: PlanDrawing, sched: Pick<Schedule, 'wallInk'>): Float32Array {
  const byKind = new Map<ElementKind, Win>()
  for (const d of DISSOLVE) for (const k of d.kinds) byKind.set(k, d.win)
  const out = new Float32Array(plan.elements.length * 2)
  plan.elements.forEach((e, i) => {
    const ink = e.kind === 'wall' ? sched.wallInk.get(e.id) : undefined
    const win: Win | undefined = ink !== undefined ? [ink, ink + WALL_INK] : byKind.get(e.kind)
    if (!win) throw new Error(`No dissolve window for ${e.kind}:${e.id}`)
    out[i * 2] = win[0]
    out[i * 2 + 1] = win[1]
  })
  return out
}

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

const wallDur = (kind: MemberKind): number =>
  kind === 'plate-top'
    ? DUR.plate
    : kind === 'plate-cap'
      ? DUR.cap
      : kind === 'header' || kind === 'rough-sill'
        ? DUR.header
        : DUR.stud

const mix = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t
const scale2 = (a: Vec3, k: number): Vec3 => [a[0] * k + 0, a[1] * k + 0, 0]

/** Counter-clockwise direction of travel along each side. */
const TANGENT: Readonly<Record<Side, Vec3>> = { s: X, e: Y, n: [-1, 0, 0], w: [0, -1, 0] }

type Footprint = readonly [number, number, number, number]

/** Position counter-clockwise round the building line from the SW corner, on a given side. */
function ccwAt(fp: Footprint, side: Side, x: number, y: number): number {
  const W = fp[2] - fp[0]
  const D = fp[3] - fp[1]
  if (side === 's') return x - fp[0]
  if (side === 'e') return W + (y - fp[1])
  if (side === 'n') return W + D + (fp[2] - x)
  return 2 * W + D + (fp[3] - y)
}

function sideNearest(fp: Footprint, x: number, y: number): Side {
  const d: [Side, number][] = [
    ['s', Math.abs(y - fp[1])],
    ['e', Math.abs(x - fp[2])],
    ['n', Math.abs(y - fp[3])],
    ['w', Math.abs(x - fp[0])],
  ]
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
}
