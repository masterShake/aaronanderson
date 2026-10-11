import { Mesh, type Material } from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { extrudeRect, rectRing, rectVerticals, type Rect } from '@/stage/runtime/kit/extrude'
import { segments } from '@/stage/runtime/kit/lines'
import type { RoutePath } from '@/stage/runtime/kit/pipes'

/**
 * Plumbing parts (owner: scenes-a; shared by S-02 and S-04): enclosures with their CAD
 * edges, and a route's plan line. Built from runtime/kit; no drawing library.
 */

export interface Enclosure {
  mesh: Mesh
  /** Vertical edges: hidden in plan (they project to points), shown once extruded. */
  verticals: LineSegments2
}

/** A box on the ground: face material (flat-mixed in plan) plus its outline at base and top. */
export function enclosure(
  rect: Rect,
  height: number,
  face: Material,
  edge: LineMaterial,
): Enclosure {
  const mesh = new Mesh(extrudeRect(rect, height), face)
  const ring = segments([...rectRing(rect, 0), ...rectRing(rect, height)], edge)
  const verticals = segments(rectVerticals(rect, height), edge)
  verticals.visible = false
  mesh.add(ring, verticals)
  return { mesh, verticals }
}

/** The route's centre line at height y as segment pairs, arcs sampled every `step` degrees. */
export function routeSegments(path: RoutePath, y: number, step = 15): number[] {
  const pts: [number, number][] = []
  for (const g of path.segs) {
    if (g.kind === 'line') {
      if (!pts.length) pts.push([g.a.x, g.a.z])
      pts.push([g.b.x, g.b.z])
      continue
    }
    const n = Math.max(2, Math.ceil(Math.abs((g.da * 180) / Math.PI) / step))
    for (let i = 1; i <= n; i++) {
      const a = g.a0 + (g.da * i) / n
      pts.push([g.c.x + Math.cos(a) * g.r, g.c.z + Math.sin(a) * g.r])
    }
  }
  const out: number[] = []
  for (let i = 1; i < pts.length; i++)
    out.push(pts[i - 1]![0], y, pts[i - 1]![1], pts[i]![0], y, pts[i]![1])
  return out
}
