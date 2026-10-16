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
  /** Pipe and open-run segments in screen space, with the pipe's screen radius h. */
  runs: { pts: Pt[]; h: number; joinA?: boolean; joinB?: boolean }[]
}

function footprint(p: ModelPart): { pts: Pt[]; closed: boolean; round?: boolean }[] {
  return p.prims.map((prim: Prim) => {
    switch (prim.t) {
      case 'rect':
        return { pts: primPts(prim), closed: true }
      case 'circle':
        return { pts: primPts(prim, 24), closed: true, round: true }
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
            runs: [
              {
                pts: seg.map((q) => P(planToWorld(q, (z0 + z1) / 2))),
                // runs that meet another run of the same pipe extend into the joint
                joinA: i > 1,
                joinB: i < f.pts.length - 1,
                // the pipe's screen radius: half its depth, projected
                h:
                  p.material === 'line'
                    ? 0
                    : Math.abs(
                        P(planToWorld(seg[0]!, z1))[1] - P(planToWorld(seg[0]!, (z0 + z1) / 2))[1],
                      ),
              },
            ],
          })
        }
        continue
      }
      // positive area = clockwise on screen (y down), where (dy, -dx) already points outward
      const ccw = signedArea(f.pts) <= 0
      const n = f.pts.length
      const sides: { face: Face; d: number }[] = []
      const facing = (i: number) => {
        const a = f.pts[((i % n) + n) % n]!
        const b = f.pts[(((i + 1) % n) + n) % n]!
        let nx = b[1] - a[1]
        let ny = -(b[0] - a[0])
        if (ccw) {
          nx = -nx
          ny = -ny
        }
        return nx * ISO.b[0] + ny * ISO.b[2] > 1e-9
      }
      if (f.round) {
        // a cylinder's visible side is one smooth band (no facet lines)
        let s = 0
        while (s < n && !(facing(s) && !facing(s - 1))) s++
        const idx: number[] = []
        for (let k = s; idx.length < n && facing(k); k++) idx.push(((k % n) + n) % n)
        if (idx.length) {
          const ring = [...idx, (idx[idx.length - 1]! + 1) % n].map((k) => f.pts[k]!)
          sides.push({
            face: {
              pts: [
                ...ring.map((q) => P(planToWorld(q, z0))),
                ...ring.reverse().map((q) => P(planToWorld(q, z1))),
              ],
              fill: orange ? 'orange-dark' : 'alu-300',
            },
            d: 0,
          })
        }
      }
      for (let i = 0; i < n && !f.round; i++) {
        const a = f.pts[i]!
        const b = f.pts[(i + 1) % n]!
        if (!facing(i)) continue
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
  // one decimal is a tenth of a viewBox unit: invisible, and it keeps the inline hero small
  const n1 = (v: number) => num(Math.round(v * 10) / 10)
  const d = (pts: readonly Pt[], closed: boolean) =>
    `M${pts.map((q) => `${n1(q[0])} ${n1(q[1])}`).join('L')}${closed ? 'Z' : ''}`
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
    for (const r of it.runs) {
      const [a, b] = [r.pts[0]!, r.pts[r.pts.length - 1]!]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (r.h < 1.5 || l < 0.01) {
        children.push({
          el: 'path',
          d: d(r.pts, false),
          len: 0,
          part: it.part,
          i: i++,
          cls: 'p-070 i-cyan',
        })
        continue
      }
      // a tube: a lit aluminum band with clean edges; runs that meet overlap into the joint
      const u: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
      const n: Pt = [-u[1] * r.h, u[0] * r.h]
      const ea = r.joinA ? r.h : 0
      const eb = r.joinB ? r.h : 0
      const A: Pt = [a[0] - u[0] * ea, a[1] - u[1] * ea]
      const B: Pt = [b[0] + u[0] * eb, b[1] + u[1] * eb]
      const band: Pt[] = [
        [A[0] + n[0], A[1] + n[1]],
        [B[0] + n[0], B[1] + n[1]],
        [B[0] - n[0], B[1] - n[1]],
        [A[0] - n[0], A[1] - n[1]],
      ]
      children.push({
        el: 'path',
        d: d(band, true),
        len: 0,
        part: it.part,
        i: i++,
        cls: 'f-alu-300',
      })
      const up = n[1] < 0 ? 1 : -1
      children.push({
        el: 'path',
        d: d([band[0]!, band[1]!], false) + d([band[3]!, band[2]!], false),
        len: 0,
        part: it.part,
        i: i++,
        cls: 'p-018 i-cyan-dim',
      })
      // the highlight along the upper side
      const k = 0.45 * up
      children.push({
        el: 'path',
        d: d(
          [
            [a[0] + n[0] * k, a[1] + n[1] * k],
            [b[0] + n[0] * k, b[1] + n[1] * k],
          ],
          false,
        ),
        len: 0,
        part: it.part,
        i: i++,
        cls: 'p-025 i-paper',
      })
    }
  }
  return { viewBox: vb, groups: [{ layer: 'iso', children }] }
}
