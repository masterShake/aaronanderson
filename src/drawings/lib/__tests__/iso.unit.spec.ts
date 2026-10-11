import { test, expect } from '@playwright/test'
import { SCENE } from '@/styles/tokens'
import { fitIso, ISO, ISO_AZ, ISO_EL, isoBasis, isoToViewBox, type V3 } from '../iso'
import { routeOrthogonal } from '../route'
import { primLength } from '../length'

/**
 * Iso maths the print and the rig share: angles from SCENE, an orthonormal
 * basis, the south-east view (b ≈ (1,1,1)/√3 at az 45°, el ≈ 35.26°), and a
 * fit that centres the model and keeps the padding.
 */

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

test('angles come from the frozen SCENE tokens', () => {
  expect(ISO_AZ).toBeCloseTo((SCENE.isoAzimuthDeg * Math.PI) / 180, 12)
  expect(ISO_EL).toBeCloseTo((SCENE.isoElevationDeg * Math.PI) / 180, 12)
})

test('the basis is orthonormal and looks from the south-east', () => {
  const { b, r, u } = ISO
  for (const v of [b, r, u]) expect(dot(v, v)).toBeCloseTo(1, 9)
  expect(dot(b, r)).toBeCloseTo(0, 9)
  expect(dot(b, u)).toBeCloseTo(0, 9)
  expect(dot(r, u)).toBeCloseTo(0, 9)
  const k = 1 / Math.sqrt(3)
  for (const c of b) expect(c).toBeCloseTo(k, 3)
  // world +x runs down-right on screen, +z down-left, up stays up
  expect(r[0]).toBeGreaterThan(0)
  expect(r[2]).toBeLessThan(0)
  expect(u[1]).toBeGreaterThan(0)
  expect(isoBasis(ISO_AZ, ISO_EL)).toEqual(ISO)
})

test('fitIso centres the bounds and keeps the padding on the tighter axis', () => {
  const vb = [0, 0, 960, 640] as const
  const box: V3[] = []
  for (const x of [200, 600])
    for (const y of [0, 80]) for (const z of [200, 440]) box.push([x, y, z])
  const fit = fitIso(vb, 960, 640, box, SCENE.padding)
  const pts = box.map((w) => isoToViewBox(w, vb, fit))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  expect(cx).toBeCloseTo(480, 6)
  expect(cy).toBeCloseTo(320, 6)
  const padX = Math.min(...xs) / 960
  const padY = Math.min(...ys) / 640
  expect(Math.min(padX, padY)).toBeCloseTo(SCENE.padding, 6)
  expect(Math.max(...xs)).toBeLessThanOrEqual(960)
  expect(Math.max(...ys)).toBeLessThanOrEqual(640)
})

test('orthogonal routes turn at right angles and fillets shorten the length', () => {
  const sharp = routeOrthogonal([0, 0], [100, 60], undefined, 0)
  const round = routeOrthogonal([0, 0], [100, 60])
  expect(primLength(sharp)).toBeCloseTo(160, 6)
  expect(primLength(round)).toBeLessThan(primLength(sharp))
})
