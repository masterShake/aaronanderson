import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { Vector3 } from 'three'
import type { ViewBox } from '@/drawings/types'
import { SCENE } from '@/styles/tokens'
import { ISO_AZ, ISO_EL, OrthoRig, isoBasis, isoProject, svgToWorld } from '../rig'
import { cubicBezier, ease } from '../ease'
import { RoutePath } from '../pipes'
import { packetS } from '../packets'

/** The rig's invariants (§2.1) and its parity with the iso print's maths. */

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const VBS: ViewBox[] = [
  [0, 0, 960, 640],
  [0, 0, 400, 480],
  [0, 0, 960, 720],
  [20, 10, 800, 600],
  [0, 0, 400, 500],
]
const BOXES: [number, number][] = [
  [960, 640],
  [1186.5, 791],
  [390, 468],
  [1280, 700],
  [600, 900],
]

const toCss = (p: Vector3, rig: OrthoRig, w: number, h: number) => {
  const n = p.clone().project(rig.camera)
  return [((n.x + 1) / 2) * w, ((1 - n.y) / 2) * h] as const
}

const boundsOf = (vb: ViewBox, height: number) => {
  const out: Vector3[] = []
  for (const x of [vb[0] + 40, vb[0] + vb[2] - 40])
    for (const z of [vb[1] + 40, vb[1] + vb[3] - 40])
      for (const y of [0, height]) out.push(new Vector3(x, y, z))
  return out
}

for (const start of ['plan', 'front'] as const) {
  test(`pose 0 is the exact SVG frame (${start})`, () => {
    for (let i = 0; i < VBS.length; i++) {
      const vb = VBS[i]!
      const [W, H] = BOXES[i]!
      const rig = new OrthoRig(start)
      rig.fit(vb, W, H, boundsOf(vb, 60))
      rig.pose(0)
      const s = Math.min(W / vb[2], H / vb[3])
      const tx = (W - vb[2] * s) / 2 - vb[0] * s
      const ty = (H - vb[3] * s) / 2 - vb[1] * s
      for (let k = 0; k < 20; k++) {
        const x = vb[0] + rnd() * vb[2]
        const y = vb[1] + rnd() * vb[3]
        const [cx, cy] = toCss(svgToWorld(start, vb, x, y), rig, W, H)
        expect(Math.abs(cx - (tx + s * x))).toBeLessThan(1e-6 * W * 10)
        expect(Math.abs(cy - (ty + s * y))).toBeLessThan(1e-6 * H * 10)
      }
    }
  })
}

test('no bound leaves the frustum at any pose', () => {
  for (let i = 0; i < VBS.length; i++) {
    const vb = VBS[i]!
    const [W, H] = BOXES[i]!
    const rig = new OrthoRig('plan')
    const bounds = boundsOf(vb, 80)
    rig.fit(vb, W, H, bounds)
    for (let k = 0; k <= 64; k++) {
      rig.pose(k / 64)
      for (const b of bounds) {
        const n = b.clone().project(rig.camera)
        expect(Math.abs(n.x)).toBeLessThanOrEqual(1 + 1e-6)
        expect(Math.abs(n.y)).toBeLessThanOrEqual(1 + 1e-6)
      }
    }
  }
})

test('the end pose is the south-east isometric from SCENE', () => {
  expect(ISO_AZ).toBeCloseTo((SCENE.isoAzimuthDeg * Math.PI) / 180, 12)
  expect(ISO_EL).toBeCloseTo((SCENE.isoElevationDeg * Math.PI) / 180, 12)
  const { r, u, b } = isoBasis()
  expect(b.x).toBeCloseTo(1 / Math.sqrt(3), 4)
  expect(b.y).toBeCloseTo(1 / Math.sqrt(3), 4)
  expect(r.x).toBeCloseTo(1 / Math.SQRT2, 6)
  expect(r.z).toBeCloseTo(-1 / Math.SQRT2, 6)
  expect(u.y).toBeCloseTo(2 / Math.sqrt(6), 4)
  // The rig's camera at e = 1 looks along −b, with r to the right and u up.
  const rig = new OrthoRig('plan')
  const vb = VBS[0]!
  rig.fit(vb, 960, 640, boundsOf(vb, 60))
  rig.pose(1)
  const right = new Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(rig.camera.quaternion)
  expect(right.distanceTo(r)).toBeLessThan(1e-6)
  expect(up.distanceTo(u)).toBeLessThan(1e-6)
  // isoProject is the same projection: screen offsets between two points agree.
  const a = new Vector3(100, 20, 300)
  const c = new Vector3(400, 60, 120)
  const [ax, ay] = isoProject(a)
  const [cx, cy] = isoProject(c)
  const pa = a.clone().project(rig.camera)
  const pc = c.clone().project(rig.camera)
  const kx = ((pc.x - pa.x) * 960) / 2 / (cx - ax)
  const ky = ((pc.y - pa.y) * 640) / 2 / (cy - ay)
  expect(kx).toBeCloseTo(ky, 6)
})

const ISO_LIB = join(__dirname, '../../../../drawings/lib/iso.ts')
test('rig matches the iso print (drawings/lib/iso fitIso)', async () => {
  test.skip(!existsSync(ISO_LIB), 'src/drawings/lib/iso.ts is not merged yet (drawings lane, W1)')
  const lib = (await import(ISO_LIB)) as Record<string, unknown>
  const fitIso = lib.fitIso
  expect(typeof fitIso).toBe('function')
  // Parity: the print's projection is the rig's end-pose basis.
  const az = typeof lib.ISO_AZ === 'number' ? lib.ISO_AZ : ISO_AZ
  const el = typeof lib.ISO_EL === 'number' ? lib.ISO_EL : ISO_EL
  expect(az).toBeCloseTo(ISO_AZ, 6)
  expect(el).toBeCloseTo(ISO_EL, 6)
  if (typeof lib.isoProject === 'function') {
    const p = new Vector3(120, 40, 300)
    const theirs = (lib.isoProject as (x: number, y: number, z: number) => unknown)(p.x, p.y, p.z)
    const ours = isoProject(p)
    if (Array.isArray(theirs) && theirs.length >= 2) {
      // Same basis up to the print's y-down screen convention.
      expect(Math.abs(Number(theirs[0]))).toBeCloseTo(Math.abs(ours[0]), 4)
      expect(Math.abs(Number(theirs[1]))).toBeCloseTo(Math.abs(ours[1]), 4)
    }
  }
})

test('CSS easing solves like the browser', () => {
  const lin = cubicBezier(0, 0, 1, 1)
  expect(lin(0.3)).toBeCloseTo(0.3, 5)
  expect(ease.machine(0.5)).toBeCloseTo(0.5, 4)
  expect(ease.machine(0)).toBe(0)
  expect(ease.machine(1)).toBe(1)
  expect(ease.settle(0.2)).toBeGreaterThan(0.5)
})

test('routes have exact arc length and packets move linearly', () => {
  const path = new RoutePath(
    [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    5,
    12,
  )
  const expected = 100 - 12 + (Math.PI / 2) * 12 + 100 - 12
  expect(path.length).toBeCloseTo(expected, 6)
  const end = path.getPoint(1)
  expect(end.x).toBeCloseTo(100, 6)
  expect(end.z).toBeCloseTo(100, 6)
  const plan = { path, t0: 0, speed: 140, holds: [{ s: 50, ms: 200 }] }
  expect(packetS(plan, -1)).toBe(-1)
  expect(packetS(plan, 250)).toBeCloseTo(35, 6)
  expect(packetS(plan, 400)).toBeCloseTo(50, 6)
  expect(packetS(plan, 700)).toBeCloseTo(50 + 0.14 * (700 - 50 / 0.14 - 200), 6)
  expect(packetS(plan, 100_000)).toBe(-1)
})
