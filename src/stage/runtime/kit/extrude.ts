import { ExtrudeGeometry, Shape, Vector2, type Object3D } from 'three'
import type { Pt } from '@/drawings/types'

/**
 * Extrusions (§2.3). A plan footprint (SVG units) becomes a prism standing
 * on the ground (y = 0), height along +Y. No bevels; flat normals;
 * WorldUVGenerator UVs, so anisotropy brushes along +u. In plan the prism is
 * scaled to EXTRUDE_FLOOR, so its top face sits just above the grid.
 */

export type Rect = readonly [x: number, y: number, w: number, h: number]

export const EXTRUDE_FLOOR = 0.05

const opts = (depth: number, curveSegments = 1) => ({
  depth,
  steps: 1,
  curveSegments,
  bevelEnabled: false,
})

/** (x, −y, z) then rotateX(−90°) gives (x, z, y): footprint = the SVG rect, extrusion = +Y. */
export function extrudeRect([x, y, w, h]: Rect, height: number): ExtrudeGeometry {
  const s = new Shape([
    new Vector2(x, -y),
    new Vector2(x + w, -y),
    new Vector2(x + w, -y - h),
    new Vector2(x, -y - h),
  ])
  return new ExtrudeGeometry(s, opts(height)).rotateX(-Math.PI / 2)
}

export function extrudePoly(
  pts: readonly Pt[],
  height: number,
  curveSegments = 24,
): ExtrudeGeometry {
  const s = new Shape(pts.map(([x, y]) => new Vector2(x, -y)))
  return new ExtrudeGeometry(s, opts(height, curveSegments)).rotateX(-Math.PI / 2)
}

/** A rect's outline at height y (4 segments, 24 numbers). */
export function rectRing([x, y, w, h]: Rect, at: number): number[] {
  const c: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    const a = c[i]!
    const b = c[(i + 1) % 4]!
    out.push(a[0], at, a[1], b[0], at, b[1])
  }
  return out
}

/** The four vertical edges of a box (kept separate: in plan they project to points). */
export function rectVerticals([x, y, w, h]: Rect, height: number): number[] {
  const out: number[] = []
  for (const [px, pz] of [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ] as const)
    out.push(px, 0, pz, px, height, pz)
  return out
}

/** Extrusion progress: t = 0 is the plan floor, 1 is full height. */
export function setExtrude(m: Object3D, t: number): void {
  m.scale.y = Math.max(EXTRUDE_FLOOR, t)
}
