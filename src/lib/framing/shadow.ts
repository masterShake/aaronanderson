/**
 * The sun's shadow camera, fitted in plan space, and the shadow's footprint on the ground.
 *
 * three aims a directional light's shadow camera with lookAt, from the light to its target, with
 * world +Y as up. Under the plan-space root (plan (x, y, z) → world (x, z, −y)) that up is plan +Z,
 * so in plan the camera's axes are x = norm(ẑ × L), y = L × x and z = L (toward the sun), and it
 * looks down −L. Fitting the frustum here, with plain numbers, keeps the whole frame inside the map
 * at the finest texel the map size allows; lumber.ts copies the result onto the light.
 */
import { SHADOW } from '@/lib/framing/look'
import type { Box3, Vec3 } from '@/lib/framing/types'
import { add, cross, dot, len, norm, scale, sub, Z } from '@/lib/framing/vec3'

export interface SunShadowFit {
  /** Where the light aims: the centre of the fitted points' bounding box. */
  target: Vec3
  /** The light, and its shadow camera: up-sun of the target. */
  position: Vec3
  /** The shadow camera's axes in plan: right, up and toward the sun. It looks down −z. */
  basis: readonly [x: Vec3, y: Vec3, z: Vec3]
  /** The OrthographicCamera frustum, in inches in the camera's own frame. */
  left: number
  right: number
  bottom: number
  top: number
  near: number
  far: number
}

export function boxCorners([lo, hi]: Box3): Vec3[] {
  const out: Vec3[] = []
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) out.push([x, y, z])
  return out
}

/** Where each point's shadow falls on the plane z = groundZ, traced away from the sun. Points at or below it stay put. */
export function onGround(points: readonly Vec3[], sunDir: Vec3, groundZ: number): Vec3[] {
  const L = norm(sunDir)
  return points.map((p) => {
    if (p[2] <= groundZ) return p
    const k = (p[2] - groundZ) / L[2]
    return [p[0] - L[0] * k, p[1] - L[1] * k, groundZ]
  })
}

/**
 * The sun's orthographic shadow camera around `points` (the frame's bounds corners), with `margin`
 * inches to spare on every side.
 * - With `groundZ`, the far plane also reaches the points' shadows on the ground, which lie deeper
 *   along the light than anything that casts them.
 * - The near plane sits SHADOW.near from the light, so anything between the light and the frame
 *   still casts (members in flight above the house).
 */
export function fitSunShadow(
  points: readonly Vec3[],
  sunDir: Vec3,
  margin: number = SHADOW.margin,
  groundZ?: number,
): SunShadowFit {
  if (!points.length) throw new Error('fitSunShadow: nothing to fit')
  const z = norm(sunDir)
  const across = cross(Z, z)
  if (len(across) < 1e-9) throw new Error('fitSunShadow: an overhead sun has no lookAt basis')
  const x = norm(across)
  const y = cross(z, x)

  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p[k])
      hi[k] = Math.max(hi[k], p[k])
    }
  const target: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
  // Far enough up-sun that every point is at least `margin` past the near plane.
  const reach = Math.max(...points.map((p) => dot(sub(p, target), z)))
  const position = add(target, scale(z, Math.max(SHADOW.distance, reach + margin + SHADOW.near)))

  let left = Infinity
  let right = -Infinity
  let bottom = Infinity
  let top = -Infinity
  let far = -Infinity
  for (const p of points) {
    const d = sub(p, position)
    left = Math.min(left, dot(d, x))
    right = Math.max(right, dot(d, x))
    bottom = Math.min(bottom, dot(d, y))
    top = Math.max(top, dot(d, y))
    far = Math.max(far, -dot(d, z))
  }
  // A shadow lies along the light from its caster, so it shares the caster's x and y: only depth grows.
  if (groundZ !== undefined)
    for (const p of onGround(points, z, groundZ)) far = Math.max(far, -dot(sub(p, position), z))

  return {
    target,
    position,
    basis: [x, y, z],
    left: left - margin,
    right: right + margin,
    bottom: bottom - margin,
    top: top + margin,
    near: SHADOW.near,
    far: far + margin,
  }
}

/** The plan bounding box of a box's shadow on the ground (flat, at groundZ), for fitting cameras around it. */
export function shadowFootprint(bounds: Box3, sunDir: Vec3, groundZ: number): Box3 {
  const pts = onGround(boxCorners(bounds), sunDir, groundZ)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return [
    [Math.min(...xs), Math.min(...ys), groundZ],
    [Math.max(...xs), Math.max(...ys), groundZ],
  ]
}
