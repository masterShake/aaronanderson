import { Matrix4, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA } from '@/lib/draft/script'
import type { Box3, Vec3 } from '@/lib/framing/types'
import type { Rect } from '@/lib/geom/rect'
import {
  applyPose,
  blendPose,
  extremePoints,
  fitBox,
  fitBox3,
  fitPoints,
  FOV,
  inOutCubic,
  poseAt,
  projectPoint,
  TOP_DOWN,
  viewBasis,
  type Layout,
  type Pose,
  type StoryKey,
} from '@/scene/camera'
import { planToWorld } from '@/scene/coords'

// ── Round 1's rig, verbatim: chapter 1 must keep rendering through exactly these matrices. ────

type PoseR1 = { cx: number; cy: number; distance: number }

function applyTopDownR1(camera: PerspectiveCamera, pose: PoseR1, layout: Layout): void {
  const { W, H, frame } = layout
  camera.fov = FOV
  camera.aspect = W / H
  camera.position.set(pose.cx, pose.distance, -pose.cy)
  camera.rotation.set(-Math.PI / 2, 0, 0)
  camera.near = pose.distance * 0.25
  camera.far = pose.distance * 4
  camera.setViewOffset(W, H, W / 2 - (frame.x + frame.w / 2), H / 2 - (frame.y + frame.h / 2), W, H)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const blendPoseR1 = (a: PoseR1, b: PoseR1, t: number): PoseR1 => ({
  cx: lerp(a.cx, b.cx, t),
  cy: lerp(a.cy, b.cy, t),
  distance: Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), t)),
})

/** stage.ts's keyPose + poseAt from round 1. */
function poseAtR1(keys: readonly StoryKey[], poses: ReadonlyMap<string, PoseR1>, s: number): PoseR1 {
  const keyPose = (k: StoryKey): PoseR1 => {
    const base = poses.get(k.shot) ?? { cx: 288, cy: 192, distance: 3000 }
    return { ...base, distance: base.distance * (k.dolly ?? 1) }
  }
  if (!keys.length) return { cx: 288, cy: 192, distance: 3000 }
  if (s <= keys[0].s) return keyPose(keys[0])
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (s <= b.s) {
      const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 1
      return blendPoseR1(keyPose(a), keyPose(b), b.ease === 'linear' ? t : inOutCubic(t))
    }
  }
  return keyPose(keys[keys.length - 1])
}

// ── Fixtures. ─────────────────────────────────────────────────────────────────────────────

const LAYOUTS: Record<string, Layout> = {
  desktop: { W: 792, H: 746, dpr: 2, frame: { x: 0, y: 0, w: 792, h: 746 }, wide: true },
  phone: { W: 359, H: 370, dpr: 3, frame: { x: 0, y: 0, w: 359, h: 370 }, wide: false },
  // A full-bleed canvas with the frame inside it: the lens shift must still centre the frame.
  bleed: { W: 1440, H: 900, dpr: 1, frame: { x: 600, y: 77, w: 792, h: 746 }, wide: true },
  band: { W: 390, H: 844, dpr: 3, frame: { x: 16, y: 64, w: 358, h: 370 }, wide: false },
}

/** Chapter 1's shot boxes, roughly: the signed sheet and the two test-fit spreads. */
const PLAN: Rect = [-150, -170, 730, 530]
const TESTFITS = { wide: [-724, -24, 1300, 480] as Rect, narrow: [-24, -524, 600, 980] as Rect }

const shotsR1 = (L: Layout) =>
  new Map<string, Pose>([
    ['plan', fitBox(PLAN, L, 1.04)],
    ['testfits', fitBox(L.wide ? TESTFITS.wide : TESTFITS.narrow, L, 1.08)],
  ])

/**
 * Chapter-2-shaped boxes: the framed house (grade, eaves, porch), the same with flight starts
 * overhead, a tall post (height-bound on desktop) and a slab at grade.
 */
const BOXES: Record<string, Box3> = {
  house: [
    [-12, -84, -30],
    [588, 396, 213],
  ],
  flights: [
    [-48, -120, -30],
    [624, 432, 310],
  ],
  post: [
    [0, 0, 0],
    [48, 48, 400],
  ],
  slab: [
    [0, 0, -30],
    [576, 384, -30],
  ],
}

/** [pitch, yaw] in degrees: the chapter-2 shots, near and at straight down, and some odd ones. */
const ANGLES: readonly (readonly [number, number])[] = [
  [-42, 24],
  [-38, 38],
  [-30, 36],
  [-24, 32],
  [-90, 0],
  [-89.5, 3],
  [-60, -45],
  [-12, 170],
]

const rad = (deg: number) => (deg * Math.PI) / 180

const maxDiff = (a: Matrix4, b: Matrix4): number =>
  a.elements.reduce((m, v, i) => Math.max(m, Math.abs(v - b.elements[i])), 0)

const v = new Vector3()
/** Canvas px of a plan point, through three's own projection. */
function screen(camera: PerspectiveCamera, L: Layout, q: Vec3): [number, number] {
  planToWorld(q[0], q[1], q[2], v).project(camera)
  return [((v.x + 1) / 2) * L.W, ((1 - v.y) / 2) * L.H]
}

const corners = ([lo, hi]: Box3): Vec3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [(i & 1 ? hi : lo)[0], (i & 2 ? hi : lo)[1], (i & 4 ? hi : lo)[2]])

const posed = (pose: Pose, L: Layout): PerspectiveCamera => {
  const camera = new PerspectiveCamera()
  applyPose(camera, pose, L)
  return camera
}

// ── Tests. ────────────────────────────────────────────────────────────────────────────────

describe('applyPose', () => {
  const topDown = (L: Layout): Pose[] => [
    fitBox(PLAN, L, 1.04),
    fitBox(TESTFITS.wide, L, 1.08),
    fitBox(TESTFITS.narrow, L, 1.08),
    fitBox([0, 0, 576, 384], L, 1),
    { ...TOP_DOWN, cx: 0, cy: 0, distance: 1 },
    { ...TOP_DOWN, cx: -37.0625, cy: 1234.5, distance: 2064.123 },
    { ...TOP_DOWN, cx: 288, cy: 192, distance: 3000 },
  ]

  it('reproduces the round-1 top-down rig exactly', () => {
    for (const [name, L] of Object.entries(LAYOUTS))
      for (const pose of topDown(L)) {
        const ref = new PerspectiveCamera()
        applyTopDownR1(ref, pose, L)
        const cam = posed(pose, L)
        expect(maxDiff(cam.matrixWorld, ref.matrixWorld), `${name} matrixWorld`).toBeLessThanOrEqual(1e-9)
        expect(maxDiff(cam.projectionMatrix, ref.projectionMatrix), `${name} projection`).toBeLessThanOrEqual(1e-9)
        expect([cam.near, cam.far]).toEqual([ref.near, ref.far])
      }
  })

  it("matches round 1 through chapter 1's keys, with chapter 2's keys after them", () => {
    const ch1: StoryKey[] = CAMERA.map((k) => ({ ...k, s: k.p }))
    const ch2: StoryKey[] = [
      { s: 1, shot: 'plan', dolly: 0.97 },
      { s: 1.11, shot: 'plan', dolly: 0.97 },
      { s: 1.21, shot: 'deck' },
    ]
    for (const [name, L] of Object.entries(LAYOUTS)) {
      const shots = shotsR1(L).set('deck', fitBox3(BOXES.house, rad(-42), rad(24), L, 1.08))
      const ref = new PerspectiveCamera()
      const cam = new PerspectiveCamera()
      const stops = [...Array.from({ length: 421 }, (_, i) => -0.05 + i / 400), ...ch1.map((k) => k.s)]
      for (const s of stops.filter((x) => x <= 1)) {
        applyTopDownR1(ref, poseAtR1(ch1, shotsR1(L), s), L)
        const pose = poseAt([...ch1, ...ch2], shots, s)
        expect([pose.pitch, pose.yaw, pose.cz]).toEqual([TOP_DOWN.pitch, TOP_DOWN.yaw, TOP_DOWN.cz])
        applyPose(cam, pose, L)
        expect(maxDiff(cam.matrixWorld, ref.matrixWorld), `${name} s=${s}`).toBeLessThanOrEqual(1e-9)
        expect(maxDiff(cam.projectionMatrix, ref.projectionMatrix), `${name} s=${s}`).toBeLessThanOrEqual(1e-9)
      }
    }
  })

  it('carries no state between poses on a reused camera', () => {
    const L = LAYOUTS.desktop
    const cam = posed(fitBox3(BOXES.house, rad(-30), rad(36), L, 1.06), L)
    const pose = fitBox(PLAN, L, 1.04)
    applyPose(cam, pose, L)
    const ref = new PerspectiveCamera()
    applyTopDownR1(ref, pose, L)
    expect(maxDiff(cam.matrixWorld, ref.matrixWorld)).toBeLessThanOrEqual(1e-9)
    expect(maxDiff(cam.projectionMatrix, ref.projectionMatrix)).toBeLessThanOrEqual(1e-9)
  })

  it('aims the lens along viewBasis and puts the target on the frame centre', () => {
    const X = new Vector3()
    const Y = new Vector3()
    const Z = new Vector3()
    const plan = (w: Vector3): Vec3 => [w.x, -w.z, w.y]
    for (const [name, L] of Object.entries(LAYOUTS))
      for (const [p, y] of ANGLES) {
        const pose: Pose = { cx: 250, cy: 180, cz: 40, distance: 2200, pitch: rad(p), yaw: rad(y) }
        const cam = posed(pose, L)
        cam.matrixWorld.extractBasis(X, Y, Z)
        const { right, up, fwd } = viewBasis(pose.pitch, pose.yaw)
        const want: [Vec3, Vec3][] = [
          [plan(X), right],
          [plan(Y), up],
          [plan(Z.negate()), fwd],
        ]
        for (const [got, exp] of want) for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(exp[k], 12)
        const at = plan(cam.position)
        const lens = [pose.cx, pose.cy, pose.cz].map((c, k) => c - fwd[k] * pose.distance)
        for (let k = 0; k < 3; k++) expect(at[k]).toBeCloseTo(lens[k], 9)

        const centre = [L.frame.x + L.frame.w / 2, L.frame.y + L.frame.h / 2]
        const target: Vec3 = [pose.cx, pose.cy, pose.cz]
        const [sx, sy] = screen(cam, L, target)
        expect(Math.hypot(sx - centre[0], sy - centre[1]), `${name} ${p}/${y}`).toBeLessThan(1e-6)
        const [px, py, depth] = projectPoint(pose, L, target)
        expect([px, py, depth]).toEqual([centre[0], centre[1], pose.distance])
        for (const q of corners(BOXES.flights)) {
          const [a, b] = screen(cam, L, q)
          const [c, d] = projectPoint(pose, L, q)
          expect(Math.hypot(a - c, b - d), `${name} ${p}/${y} projectPoint`).toBeLessThan(1e-6)
        }
      }
  })
})

describe('fitBox3', () => {
  it('fits all 8 corners exactly: inside the padded frame, binding edge touching, both axes centred', () => {
    let worst = 0
    for (const [name, L] of Object.entries(LAYOUTS))
      for (const [boxName, box] of Object.entries(BOXES))
        for (const [p, y] of ANGLES)
          for (const pad of [1.03, 1.08]) {
            const what = `${name} ${boxName} ${p}/${y} pad ${pad}`
            const pose = fitBox3(box, rad(p), rad(y), L, pad)
            expect([pose.pitch, pose.yaw]).toEqual([rad(p), rad(y)])
            const cam = posed(pose, L)
            const pts = corners(box).map((q) => screen(cam, L, q))
            const xs = pts.map((q) => q[0])
            const ys = pts.map((q) => q[1])
            const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
            const [fx, fy] = [L.frame.x + L.frame.w / 2, L.frame.y + L.frame.h / 2]
            const [hw, hh] = [L.frame.w / (2 * pad), L.frame.h / (2 * pad)]
            // Inside the padded frame (float slack only).
            expect(x0, what).toBeGreaterThanOrEqual(fx - hw - 1e-6)
            expect(x1, what).toBeLessThanOrEqual(fx + hw + 1e-6)
            expect(y0, what).toBeGreaterThanOrEqual(fy - hh - 1e-6)
            expect(y1, what).toBeLessThanOrEqual(fy + hh + 1e-6)
            // The binding axis touches the padded edge on both sides.
            const slack = Math.min(hw - (x1 - x0) / 2, hh - (y1 - y0) / 2)
            expect(Math.abs(slack), `${what} binding`).toBeLessThanOrEqual(0.5)
            // Both axes centred on the frame centre.
            const off = Math.max(Math.abs((x0 + x1) / 2 - fx), Math.abs((y0 + y1) / 2 - fy))
            expect(off, `${what} centring`).toBeLessThanOrEqual(0.5)
            worst = Math.max(worst, Math.abs(slack), off)
            // Nothing is clipped by the 0.25d / 4d near and far planes.
            for (const q of corners(box)) {
              const depth = projectPoint(pose, L, q)[2]
              expect(depth, what).toBeGreaterThan(cam.near)
              expect(depth, what).toBeLessThan(cam.far)
            }
          }
    // The fit is analytic: in practice it is exact to float precision, far inside the 0.5 px bound.
    expect(worst).toBeLessThan(1e-6)
  })

  it('equals fitBox for a flat box seen straight down', () => {
    for (const [name, L] of Object.entries(LAYOUTS))
      for (const r of [PLAN, TESTFITS.wide, TESTFITS.narrow, [0, 0, 576, 384] as Rect])
        for (const pad of [1, 1.04, 1.08]) {
          const box: Box3 = [
            [r[0], r[1], 0],
            [r[2], r[3], 0],
          ]
          const a = fitBox3(box, TOP_DOWN.pitch, TOP_DOWN.yaw, L, pad)
          const b = fitBox(r, L, pad)
          const what = `${name} [${r.join(', ')}] pad ${pad}`
          expect(Math.abs(a.cx - b.cx), what).toBeLessThanOrEqual(1e-9)
          expect(Math.abs(a.cy - b.cy), what).toBeLessThanOrEqual(1e-9)
          expect(Math.abs(a.cz), what).toBeLessThanOrEqual(1e-9)
          expect(Math.abs(a.distance / b.distance - 1), what).toBeLessThanOrEqual(1e-12)
          expect([a.pitch, a.yaw]).toEqual([TOP_DOWN.pitch, TOP_DOWN.yaw])
        }
  })
})

describe('fitPoints and extremePoints', () => {
  // A 48′ × 32′ gable house: walls to the plate, a ridge running east–west, with interior clutter.
  const shell: Vec3[] = corners([
    [0, 0, -30],
    [576, 384, 109],
  ])
  const ridge: Vec3[] = [
    [-12, 192, 212],
    [588, 192, 212],
    [-12, -12, 106],
    [588, -12, 106],
    [-12, 396, 106],
    [588, 396, 106],
  ]
  const inside: Vec3[] = Array.from({ length: 200 }, (_, i) => [
    40 + ((i * 37) % 500),
    40 + ((i * 53) % 300),
    (i * 7) % 100,
  ])
  const house = [...shell, ...ridge, ...inside]

  it('keeps every hull vertex and drops interior points', () => {
    const kept = extremePoints(house)
    // The hull: the foundation's four bottom corners, the eaves and the ridge. The wall tops sit under the roof.
    for (const q of [...shell.filter((c) => c[2] < 0), ...ridge]) expect(kept).toContainEqual(q)
    for (const q of [...shell.filter((c) => c[2] > 0), ...inside]) expect(kept).not.toContainEqual(q)
  })

  it('fits the points exactly, and frames a gable tighter than its bounding box', () => {
    const box: Box3 = [
      [-12, -12, -30],
      [588, 396, 212],
    ]
    const centre: Vec3 = [288, 192, 91]
    for (const [name, L] of Object.entries(LAYOUTS))
      for (const [p, y] of [
        [-24, 32],
        [-30, 36],
      ]) {
        const what = `${name} ${p}/${y}`
        const pose = fitPoints(extremePoints(house), rad(p), rad(y), L, 1.08, centre)
        const cam = posed(pose, L)
        const pts = house.map((q) => screen(cam, L, q))
        const [fx, fy] = [L.frame.x + L.frame.w / 2, L.frame.y + L.frame.h / 2]
        const [hw, hh] = [L.frame.w / (2 * 1.08), L.frame.h / (2 * 1.08)]
        for (const [x, yy] of pts) {
          expect(Math.abs(x - fx), what).toBeLessThanOrEqual(hw + 1e-6)
          expect(Math.abs(yy - fy), what).toBeLessThanOrEqual(hh + 1e-6)
        }
        expect(pose.distance, what).toBeLessThan(fitBox3(box, rad(p), rad(y), L, 1.08).distance)
      }
  })
})

describe('blendPose', () => {
  const A: Pose = { cx: 120, cy: -40, cz: 12, distance: 2291, pitch: rad(-42), yaw: rad(24) }
  const B: Pose = { cx: 300, cy: 210, cz: 75, distance: 2175, pitch: rad(-24), yaw: rad(32) }
  const rel = (a: number, b: number) => Math.abs(a / b - 1)

  it('returns its endpoints', () => {
    const a = blendPose(A, B, 0)
    expect([a.cx, a.cy, a.cz, a.pitch, a.yaw]).toEqual([A.cx, A.cy, A.cz, A.pitch, A.yaw])
    expect(rel(a.distance, A.distance)).toBeLessThanOrEqual(1e-12)
    const b = blendPose(A, B, 1)
    for (const k of ['cx', 'cy', 'cz', 'pitch', 'yaw'] as const) expect(b[k]).toBeCloseTo(B[k], 12)
    expect(rel(b.distance, B.distance)).toBeLessThanOrEqual(1e-12)
  })

  it('takes the geometric mean of distance and the linear mean of everything else', () => {
    const m = blendPose(A, B, 0.5)
    expect(rel(m.distance, Math.sqrt(A.distance * B.distance))).toBeLessThanOrEqual(1e-12)
    for (const k of ['cx', 'cy', 'cz', 'pitch', 'yaw'] as const) expect(m[k]).toBeCloseTo((A[k] + B[k]) / 2, 12)
  })

  it('keeps top-down blends exactly top-down', () => {
    const L = LAYOUTS.desktop
    for (const t of [0, 0.1, 0.37, 0.5, 0.93, 1]) {
      const p = blendPose(fitBox(PLAN, L, 1.04), fitBox(TESTFITS.wide, L, 1.08), t)
      expect([p.pitch, p.yaw, p.cz]).toEqual([TOP_DOWN.pitch, TOP_DOWN.yaw, TOP_DOWN.cz])
    }
  })
})

describe('poseAt', () => {
  const A: Pose = { ...TOP_DOWN, cx: 100, cy: 50, distance: 2000 }
  const B: Pose = { cx: 300, cy: 150, cz: 60, distance: 2400, pitch: rad(-42), yaw: rad(24) }
  const C: Pose = { cx: 280, cy: 170, cz: 80, distance: 2300, pitch: rad(-24), yaw: rad(32) }
  const shots = new Map([
    ['a', A],
    ['b', B],
    ['c', C],
  ])

  it('holds the first key before it and the last key past it', () => {
    const keys: StoryKey[] = [
      { s: 1, shot: 'a', dolly: 0.97 },
      { s: 1.5, shot: 'b' },
      { s: 2, shot: 'c', dolly: 0.96, ease: 'linear' },
    ]
    expect(poseAt(keys, shots, 0)).toEqual({ ...A, distance: A.distance * 0.97 })
    expect(poseAt(keys, shots, 1)).toEqual({ ...A, distance: A.distance * 0.97 })
    expect(poseAt(keys, shots, 2)).toEqual(blendPose(B, { ...C, distance: C.distance * 0.96 }, 1))
    for (const s of [2.0001, 3, 4.5, 5]) expect(poseAt(keys, shots, s)).toEqual({ ...C, distance: C.distance * 0.96 })
  })

  it('cuts cleanly at equal-s keys', () => {
    const keys: StoryKey[] = [
      { s: 0, shot: 'a' },
      { s: 1, shot: 'b' },
      { s: 1, shot: 'c' },
      { s: 2, shot: 'a', ease: 'linear' },
    ]
    // At the shared s the earlier key wins; the next segment starts from the later key.
    expect(poseAt(keys, shots, 1)).toEqual(blendPose(A, B, 1))
    expect(poseAt(keys, shots, 1.5)).toEqual(blendPose(C, A, 0.5))
    const after = poseAt(keys, shots, 1 + 1e-12)
    for (const k of ['cx', 'cy', 'cz', 'pitch', 'yaw', 'distance'] as const) expect(after[k]).toBeCloseTo(C[k], 6)
    // Two equal-s keys alone: the guard against 0/0.
    const pair: StoryKey[] = [
      { s: 1, shot: 'b' },
      { s: 1, shot: 'c' },
    ]
    for (const s of [0, 1, 2]) expect(Object.values(poseAt(pair, shots, s)).every(Number.isFinite)).toBe(true)
    expect(poseAt(pair, shots, 2)).toEqual(C)
  })

  it('eases with inOutCubic unless the later key is linear', () => {
    const keys: StoryKey[] = [
      { s: 0, shot: 'a' },
      { s: 1, shot: 'b' },
      { s: 2, shot: 'c', ease: 'linear' },
    ]
    expect(poseAt(keys, shots, 0.25)).toEqual(blendPose(A, B, inOutCubic(0.25)))
    expect(poseAt(keys, shots, 1.25)).toEqual(blendPose(B, C, 0.25))
  })

  it('falls back to a top-down view of the house for missing keys or shots', () => {
    const fallback = { ...TOP_DOWN, cx: 288, cy: 192, distance: 3000 }
    expect(poseAt([], shots, 0.5)).toEqual(fallback)
    expect(poseAt([{ s: 0, shot: 'nope', dolly: 0.5 }], shots, 3)).toEqual({ ...fallback, distance: 1500 })
  })
})
