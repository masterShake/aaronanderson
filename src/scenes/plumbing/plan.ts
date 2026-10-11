import { Vector3 } from 'three'
import type { ModelPart, ModelSpec, Pen, Prim, Pt } from '@/drawings/types'

/**
 * The plumbing kit's plan maths (owner: scenes-a; shared by S-02 and S-04). planLines()
 * is src/drawings/lib/frame.ts planFrame()'s line list for the part kinds the plumbing
 * scenes use (rects and polylines), kept here so a scene chunk does not carry the drawing
 * library (lib/frame imports lib/route); a unit test holds it equal to planFrame().
 * modelCorners() is render/iso modelBounds(), for the rig's iso fit.
 */

export interface PlanLine {
  id: string
  pts: Pt[]
  closed: boolean
  pen: Pen
  ink: 'cyan' | 'orange' | 'cyan-dim'
  opacity: number
  r?: number
}

const PEN_OF: Readonly<Record<ModelPart['kind'], Pen>> = {
  box: '050',
  cyl: '050',
  tank: '050',
  pipe: '070',
  flange: '050',
  valve: '050',
  card: '035',
  slot: '035',
}

function outline(p: Prim): { pts: Pt[]; closed: boolean; r?: number } {
  if (p.t === 'rect') {
    const [x, y] = p.at
    const [w, h] = p.size
    return {
      pts: [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      closed: true,
    }
  }
  if (p.t === 'poly')
    return { pts: [...p.pts], closed: p.closed ?? false, ...(p.r ? { r: p.r } : {}) }
  throw new Error(`plumbing: unsupported prim ${p.t}`)
}

export function planLines(spec: ModelSpec): PlanLine[] {
  const out: PlanLine[] = []
  for (const part of spec.parts)
    part.prims.forEach((prim, i) => {
      const o = outline(prim)
      out.push({
        id: part.prims.length > 1 ? `${part.id}.${i}` : part.id,
        pts: o.pts,
        closed: o.closed,
        pen: PEN_OF[part.kind],
        ink: part.material === 'orange' ? 'orange' : part.material === 'line' ? 'cyan-dim' : 'cyan',
        opacity: part.material === 'line' ? 0.55 : 1,
        ...(o.r ? { r: o.r } : {}),
      })
    })
  return out
}

/** Every footprint corner at its base and its top (world: SVG (x, y) is (x, height, y)). */
export function modelCorners(spec: ModelSpec): Vector3[] {
  const out: Vector3[] = []
  for (const part of spec.parts) {
    const z0 = part.z ?? 0
    for (const prim of part.prims)
      for (const [x, y] of outline(prim).pts)
        out.push(new Vector3(x, z0, y), new Vector3(x, z0 + part.depth, y))
  }
  return out
}

/** Segment pairs (6 numbers each) for a closed or open outline at height y. */
export function ringSegments(pts: readonly Pt[], closed: boolean, y: number): number[] {
  const out: number[] = []
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    out.push(a[0], y, a[1], b[0], y, b[1])
  }
  return out
}
