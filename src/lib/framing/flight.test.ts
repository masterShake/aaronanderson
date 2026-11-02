import { describe, expect, it } from 'vitest'
import {
  applyInto,
  clamp01,
  hash32,
  identityInto,
  inOutCubic,
  inOutSine,
  mulberry32,
  mulInto,
  outBack,
  outCubic,
  rngFor,
  rotationInto,
  smoothstep,
} from '@/lib/framing/flight'
import { rot90, rotate } from '@/lib/framing/geom3'
import type { Vec3 } from '@/lib/framing/types'
import { norm } from '@/lib/framing/vec3'

const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n)
const peak = (f: (k: number) => number) => Math.max(...steps(20000).map(f))
const slope = (f: (k: number) => number, k: number, h = 1e-6) => (f(k + h) - f(k - h)) / (2 * h)

describe('easings', () => {
  it('start at 0 and end at exactly 1', () => {
    for (const f of [outCubic, inOutSine, inOutCubic, (k: number) => outBack(k, 0.9)]) {
      expect(f(0)).toBeCloseTo(0, 12)
      expect(f(1)).toBe(1)
    }
    expect(smoothstep(0.2, 0.4, 0.1)).toBe(0)
    expect(smoothstep(0.25, 0.75, 0.5)).toBe(0.5)
    expect(smoothstep(0.2, 0.4, 0.5)).toBe(1)
    expect([clamp01(-1), clamp01(0.5), clamp01(2)]).toEqual([0, 0.5, 1])
  })

  it('are monotone, except outBack, which overshoots by 4c³/(27(c+1)²)', () => {
    for (const f of [outCubic, inOutSine, inOutCubic, (k: number) => smoothstep(0, 1, k)]) {
      const v = steps(1000).map(f)
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1])
    }
    for (const c of [0.6, 0.9]) {
      const over = 1 + (4 * c ** 3) / (27 * (c + 1) ** 2)
      expect(peak((k) => outBack(k, c))).toBeCloseTo(over, 6)
    }
    expect(peak((k) => outBack(k, 0.9))).toBeLessThanOrEqual(1.031)
    expect(peak((k) => outBack(k, 0.6))).toBeCloseTo(1.0125, 4)
    // c = 0 is a plain outCubic: no overshoot.
    for (const k of steps(10)) expect(outBack(k, 0)).toBeCloseTo(outCubic(k), 12)
  })

  it('arrive at rest, so a flight ends in a vertical set-down', () => {
    expect(Math.abs(slope(outCubic, 1 - 1e-6))).toBeLessThan(1e-4)
    expect(Math.abs(slope(inOutSine, 1 - 1e-6))).toBeLessThan(1e-4)
    expect(Math.abs(slope(inOutCubic, 1 - 1e-6))).toBeLessThan(1e-4)
    expect(Math.abs(slope((k) => outBack(k, 0.9), 1 - 1e-6))).toBeLessThan(1e-4)
  })
})

describe('seeded randomness', () => {
  it('hashes ids with FNV-1a', () => {
    expect(hash32('')).toBe(0x811c9dc5)
    expect(hash32('a')).toBe(0xe40c292c)
    expect(hash32('ext-s/stud/k1')).toBe(hash32('ext-s/stud/k1'))
    expect(hash32('ext-s/stud/k1')).not.toBe(hash32('ext-s/stud/k2'))
  })

  it('draws a stable, roughly uniform stream per seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 20000 }, () => a())
    expect(Array.from({ length: 20000 }, () => b())).toEqual(xs)
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true)
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean).toBeCloseTo(0.5, 2)
    const buckets = new Array(10).fill(0)
    for (const x of xs) buckets[Math.floor(x * 10)]++
    for (const n of buckets) expect(Math.abs(n - 2000)).toBeLessThan(200)
  })

  it('gives neighbouring ids unrelated streams', () => {
    const first = (id: string) => rngFor(id)()
    expect(first('truss/01')).toBe(first('truss/01'))
    const v = Array.from({ length: 200 }, (_, k) => first(`ext-n/stud/k${k}`))
    // Lag-1 correlation of a sweep's first draws stays small.
    const m = v.reduce((s, x) => s + x, 0) / v.length
    let num = 0
    let den = 0
    for (let k = 0; k < v.length; k++) {
      den += (v[k] - m) ** 2
      if (k) num += (v[k] - m) * (v[k - 1] - m)
    }
    expect(Math.abs(num / den)).toBeLessThan(0.2)
  })
})

describe('rotations', () => {
  const rng = mulberry32(7)
  const unit = (): Vec3 => norm([rng() - 0.5, rng() - 0.5, rng() - 0.5])
  const apply = (m: Float64Array, x: Vec3): Vec3 => {
    const out = new Float64Array(3)
    applyInto(out, 0, m, 0, ...x)
    return [out[0], out[1], out[2]]
  }

  it('turn as geom3.rotate does (right-handed)', () => {
    const m = new Float64Array(9)
    for (let n = 0; n < 50; n++) {
      const a = unit()
      const x = unit()
      const angle = (rng() - 0.5) * 4
      rotationInto(m, 0, ...a, angle)
      const got = apply(m, x)
      const want = rotate(a, angle, x)
      for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(want[k], 12)
    }
  })

  it('are exact for quarter turns about the axes, as flatPose is', () => {
    const m = new Float64Array(9)
    const axes: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
    ]
    for (const a of axes) {
      rotationInto(m, 0, ...a, Math.PI / 2)
      for (const x of [
        [3.5, -1.25, 109.125],
        [0, 0, 1],
        [1, 2, 3],
      ] as Vec3[])
        expect(apply(m, x).map((v) => v + 0)).toEqual(rot90(a, x))
    }
    rotationInto(m, 0, 0, 1, 0, 0)
    const id = new Float64Array(9)
    identityInto(id, 0)
    expect(m).toEqual(id)
  })

  it('compose and stay orthonormal', () => {
    const a = new Float64Array(9)
    const b = new Float64Array(9)
    const ab = new Float64Array(9)
    rotationInto(a, 0, ...unit(), 0.7)
    rotationInto(b, 0, ...unit(), -1.3)
    mulInto(ab, 0, a, 0, b, 0)
    const x = unit()
    const want = apply(a, apply(b, x))
    const got = apply(ab, x)
    for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(want[k], 12)
    // Rows are orthonormal: R·Rᵀ = I.
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const d =
          ab[r * 3] * ab[c * 3] + ab[r * 3 + 1] * ab[c * 3 + 1] + ab[r * 3 + 2] * ab[c * 3 + 2]
        expect(d).toBeCloseTo(r === c ? 1 : 0, 12)
      }
  })
})
