import { describe, expect, it } from 'vitest'
import {
  CONCRETE,
  EDGE,
  GROUND_OPACITY,
  hexToLinear,
  lambert,
  linePx,
  linearToSrgb,
  srgbToLinear,
  SUN_DIR,
  SUN_INTENSITY,
  toneOf,
  WOOD,
  type RGB,
} from '@/lib/framing/look'
import type { Member, Section } from '@/lib/framing/types'
import { len } from '@/lib/framing/vec3'

const TOP = [0, 0, 1] as const
const to8 = (c: number) => Math.round(linearToSrgb(c) * 255)
const rendered = (albedo: string, k: number) => hexToLinear(albedo).map((c) => to8(c * k))

const member = (id: string, section: Section, extra: Partial<Member> = {}): Member => ({
  id,
  kind: 'stud',
  material: section === 'concrete' ? 'concrete' : 'wood',
  section,
  group: 'g',
  c: [0, 0, 0],
  u: [1, 0, 0],
  v: [0, 1, 0],
  size: [92.625, 3.5, 1.5],
  ...extra,
})

/** Many members of every kind of stock, for range checks. */
const SAMPLE: Member[] = Array.from({ length: 600 }, (_, i) => [
  member(`ext-s/stud/k${i}`, '2x4'),
  member(`sill/s/${i}`, '2x6', { kind: 'sill', treated: true }),
  member(`deck/${i}`, 'osb', { kind: 'subfloor' }),
  member(`stem/${i}`, 'concrete', { kind: 'stem-wall' }),
]).flat()

describe('look: lighting', () => {
  it('puts the sun at azimuth 215° and elevation 50°', () => {
    expect(len(SUN_DIR)).toBeCloseTo(1, 12)
    expect(SUN_DIR[0]).toBeCloseTo(-0.369, 3)
    expect(SUN_DIR[1]).toBeCloseTo(-0.527, 3)
    expect(SUN_DIR[2]).toBeCloseTo(0.766, 3)
    expect(SUN_INTENSITY).toBeCloseTo(1.49, 2)
  })

  it('renders a sunlit top face at exactly its albedo', () => {
    expect(lambert(TOP)).toBeCloseTo(1, 12)
    expect(rendered(WOOD.albedo, lambert(TOP))).toEqual([0xe4, 0xcf, 0xa8])
    expect(rendered(CONCRETE.albedo, lambert(TOP))).toEqual([0xd2, 0xd3, 0xd4])
  })

  it('shades the sides: south/top ≈ 0.85, east/top ≈ 0.60', () => {
    const top = lambert(TOP)
    expect(Math.abs(lambert([0, -1, 0]) / top - 0.85)).toBeLessThan(0.01)
    expect(Math.abs(lambert([1, 0, 0]) / top - 0.6)).toBeLessThan(0.01)
    // The sun is south-west: north and east get only the sky, and the west face is lit.
    expect(lambert([0, 1, 0])).toBeCloseTo(lambert([1, 0, 0]), 12)
    expect(lambert([-1, 0, 0])).toBeGreaterThan(lambert([1, 0, 0]))
    // A top face in the sun's shadow gets only the sky.
    expect(lambert(TOP, 0)).toBeCloseTo(2 / Math.PI, 12)
    // The values the design was reviewed at (sRGB 8-bit): top, sunlit south, shaded east.
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(1))
    near(rendered(WOOD.albedo, lambert([0, -1, 0])), [212, 193, 156])
    near(rendered(WOOD.albedo, lambert([1, 0, 0])), [182, 165, 133])
  })

  it('never clips: the brightest face of any toned member stays under 0.9 linear', () => {
    // Over a dense sphere of normals (Fibonacci)...
    let peak = 0
    const N = 20000
    for (let i = 0; i < N; i++) {
      const z = 1 - (2 * (i + 0.5)) / N
      const r = Math.sqrt(1 - z * z)
      const phi = i * Math.PI * (3 - Math.sqrt(5))
      peak = Math.max(peak, lambert([r * Math.cos(phi), r * Math.sin(phi), z]))
    }
    // ...and exactly: where n·L ≥ 0 the response is c + a·n, so its maximum over unit normals is c + |a|.
    const c = lambert([SUN_DIR[1], -SUN_DIR[0], 0]) // level and square to the sun: the sky alone at n·ẑ = 0
    const sun = (lambert(TOP) - lambert(TOP, 0)) / SUN_DIR[2] // I_sun / π
    const tilt = lambert(TOP, 0) - c // the sky's gain per unit of n·ẑ
    const exact = c + Math.hypot(sun * SUN_DIR[0], sun * SUN_DIR[1], sun * SUN_DIR[2] + tilt)
    expect(peak).toBeLessThanOrEqual(exact + 1e-12)
    expect(exact - peak).toBeLessThan(1e-3)
    expect(exact).toBeLessThan(1.11)

    for (const look of [WOOD, CONCRETE]) {
      const albedo = hexToLinear(look.albedo)
      for (const m of SAMPLE) {
        if ((m.material === 'concrete') !== (look === CONCRETE)) continue
        const tone = toneOf(m)
        for (let k = 0; k < 3; k++) expect(albedo[k] * tone[k] * exact).toBeLessThan(0.9)
      }
    }
  })

  it('keeps the page white: full ground shadow is a light grey', () => {
    const ink = 0x1d / 255
    const full = 1 - GROUND_OPACITY + GROUND_OPACITY * ink // ShadowMaterial blends in sRGB over white
    expect(Math.round(full * 255)).toBeGreaterThanOrEqual(225)
    expect(Math.round(full * 255)).toBeLessThanOrEqual(232)
  })

  it('round-trips sRGB the way three does', () => {
    for (let v = 0; v <= 255; v++) expect(to8(srgbToLinear(v / 255))).toBe(v)
  })
})

describe('look: edges', () => {
  it('never draws a line thinner than one device pixel', () => {
    expect(linePx(EDGE.px, 1)).toBe(1)
    expect(linePx(EDGE.px, 2)).toBe(1.5)
    expect(linePx(EDGE.aiPx, 2)).toBe(2)
    expect(EDGE.lod[0]).toBeLessThan(EDGE.lod[1])
    expect(EDGE.aiLod[0]).toBeLessThan(EDGE.aiLod[1])
  })
})

describe('look: tone', () => {
  const studs = SAMPLE.filter((m) => m.section === '2x4')

  it('is seeded per id: deterministic, and neighbours differ', () => {
    expect(toneOf(studs[0])).toEqual(toneOf({ ...studs[0] }))
    expect(toneOf(studs[0])).not.toEqual(toneOf(studs[1]))
  })

  it('varies plain stock ±4% in brightness, with a slight shift toward yellow', () => {
    const reds = studs.map((m) => toneOf(m)[0])
    expect(Math.min(...reds)).toBeGreaterThanOrEqual(0.96)
    expect(Math.max(...reds)).toBeLessThanOrEqual(1.04)
    // The hash actually spreads across the range.
    expect(Math.min(...reds)).toBeLessThan(0.965)
    expect(Math.max(...reds)).toBeGreaterThan(1.035)
    for (const m of studs) {
      const [r, g, b] = toneOf(m)
      expect(g).toBeLessThanOrEqual(r)
      expect(b).toBeLessThanOrEqual(g)
      expect(b / r).toBeGreaterThanOrEqual(0.94 - 1e-12)
    }
  })

  it('gives treated stock and OSB their own tones, and leaves concrete untoned', () => {
    const mean = (ms: Member[]): RGB => {
      const s = [0, 0, 0]
      for (const m of ms) toneOf(m).forEach((v, k) => (s[k] += v / ms.length))
      return [s[0], s[1], s[2]]
    }
    const plain = mean(studs)
    const treated = mean(SAMPLE.filter((m) => m.treated))
    const osb = mean(SAMPLE.filter((m) => m.section === 'osb'))
    // Treated: darker, and greener relative to red.
    expect(treated[0]).toBeLessThan(plain[0] - 0.08)
    expect(treated[1] / treated[0]).toBeGreaterThan(plain[1] / plain[0])
    // OSB: golden, so blue drops the most.
    expect(osb[2] / osb[0]).toBeLessThan(plain[2] / plain[0] - 0.15)
    for (const m of SAMPLE.filter((x) => x.material === 'concrete')) expect(toneOf(m)).toEqual([1, 1, 1])
  })
})
