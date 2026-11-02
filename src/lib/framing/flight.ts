/**
 * The maths of a flight: easings, a seeded random stream per member id, and in-place 3×3 rotations.
 * The schedule poses a member as a rotation of its home axes plus a centre, then writes it as a
 * column-major 4×4 (columns u·L, v·W, w·H, centre) the scene uploads as-is. Nothing here allocates on
 * the hot path, and nothing reads a clock or Math.random, so a pose is a pure function of scroll.
 */

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Hermite step: 0 at e0, 1 at e1, flat at both ends. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

export const outCubic = (k: number): number => 1 - (1 - k) ** 3
export const inOutSine = (k: number): number => (1 - Math.cos(Math.PI * k)) / 2
export const inOutCubic = (k: number): number =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2

/**
 * Eases out past 1 and settles back: 0 at k = 0 and exactly 1 at k = 1. It peaks at
 * 1 + 4c³/(27(c + 1)²) where k = 1 − 2c/(3(c + 1)): 3% at c = 0.9, 1.25% at c = 0.6.
 */
export const outBack = (k: number, c: number): number =>
  1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2

/** FNV-1a: a stable 32-bit seed from a member id. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** mulberry32: a small seeded stream in [0, 1). Neighbouring seeds give unrelated streams. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The same id always draws the same numbers, whatever order members are scheduled in. */
export const rngFor = (id: string): (() => number) => mulberry32(hash32(id))

// ── 3×3 rotations, row-major, nine numbers from offset o. ─────────────────────────────────────

const HALF_PI = Math.PI / 2
// Quarter turns are exact, so a frame lying flat matches geom3's flatPose to the bit.
const cosOf = (a: number) => (a === 0 ? 1 : a === HALF_PI || a === -HALF_PI ? 0 : Math.cos(a))
const sinOf = (a: number) => (a === 0 ? 0 : a === HALF_PI ? 1 : a === -HALF_PI ? -1 : Math.sin(a))

export function identityInto(m: Float64Array, o: number): void {
  m[o] = 1
  m[o + 1] = 0
  m[o + 2] = 0
  m[o + 3] = 0
  m[o + 4] = 1
  m[o + 5] = 0
  m[o + 6] = 0
  m[o + 7] = 0
  m[o + 8] = 1
}

/** The right-handed turn by `angle` about the unit axis (x, y, z) (Rodrigues), as geom3's rotate. */
export function rotationInto(
  m: Float64Array,
  o: number,
  x: number,
  y: number,
  z: number,
  angle: number,
): void {
  const c = cosOf(angle)
  const s = sinOf(angle)
  const t = 1 - c
  m[o] = c + x * x * t
  m[o + 1] = x * y * t - z * s
  m[o + 2] = x * z * t + y * s
  m[o + 3] = y * x * t + z * s
  m[o + 4] = c + y * y * t
  m[o + 5] = y * z * t - x * s
  m[o + 6] = z * x * t - y * s
  m[o + 7] = z * y * t + x * s
  m[o + 8] = c + z * z * t
}

/** out = a·b. out must not alias a or b. */
export function mulInto(
  out: Float64Array,
  oo: number,
  a: Float64Array,
  ao: number,
  b: Float64Array,
  bo: number,
): void {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[oo + r * 3 + c] =
        a[ao + r * 3] * b[bo + c] +
        a[ao + r * 3 + 1] * b[bo + 3 + c] +
        a[ao + r * 3 + 2] * b[bo + 6 + c]
}

/** out = m·(x, y, z). */
export function applyInto(
  out: Float64Array,
  oo: number,
  m: Float64Array,
  mo: number,
  x: number,
  y: number,
  z: number,
): void {
  out[oo] = m[mo] * x + m[mo + 1] * y + m[mo + 2] * z
  out[oo + 1] = m[mo + 3] * x + m[mo + 4] * y + m[mo + 5] * z
  out[oo + 2] = m[mo + 6] * x + m[mo + 7] * y + m[mo + 8] * z
}
