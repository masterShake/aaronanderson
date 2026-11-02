import { describe, expect, it } from 'vitest'
import { SHADOW, SUN_DIR } from '@/lib/framing/look'
import { boxCorners, fitSunShadow, onGround, shadowFootprint } from '@/lib/framing/shadow'
import type { Box3, Vec3 } from '@/lib/framing/types'
import { cross, dot, len, sub } from '@/lib/framing/vec3'

/** House No. 1's frame at home, roughly: trusses, rakes and porch included. */
const BOUNDS: Box3 = [
  [-13, -85, -30],
  [589, 397, 213],
]
const GRADE = -30
const EPS = 1e-9

describe('fitSunShadow', () => {
  const corners = boxCorners(BOUNDS)
  const fit = fitSunShadow(corners, SUN_DIR, SHADOW.margin, GRADE)
  const [x, y, z] = fit.basis
  /** Camera-frame coordinates: right, up, and depth in front of the light. */
  const view = (p: Vec3) => {
    const d = sub(p, fit.position)
    return [dot(d, x), dot(d, y), -dot(d, z)] as const
  }

  it("uses three's lookAt basis: orthonormal and right-handed, x level, y up, z toward the sun", () => {
    for (const a of [x, y, z]) expect(len(a)).toBeCloseTo(1, 12)
    expect(dot(x, y)).toBeCloseTo(0, 12)
    expect(dot(y, z)).toBeCloseTo(0, 12)
    expect(dot(x, z)).toBeCloseTo(0, 12)
    cross(x, y).forEach((v, k) => expect(v).toBeCloseTo(z[k], 12))
    expect(x[2]).toBe(0)
    expect(y[2]).toBeGreaterThan(0)
    z.forEach((v, k) => expect(v).toBeCloseTo(SUN_DIR[k], 12))
    // Aimed at the frame's centre, from up-sun.
    expect(fit.target).toEqual([288, 156, 91.5])
    expect(dot(sub(fit.position, fit.target), z)).toBeGreaterThanOrEqual(SHADOW.distance)
  })

  it('keeps every bounds corner inside the volume with the margin to spare', () => {
    const m = SHADOW.margin
    for (const p of corners) {
      const [px, py, depth] = view(p)
      expect(px).toBeGreaterThanOrEqual(fit.left + m - EPS)
      expect(px).toBeLessThanOrEqual(fit.right - m + EPS)
      expect(py).toBeGreaterThanOrEqual(fit.bottom + m - EPS)
      expect(py).toBeLessThanOrEqual(fit.top - m + EPS)
      expect(depth).toBeGreaterThanOrEqual(fit.near + m)
      expect(depth).toBeLessThanOrEqual(fit.far - m + EPS)
    }
    // The fit is tight: each side is set by some corner.
    const xs = corners.map((p) => view(p)[0])
    expect(Math.min(...xs) - m).toBeCloseTo(fit.left, 9)
    expect(Math.max(...xs) + m).toBeCloseTo(fit.right, 9)
  })

  it("reaches the corners' shadows on the ground, which share their casters' x and y", () => {
    const shadows = onGround(corners, SUN_DIR, GRADE)
    shadows.forEach((s, i) => {
      const [sx, sy, sd] = view(s)
      const [cx, cy, cd] = view(corners[i])
      expect(sx).toBeCloseTo(cx, 9)
      expect(sy).toBeCloseTo(cy, 9)
      expect(sd).toBeGreaterThanOrEqual(cd - EPS)
      expect(sd).toBeLessThanOrEqual(fit.far - SHADOW.margin + EPS)
    })
    // Without the ground, the far plane stops at the frame and its longest shadows would fall outside.
    const bare = fitSunShadow(corners, SUN_DIR)
    expect(bare.far).toBeLessThan(Math.max(...shadows.map((s) => view(s)[2])))
  })

  it('resolves House No. 1 at 0.45″ per texel or finer at 2048²', () => {
    const texel = Math.max(fit.right - fit.left, fit.top - fit.bottom) / SHADOW.mapSize
    expect(texel).toBeLessThanOrEqual(0.45)
    expect(texel).toBeGreaterThan(0.3)
  })

  it('starts the depth range at the light, so members in flight above the frame still cast', () => {
    expect(fit.near).toBe(SHADOW.near)
    const flying: Vec3 = [288, 192, 213 + 96]
    expect(view(flying)[2]).toBeGreaterThan(fit.near)
    // About −0.1″ of depth bias over the range.
    expect(Math.abs(SHADOW.bias * (fit.far - fit.near))).toBeLessThan(0.15)
  })

  it('refuses an overhead sun and an empty fit', () => {
    expect(() => fitSunShadow(corners, [0, 0, 1])).toThrow()
    expect(() => fitSunShadow([], SUN_DIR)).toThrow()
  })
})

describe('shadowFootprint', () => {
  const foot = shadowFootprint(BOUNDS, SUN_DIR, GRADE)

  it('is flat at the ground and covers the base of the frame', () => {
    expect(foot[0][2]).toBe(GRADE)
    expect(foot[1][2]).toBe(GRADE)
    expect(foot[0][0]).toBeLessThanOrEqual(BOUNDS[0][0])
    expect(foot[0][1]).toBeLessThanOrEqual(BOUNDS[0][1])
  })

  it('reaches north-east, away from a south-west sun, by the height over tan(elevation)', () => {
    const run = (BOUNDS[1][2] - GRADE) / Math.tan((50 * Math.PI) / 180)
    expect(foot[1][0] - BOUNDS[1][0]).toBeCloseTo(run * Math.sin((35 * Math.PI) / 180), 6)
    expect(foot[1][1] - BOUNDS[1][1]).toBeCloseTo(run * Math.cos((35 * Math.PI) / 180), 6)
  })

  it("contains every corner's shadow", () => {
    for (const s of onGround(boxCorners(BOUNDS), SUN_DIR, GRADE))
      for (let k = 0; k < 2; k++) {
        expect(s[k]).toBeGreaterThanOrEqual(foot[0][k] - EPS)
        expect(s[k]).toBeLessThanOrEqual(foot[1][k] + EPS)
      }
  })
})
