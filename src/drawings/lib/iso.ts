import { SCENE } from '@/styles/tokens'
import type { Pt, ViewBox } from '../types'

/**
 * Isometric maths shared by the build-time iso print and the 3D rig
 * (src/stage/runtime/kit/rig.ts must agree with fitIso; the stage lane's unit
 * test imports this file). Angles come from SCENE in the frozen tokens.
 *
 * Mapping (stage-hero §2.1): plan SVG (x, y) is world (x, 0, y); up is +Y,
 * so a part's height h sits at world y = h. The end pose looks along -b with
 * b = (cos el·sin az, sin el, cos el·cos az); screen right r = up × b,
 * screen up u = b × r. SVG y points down the screen.
 */

export type V3 = readonly [x: number, y: number, z: number]

export const ISO_AZ = (SCENE.isoAzimuthDeg * Math.PI) / 180
export const ISO_EL = (SCENE.isoElevationDeg * Math.PI) / 180

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export interface IsoBasis {
  /** Toward the camera. */
  b: V3
  /** Screen right. */
  r: V3
  /** Screen up. */
  u: V3
}

export function isoBasis(az = ISO_AZ, el = ISO_EL): IsoBasis {
  const b: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]
  const r = norm(cross([0, 1, 0], b))
  const u = cross(b, r)
  return { b, r, u }
}

export const ISO = isoBasis()

/** Plan point (x, y) at height z, in world coordinates. */
export const planToWorld = (p: Pt, z = 0): V3 => [p[0], z, p[1]]

/** Screen coordinates (x right, y down) of a world point, unscaled and uncentred. */
export function isoScreen(w: V3, basis: IsoBasis = ISO): Pt {
  return [dot(w, basis.r), -dot(w, basis.u)]
}

/** Project a plan point at height z to iso screen space (unscaled). */
export const isoProject = (p: Pt, z = 0): Pt => isoScreen(planToWorld(p, z))

/** Depth toward the camera: larger is nearer (painter's order sorts ascending). */
export const isoDepth = (w: V3, basis: IsoBasis = ISO): number => dot(w, basis.b)

export interface IsoFit {
  /** CSS px per user unit at the plan pose (xMidYMid meet). */
  s: number
  /** End-pose camera zoom (1 = the plan scale). */
  zoom: number
  /** Recentred end-pose target, world coordinates. */
  target: V3
  /** Half frustum in user units. */
  hw: number
  hh: number
}

/**
 * The end-pose framing the rig computes in OrthoRig.fit(): the frustum is the
 * CSS box with the viewBox placed as xMidYMid meet; the target is recentred
 * on the projected bounds; zoom fits them inside the frustum with `pad` on
 * each side.
 */
export function fitIso(
  vb: ViewBox,
  cssW: number,
  cssH: number,
  bounds: readonly V3[],
  pad: number = SCENE.padding,
  basis: IsoBasis = ISO,
): IsoFit {
  const s = Math.min(cssW / vb[2], cssH / vb[3])
  const hw = cssW / (2 * s)
  const hh = cssH / (2 * s)
  const t0: V3 = [vb[0] + vb[2] / 2, 0, vb[1] + vb[3] / 2]
  let a0 = Infinity
  let a1 = -Infinity
  let b0 = Infinity
  let b1 = -Infinity
  for (const p of bounds) {
    const v: V3 = [p[0] - t0[0], p[1] - t0[1], p[2] - t0[2]]
    const a = dot(v, basis.r)
    const b = dot(v, basis.u)
    if (a < a0) a0 = a
    if (a > a1) a1 = a
    if (b < b0) b0 = b
    if (b > b1) b1 = b
  }
  const ca = (a0 + a1) / 2
  const cb = (b0 + b1) / 2
  const target: V3 = [
    t0[0] + basis.r[0] * ca + basis.u[0] * cb,
    t0[1] + basis.r[1] * ca + basis.u[1] * cb,
    t0[2] + basis.r[2] * ca + basis.u[2] * cb,
  ]
  const zoom = Math.min(
    (hw * (1 - 2 * pad)) / ((a1 - a0) / 2 || 1),
    (hh * (1 - 2 * pad)) / ((b1 - b0) / 2 || 1),
  )
  return { s, zoom, target, hw, hh }
}

/**
 * Where a world point lands in the plan's viewBox at the end pose, so the iso
 * print lines up with the 3D end frame: centre of the viewBox plus the
 * projected offset from the target, times the zoom.
 */
export function isoToViewBox(w: V3, vb: ViewBox, fit: IsoFit, basis: IsoBasis = ISO): Pt {
  const v: V3 = [w[0] - fit.target[0], w[1] - fit.target[1], w[2] - fit.target[2]]
  return [
    vb[0] + vb[2] / 2 + dot(v, basis.r) * fit.zoom,
    vb[1] + vb[3] / 2 - dot(v, basis.u) * fit.zoom,
  ]
}
