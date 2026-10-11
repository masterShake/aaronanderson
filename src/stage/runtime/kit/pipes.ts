import {
  CylinderGeometry,
  Curve,
  Group,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three'
import type { Pt } from '@/drawings/types'

/**
 * Pipes (§2.4). A route is a right-angle polyline in plan (SVG units) with
 * filleted corners (r = 12 wide, 10 tall), as the CAD layer draws it. The
 * curve maps arc length exactly, so packets and growth run at constant speed.
 * Pipes grow source to sink through the draw range; no end caps.
 */

type Seg =
  | { kind: 'line'; a: Vector3; b: Vector3; len: number }
  | { kind: 'arc'; c: Vector3; r: number; a0: number; da: number; len: number }

export class RoutePath extends Curve<Vector3> {
  readonly segs: Seg[] = []
  readonly length: number

  /** pts: plan points; y: the pipe's centre height; r: fillet radius. */
  constructor(pts: readonly Pt[], y: number, r = 12) {
    super()
    const P = pts.map(([x, z]) => new Vector3(x, y, z))
    let from = P[0]!.clone()
    for (let i = 1; i < P.length - 1; i++) {
      const prev = P[i - 1]!
      const cur = P[i]!
      const next = P[i + 1]!
      const d1 = cur.clone().sub(prev).normalize()
      const d2 = next.clone().sub(cur).normalize()
      const rr = Math.min(r, cur.distanceTo(prev) / 2, cur.distanceTo(next) / 2)
      const t1 = cur.clone().addScaledVector(d1, -rr)
      const t2 = cur.clone().addScaledVector(d2, rr)
      this.line(from, t1)
      const c = cur.clone().addScaledVector(d1, -rr).addScaledVector(d2, rr)
      const a0 = Math.atan2(t1.z - c.z, t1.x - c.x)
      const a1 = Math.atan2(t2.z - c.z, t2.x - c.x)
      let da = a1 - a0
      if (da > Math.PI) da -= 2 * Math.PI
      if (da < -Math.PI) da += 2 * Math.PI
      this.segs.push({ kind: 'arc', c, r: rr, a0, da, len: Math.abs(da) * rr })
      from = t2
    }
    this.line(from, P[P.length - 1]!)
    this.length = this.segs.reduce((s, x) => s + x.len, 0)
  }

  private line(a: Vector3, b: Vector3) {
    const len = a.distanceTo(b)
    if (len > 1e-6) this.segs.push({ kind: 'line', a: a.clone(), b: b.clone(), len })
  }

  override getPoint(t: number, out = new Vector3()): Vector3 {
    let s = Math.min(1, Math.max(0, t)) * this.length
    for (const g of this.segs) {
      if (s <= g.len || g === this.segs[this.segs.length - 1]) {
        const k = g.len ? Math.min(1, s / g.len) : 0
        if (g.kind === 'line') return out.lerpVectors(g.a, g.b, k)
        const a = g.a0 + g.da * k
        return out.set(g.c.x + Math.cos(a) * g.r, g.c.y, g.c.z + Math.sin(a) * g.r)
      }
      s -= g.len
    }
    return out
  }

  override getPointAt(u: number, out = new Vector3()): Vector3 {
    return this.getPoint(u, out)
  }

  override getLength(): number {
    return this.length
  }
}

const RADIAL = 10

export function makePipe(path: RoutePath, radius: number, mat: Material): Mesh<TubeGeometry> {
  const n = Math.max(8, Math.ceil(path.length / 4))
  const g = new TubeGeometry(path, n, radius, RADIAL, false)
  g.userData.n = n
  g.setDrawRange(0, 0)
  return new Mesh(g, mat)
}

/** Growth from source (0) to sink (1). */
export function setGrowth(m: Mesh<TubeGeometry>, t: number): void {
  const n = m.geometry.userData.n as number
  m.geometry.setDrawRange(0, Math.floor(Math.min(1, Math.max(0, t)) * n) * RADIAL * 6)
}

const UP = new Vector3(0, 1, 0)
/** A flange pair: two discs of radius r, 2.5 thick with a 1-unit gap, on the axis `dir`. */
export function makeFlange(at: Vector3, dir: Vector3, r: number, mat: Material): Group {
  const g = new Group()
  const geo = new CylinderGeometry(r, r, 2.5, 24)
  const q = new Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
  for (const s of [-1.75, 1.75]) {
    const disc = new Mesh(geo, mat)
    disc.quaternion.copy(q)
    disc.position.copy(at).addScaledVector(dir.clone().normalize(), s)
    g.add(disc)
  }
  return g
}
