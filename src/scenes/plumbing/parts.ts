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
  /** Service-panel outlines on the south and east faces, when asked for (hidden in plan). */
  panels?: LineSegments2
}

/**
 * The service panels on the two faces the south-east camera sees (south, +z; east, +x):
 * an inset outline standing just proud of each face, so the box reads as a cabinet.
 */
function panels([x, y, w, h]: Rect, height: number, inset: number): number[] {
  const out: number[] = []
  const lo = inset
  const hi = height - inset
  const z = y + h + 0.4
  const e = x + w + 0.4
  const loop = (pts: readonly (readonly [number, number, number])[]) =>
    pts.forEach((a, i) => out.push(...a, ...pts[(i + 1) % pts.length]!))
  loop([
    [x + inset, lo, z],
    [x + w - inset, lo, z],
    [x + w - inset, hi, z],
    [x + inset, hi, z],
  ])
  loop([
    [e, lo, y + inset],
    [e, lo, y + h - inset],
    [e, hi, y + h - inset],
    [e, hi, y + inset],
  ])
  return out
}

/**
 * A box on the ground: face material (flat-mixed in plan) plus its outline at base and top.
 * With `panel` (an inset and a detail line), its south and east faces get service-panel
 * outlines; like the vertical edges, they stay hidden until the scene shows them.
 */
export function enclosure(
  rect: Rect,
  height: number,
  face: Material,
  edge: LineMaterial,
  panel?: { inset: number; line: LineMaterial },
): Enclosure {
  const mesh = new Mesh(extrudeRect(rect, height), face)
  const ring = segments([...rectRing(rect, 0), ...rectRing(rect, height)], edge)
  const verticals = segments(rectVerticals(rect, height), edge)
  verticals.visible = false
  mesh.add(ring, verticals)
  if (!panel) return { mesh, verticals }
  const p = segments(panels(rect, height, panel.inset), panel.line)
  p.visible = false
  mesh.add(p)
  return { mesh, verticals, panels: p }
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
