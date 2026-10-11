import type { ModelPart, ModelSpec, Prim, Pt, SvgDoc, SvgNode, ViewBox } from '../types'
import { num, primPts } from '../lib/geometry'
import { fitIso, isoDepth, isoToViewBox, ISO, planToWorld, type V3 } from '../lib/iso'
import { inRev } from '../lib/route'

/**
 * The isometric print: the ModelSpec projected at build time at az 45° and
 * el 35.26° (SCENE), framed exactly like the rig's end pose (fitIso), drawn as
 * flat three-tone faces sorted back to front (top alu-100, south alu-300,
 * east alu-500; orange parts orange and orange-dark) with 55% cyan edges. No
 * packets, no occlusion masks, no keyframes (cut 1).
 */

interface Face {
  pts: Pt[]
  depth: number
  fill: string
  part: string
}

function footprint(p: ModelPart): { pts: Pt[]; closed: boolean }[] {
  return p.prims.map((prim: Prim) => {
    switch (prim.t) {
      case 'rect':
        return { pts: primPts(prim), closed: true }
      case 'circle':
        return { pts: primPts(prim, 24), closed: true }
      case 'poly':
        return { pts: [...prim.pts], closed: prim.closed ?? false }
      default:
        return { pts: primPts(prim, 12), closed: false }
    }
  })
}

const signedArea = (pts: readonly Pt[]) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

const centroid3 = (ws: readonly V3[]): V3 => {
  const n = ws.length || 1
  return [
    ws.reduce((s, w) => s + w[0], 0) / n,
    ws.reduce((s, w) => s + w[1], 0) / n,
    ws.reduce((s, w) => s + w[2], 0) / n,
  ]
}

/** All model corners in world space, for framing. */
export function modelBounds(spec: ModelSpec, rev?: string): V3[] {
  const out: V3[] = []
  for (const p of spec.parts) {
    if (rev && !inRev(p, rev)) continue
    const z0 = p.z ?? 0
    for (const f of footprint(p))
      for (const q of f.pts) out.push(planToWorld(q, z0), planToWorld(q, z0 + p.depth))
  }
  return out
}

/** The iso print as an SvgDoc in the plan's viewBox (layer 'iso'). */
export function isoPrintDoc(spec: ModelSpec, o: { rev?: string; viewBox?: ViewBox } = {}): SvgDoc {
  const vb = o.viewBox ?? spec.viewBox
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(spec, o.rev))
  const P = (w: V3) => isoToViewBox(w, vb, fit)
  const faces: Face[] = []
  const lines: { pts: Pt[]; depth: number; part: string }[] = []
  for (const p of spec.parts) {
    if (o.rev && !inRev(p, o.rev)) continue
    const z0 = p.z ?? 0
    const z1 = z0 + p.depth
    const orange = p.material === 'orange'
    for (const f of footprint(p)) {
      if (!f.closed || p.kind === 'pipe') {
        // pipes and open runs: a line at mid height
        const ws = f.pts.map((q) => planToWorld(q, (z0 + z1) / 2))
        lines.push({ pts: ws.map(P), depth: isoDepth(centroid3(ws)), part: p.id })
        continue
      }
      // positive area = clockwise on screen (y down), where (dy, -dx) already points outward
      const ccw = signedArea(f.pts) <= 0
      const n = f.pts.length
      for (let i = 0; i < n; i++) {
        const a = f.pts[i]!
        const b = f.pts[(i + 1) % n]!
        let nx = b[1] - a[1]
        let ny = -(b[0] - a[0])
        if (ccw) {
          nx = -nx
          ny = -ny
        }
        const nw: V3 = [nx, 0, ny]
        if (nw[0] * ISO.b[0] + nw[2] * ISO.b[2] <= 1e-9) continue
        const ws: V3[] = [
          planToWorld(a, z0),
          planToWorld(b, z0),
          planToWorld(b, z1),
          planToWorld(a, z1),
        ]
        const south = Math.abs(ny) >= Math.abs(nx)
        faces.push({
          pts: ws.map(P),
          depth: isoDepth(centroid3(ws)),
          fill: orange ? 'orange-dark' : south ? 'alu-300' : 'alu-500',
          part: p.id,
        })
      }
      const top = f.pts.map((q) => planToWorld(q, z1))
      faces.push({
        pts: top.map(P),
        depth: isoDepth(centroid3(top)) + 1e-3,
        fill: orange ? 'orange' : 'alu-100',
        part: p.id,
      })
    }
  }
  faces.sort((a, b) => a.depth - b.depth || (a.part < b.part ? -1 : 1))
  lines.sort((a, b) => a.depth - b.depth)
  const d = (pts: readonly Pt[], closed: boolean) =>
    `M${pts.map((q) => `${num(q[0])} ${num(q[1])}`).join('L')}${closed ? 'Z' : ''}`
  const children: SvgNode[] = [
    ...faces.map((f, i) => ({
      el: 'path' as const,
      d: d(f.pts, true),
      len: 0,
      part: f.part,
      i,
      cls: `f-${f.fill} p-018 i-cyan-dim`,
    })),
    ...lines.map((l, i) => ({
      el: 'path' as const,
      d: d(l.pts, false),
      len: 0,
      part: l.part,
      i: faces.length + i,
      cls: 'p-070 i-cyan',
    })),
  ]
  return { viewBox: vb, groups: [{ layer: 'iso', children }] }
}
