import type { ModelPart, ModelSpec, Prim, Pt, SvgDoc, SvgNode, ViewBox } from '../types'
import { num, primPts } from '../lib/geometry'
import { fitIso, isoDepth, isoToViewBox, ISO, planToWorld, type V3 } from '../lib/iso'
import { inRev } from '../lib/route'

/**
 * The isometric print: the ModelSpec projected at build time at az 45° and
 * el 35.26° (SCENE), framed exactly like the rig's end pose (fitIso).
 *
 * W4 (M3): two-tone faces, the top lighter (alu-100 over alu-300 sides;
 * orange over orange-dark), with clean thin edges. Ordering is per part, not
 * per face: parts (and each straight run of a pipe) sort back to front by the
 * plan depth of their footprint, and inside a part its sides draw back to
 * front and its top last. So a face of a far part never lands over a near
 * part, and pipes pass behind or in front of boxes where they really are.
 * No packets, no occlusion masks, no keyframes (cut 1).
 */

interface Face {
  pts: Pt[]
  fill: string
}

interface Item {
  /** Plan depth toward the camera of the footprint (larger is nearer). */
  depth: number
  part: string
  faces: Face[]
  /** Pipe and open-run polylines (drawn as a thick line). */
  runs: Pt[][]
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

/** Depth on the ground plane only (height never reorders parts). */
const planDepth = (pts: readonly Pt[]): number => {
  const c = centroid3(pts.map((q) => planToWorld(q, 0)))
  return c[0] * ISO.b[0] + c[2] * ISO.b[2]
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
  const items: Item[] = []
  for (const p of spec.parts) {
    if (o.rev && !inRev(p, o.rev)) continue
    const z0 = p.z ?? 0
    const z1 = z0 + p.depth
    const orange = p.material === 'orange'
    for (const f of footprint(p)) {
      if (!f.closed || p.kind === 'pipe') {
        // pipes and open runs: one item per straight run, a line at mid height
        for (let i = 1; i < f.pts.length; i++) {
          const seg = [f.pts[i - 1]!, f.pts[i]!]
          items.push({
            depth: planDepth(seg),
            part: p.id,
            faces: [],
            runs: [seg.map((q) => P(planToWorld(q, (z0 + z1) / 2)))],
          })
        }
        continue
      }
      // positive area = clockwise on screen (y down), where (dy, -dx) already points outward
      const ccw = signedArea(f.pts) <= 0
      const n = f.pts.length
      const sides: { face: Face; d: number }[] = []
      for (let i = 0; i < n; i++) {
        const a = f.pts[i]!
        const b = f.pts[(i + 1) % n]!
        let nx = b[1] - a[1]
        let ny = -(b[0] - a[0])
        if (ccw) {
          nx = -nx
          ny = -ny
        }
        if (nx * ISO.b[0] + ny * ISO.b[2] <= 1e-9) continue
        const ws: V3[] = [
          planToWorld(a, z0),
          planToWorld(b, z0),
          planToWorld(b, z1),
          planToWorld(a, z1),
        ]
        sides.push({
          face: { pts: ws.map(P), fill: orange ? 'orange-dark' : 'alu-300' },
          d: isoDepth(centroid3(ws)),
        })
      }
      sides.sort((x, y) => x.d - y.d)
      items.push({
        depth: planDepth(f.pts),
        part: p.id,
        faces: [
          ...sides.map((s) => s.face),
          { pts: f.pts.map((q) => P(planToWorld(q, z1))), fill: orange ? 'orange' : 'alu-100' },
        ],
        runs: [],
      })
    }
  }
  // stable back-to-front: plan depth, then part id, then authoring order
  const order = items.map((it, k) => ({ it, k }))
  order.sort(
    (a, b) =>
      a.it.depth - b.it.depth ||
      (a.it.part < b.it.part ? -1 : a.it.part > b.it.part ? 1 : a.k - b.k),
  )
  const d = (pts: readonly Pt[], closed: boolean) =>
    `M${pts.map((q) => `${num(q[0])} ${num(q[1])}`).join('L')}${closed ? 'Z' : ''}`
  const children: SvgNode[] = []
  let i = 0
  for (const { it } of order) {
    for (const f of it.faces)
      children.push({
        el: 'path',
        d: d(f.pts, true),
        len: 0,
        part: it.part,
        i: i++,
        cls: `f-${f.fill} p-018 i-cyan-dim`,
      })
    for (const r of it.runs)
      children.push({
        el: 'path',
        d: d(r, false),
        len: 0,
        part: it.part,
        i: i++,
        cls: 'p-070 i-cyan',
      })
  }
  return { viewBox: vb, groups: [{ layer: 'iso', children }] }
}
