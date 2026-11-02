/**
 * How chapter 2's frame looks: albedos, edge and end-grain factors, per-member tone, the two lights
 * and the shadow settings. Pure data, plus the Lambert maths three runs, so every number can be
 * checked in Node (look.test.ts) before anything renders. scene/build/lumber.ts turns it into three
 * objects.
 *
 * Light model (MeshLambertMaterial under NoToneMapping with sRGB output, three r187):
 *   out = albedo · tone · (I_sun · max(n·L, 0) · lit + hemi(n)) / π
 *   hemi(n) = I_hemi · mix(ground, sky, ½ + ½ n·ẑ)
 * The sun's intensity is solved so a sunlit top face renders at exactly its albedo. The brightest
 * possible face (tipped toward the sun) stays under 0.9 linear in every channel, so wood never clips
 * and the page's white stays the only white. The drawing and the page are unlit.
 */
import type { Member, Vec3 } from '@/lib/framing/types'
import { dot } from '@/lib/framing/vec3'

/** Linear-light RGB: a colour or a per-channel multiplier. */
export type RGB = readonly [r: number, g: number, b: number]

export interface Look {
  /** Albedo, sRGB hex. three converts it to linear. */
  albedo: string
  /** Settled edge colour = the lit face colour × edge. */
  edge: number
  /** Linear multiplier on the cut ends: the unit box's ±x faces, i.e. the member's ±u ends. */
  endGrain: RGB
}

/**
 * Pale kiln-dried SPF, the colour of fresh studs. Light enough that the frame reads as the drawing
 * turned solid; dark enough to stand off white paper (L* ≈ 84 on a sunlit top, against 100). Settled
 * edges are the lit colour halved: a soft pencil line on each face, never black. Sawn end grain reads
 * darker and warmer. It is one multiplier, because real grain is sub-pixel at about 1 px per inch.
 */
export const WOOD: Look = { albedo: '#e4cfa8', edge: 0.5, endGrain: [0.8, 0.7, 0.58] }

/** Cured concrete: a neutral grey a step under the wood. Its faces are broad, so its edge is lighter. No grain. */
export const CONCRETE: Look = { albedo: '#d2d3d4', edge: 0.65, endGrain: [1, 1, 1] }

/**
 * Sky fill: white overhead and a just-grey ground, so faces turned down lose a little light. Both are
 * neutral, so the response is the same in every channel and the wood keeps its own hue.
 */
export const HEMI = { sky: '#ffffff', ground: '#f2f2f2', intensity: 2 } as const

/**
 * The sun, fixed in plan space. Azimuth is clockwise from north and elevation is above the horizon,
 * both in degrees. It is high and in the south-west, well to the left of chapter 2's 3/4 views from
 * the south-east. So the tops are brightest, the south front is lit, the east side is in shade, and
 * shadows fall to the north-east (behind the house and to the right on screen).
 */
export const SUN = { color: '#ffffff', azimuth: 215, elevation: 50 } as const

const DEG = Math.PI / 180

/** Unit vector toward the sun in plan space (+x east, +y north, +z up). */
export function sunDirection(azimuth: number, elevation: number): Vec3 {
  const a = azimuth * DEG
  const e = elevation * DEG
  return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)]
}

export const SUN_DIR: Vec3 = sunDirection(SUN.azimuth, SUN.elevation)

/** Solved for a sunlit top face at exactly its albedo: (I_sun·sin(elevation) + I_hemi·sky) / π = 1. ≈ 1.49. */
export const SUN_INTENSITY = (Math.PI - HEMI.intensity) / Math.sin(SUN.elevation * DEG)

/**
 * Sun shadows. The map is fitted to the finished frame (lib/framing/shadow.ts), which gives about
 * 0.4″ per texel at 2048².
 * - PCFShadowMap: r187 removed PCFSoftShadowMap and warns if it is set, and the shots fail on warnings.
 * - radius 2 is about ±0.8″, close to a real sun's penumbra at this scale.
 * - normalBias is in inches, because the plan-space root is unscaled.
 * - bias is in shadow depth: about −0.1″ over the ~3,400″ depth range.
 * - The camera sits `distance` up-sun of the frame with its near plane 1″ from the light. Members in
 *   flight above the house therefore stay inside the depth range and still cast.
 */
export const SHADOW = {
  mapSize: 2048,
  radius: 2,
  normalBias: 0.5,
  bias: -3e-5,
  margin: 24,
  distance: 3000,
  near: 1,
} as const

/** Peak opacity of ink-coloured shadow on the ground. Full shadow reads about #e4e4e4 on the white page. */
export const GROUND_OPACITY = 0.12

/**
 * Edge lines, drawn per face from screen-space derivatives (scene/materials/LumberMaterial.ts).
 * - Widths are CSS px, never under one device px.
 * - A face's line fades in as the face's short side on screen grows from lod[0] to lod[1] line widths.
 *   Thin faces (a 2x's 1½″ edge at the hold view, almost everything on a phone) carry no line, so the
 *   frame never turns into a black wireframe.
 * - While a member is being placed (ai = 1), its edges draw in AI blue: a little wider, and on
 *   smaller faces.
 */
export const EDGE = { px: 0.75, aiPx: 1, lod: [2, 5], aiLod: [1, 2.5] } as const

/** A CSS line width in device px, never under one. */
export const linePx = (cssPx: number, dpr: number): number => Math.max(1, cssPx * dpr)

// Per-member tone (instanceColor), a linear multiplier on the albedo.
/** Pressure-treated stock (sills, porch posts) reads darker and a touch green. */
const TREATED: RGB = [0.86, 0.9, 0.84]
/** OSB reads golden. */
const OSB: RGB = [0.97, 0.9, 0.72]
/** The far end of the board-to-board hue shift, toward yellow. */
const WARM: RGB = [1, 0.97, 0.94]

/**
 * A member's tone. Boards vary: a seeded ±4% in brightness and a slight shift toward yellow, so no two
 * neighbouring studs match. Concrete is one pour, so it is untoned. Every tone keeps the brightest
 * face under 0.9 linear (look.test.ts).
 */
export function toneOf(m: Member): RGB {
  if (m.material === 'concrete') return [1, 1, 1]
  const t = 1 + 0.08 * (hash01(m.id, 1) - 0.5)
  const h = hash01(m.id, 2)
  const base: RGB = m.treated ? TREATED : m.section === 'osb' ? OSB : [1, 1, 1]
  return [
    t * base[0] * (1 + (WARM[0] - 1) * h),
    t * base[1] * (1 + (WARM[1] - 1) * h),
    t * base[2] * (1 + (WARM[2] - 1) * h),
  ]
}

/** A seeded string hash in [0, 1): FNV-1a, then murmur3's finaliser so ids that differ by one character spread. */
function hash01(s: string, seed: number): number {
  let h = 0x811c9dc5 ^ Math.imul(seed, 0x9e3779b9)
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// ── The maths three runs, for tests and tuning. ─────────────────────────────────────────────────

/** sRGB → linear, exactly as three's ColorManagement converts hex colours. */
export const srgbToLinear = (c: number): number =>
  c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4)

/** Linear → sRGB, exactly as three's colorspace_fragment encodes the output. */
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055)

export function hexToLinear(hex: string): RGB {
  const v = parseInt(hex.slice(1), 16)
  return [srgbToLinear(((v >> 16) & 255) / 255), srgbToLinear(((v >> 8) & 255) / 255), srgbToLinear((v & 255) / 255)]
}

/**
 * three's Lambert response for a face with unit plan normal n, as a multiplier on albedo × tone.
 * lit = 1 in sunlight, 0 inside the sun's shadow.
 */
export function lambert(n: Vec3, lit = 1): number {
  const sky = hexToLinear(HEMI.sky)[0]
  const ground = hexToLinear(HEMI.ground)[0]
  const hemi = HEMI.intensity * (ground + (sky - ground) * (0.5 + 0.5 * n[2]))
  const sun = SUN_INTENSITY * Math.max(0, dot(n, SUN_DIR)) * lit
  return (sun + hemi) / Math.PI
}
