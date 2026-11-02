/**
 * Oriented boxes for the framing model: builders, the tilt-up rotation and two overlap tests (solid
 * interpenetration and co-planar faces). A box has centre c, grain axis u, width axis v and size
 * [length, width, height]; its height axis is w = u × v, so a box never mirrors.
 */
import type { Box3, Member, Tilt, Vec3 } from '@/lib/framing/types'
import { add, cross, dot, len, lerp3, norm, scale, sub, X, Y, Z } from '@/lib/framing/vec3'
import type { Inch } from '@/lib/units'

export type Box = Pick<Member, 'c' | 'u' | 'v' | 'size'>
export type Grain = 'x' | 'y' | 'z'
export type MemberInfo = Omit<Member, keyof Box>

export const member = (info: MemberInfo, box: Box): Member => ({ ...info, ...box })

/** Grain → [u, v] and which world extents become [length, width, height]. Cyclic, so u × v = w. */
const AXES: Record<Grain, readonly [Vec3, Vec3, readonly [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]]> = {
  x: [X, Y, [0, 1, 2]],
  y: [Y, Z, [1, 2, 0]],
  z: [Z, X, [2, 0, 1]],
}

/** An axis-aligned box from its corners, with the grain along one world axis. */
export function axisBox(min: Vec3, max: Vec3, grain: Grain): Box {
  const [u, v, [i, j, k]] = AXES[grain]
  const d = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  return {
    c: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    u,
    v,
    size: [d[i], d[j], d[k]],
  }
}

/** A box whose centreline runs from p to q, `width` along v (⟂ to the line) and `height` along u × v. */
export function between(p: Vec3, q: Vec3, v: Vec3, width: Inch, height: Inch): Box {
  const d = sub(q, p)
  return { c: lerp3(p, q, 0.5), u: norm(d), v, size: [len(d), width, height] }
}

export const wAxis = (b: Box): Vec3 => cross(b.u, b.v)

/** The 8 corners. */
export function corners(b: Box): Vec3[] {
  const w = wAxis(b)
  const out: Vec3[] = []
  for (const i of [-0.5, 0.5])
    for (const j of [-0.5, 0.5])
      for (const k of [-0.5, 0.5]) {
        const a = i * b.size[0]
        const e = j * b.size[1]
        const f = k * b.size[2]
        out.push([
          b.c[0] + a * b.u[0] + e * b.v[0] + f * w[0],
          b.c[1] + a * b.u[1] + e * b.v[1] + f * w[1],
          b.c[2] + a * b.u[2] + e * b.v[2] + f * w[2],
        ])
      }
  return out
}

/** Axis-aligned bounds; exact for axis-aligned boxes. */
export function aabb(b: Box): Box3 {
  const w = wAxis(b)
  const h = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]
  const e = [0, 1, 2].map(
    (i) => Math.abs(b.u[i]) * h[0] + Math.abs(b.v[i]) * h[1] + Math.abs(w[i]) * h[2],
  )
  return [
    [b.c[0] - e[0], b.c[1] - e[1], b.c[2] - e[2]],
    [b.c[0] + e[0], b.c[1] + e[1], b.c[2] + e[2]],
  ]
}

export function boundsOf(boxes: readonly Box[]): Box3 {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const b of boxes) {
    const [l, h] = aabb(b)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], l[i])
      hi[i] = Math.max(hi[i], h[i])
    }
  }
  return [
    [lo[0], lo[1], lo[2]],
    [hi[0], hi[1], hi[2]],
  ]
}

/** +0 for −0, so exact results compare equal to authored values. */
const clean = (a: Vec3): Vec3 => [a[0] + 0, a[1] + 0, a[2] + 0]

/** x turned +90° about the unit axis a (right-handed). Exact when a and x are axis-aligned. */
export const rot90 = (a: Vec3, x: Vec3): Vec3 => clean(add(scale(a, dot(a, x)), cross(a, x)))

/** x turned by `angle` about the unit axis a (Rodrigues). */
export function rotate(a: Vec3, angle: number, x: Vec3): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot(a, x) * (1 - c)
  const ax = cross(a, x)
  return [
    x[0] * c + ax[0] * s + a[0] * k,
    x[1] * c + ax[1] * s + a[1] * k,
    x[2] * c + ax[2] * s + a[2] * k,
  ]
}

/** A tilt-up member lying in its flat frame: turned +90° about the hinge, outside face up. */
export function flatPose(m: Box, t: Tilt): Box {
  return {
    c: add(t.pivot, rot90(t.axis, sub(m.c, t.pivot))),
    u: rot90(t.axis, m.u),
    v: rot90(t.axis, m.v),
    size: m.size,
  }
}

/** A tilt-up member part way up: angle 0 is standing (home), π/2 lying flat. */
export function tiltPose(m: Box, t: Tilt, angle: number): Box {
  if (angle === Math.PI / 2) return flatPose(m, t)
  return {
    c: add(t.pivot, rotate(t.axis, angle, sub(m.c, t.pivot))),
    u: rotate(t.axis, angle, m.u),
    v: rotate(t.axis, angle, m.v),
    size: m.size,
  }
}

/**
 * How far two boxes interpenetrate along their best separating axis (separating-axis test over
 * the 15 box axes). ≤ 0 means apart or only touching.
 */
export function obbOverlap(a: Box, b: Box): number {
  const A = [a.u, a.v, wAxis(a)]
  const B = [b.u, b.v, wAxis(b)]
  const ha = [a.size[0] / 2, a.size[1] / 2, a.size[2] / 2]
  const hb = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]
  const d = sub(b.c, a.c)
  let depth = Infinity
  const along = (L: Vec3): boolean => {
    const l = len(L)
    if (l < 1e-9) return true
    let r = -Math.abs(dot(d, L))
    for (let i = 0; i < 3; i++) r += ha[i] * Math.abs(dot(A[i], L)) + hb[i] * Math.abs(dot(B[i], L))
    depth = Math.min(depth, r / l)
    return depth > 0
  }
  for (const x of A) if (!along(x)) return depth
  for (const x of B) if (!along(x)) return depth
  for (const x of A) for (const y of B) if (!along(cross(x, y))) return depth
  return depth
}

/** One face of a box: outward normal n, plane offset d = n·p, centre and in-plane half extents. */
interface Face {
  owner: number
  n: Vec3
  d: number
  c: Vec3
  e: readonly [Vec3, Vec3]
  h: readonly [number, number]
  lo: Vec3
  hi: Vec3
}

function facesOf(b: Box, owner: number): Face[] {
  const axes = [b.u, b.v, wAxis(b)]
  const h = [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]
  const out: Face[] = []
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3
    const k = (i + 2) % 3
    for (const sign of [1, -1]) {
      const n = scale(axes[i], sign)
      const c = add(b.c, scale(axes[i], sign * h[i]))
      const ext = [0, 1, 2].map((q) => Math.abs(axes[j][q]) * h[j] + Math.abs(axes[k][q]) * h[k])
      out.push({
        owner,
        n,
        d: dot(n, c),
        c,
        e: [axes[j], axes[k]],
        h: [h[j], h[k]],
        lo: [c[0] - ext[0], c[1] - ext[1], c[2] - ext[2]],
        hi: [c[0] + ext[0], c[1] + ext[1], c[2] + ext[2]],
      })
    }
  }
  return out
}

/** Area two co-planar faces share once each is shrunk by `tol` on every side. */
function sharedArea(f: Face, g: Face, tol: number): number {
  const fx = f.h[0] - tol
  const fy = f.h[1] - tol
  const gx = g.h[0] - tol
  const gy = g.h[1] - tol
  if (fx <= 0 || fy <= 0 || gx <= 0 || gy <= 0) return 0
  // g's corners in f's in-plane coordinates, then clipped to f's rectangle.
  let poly: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([a, b]) => {
    const p = add(g.c, add(scale(g.e[0], a * gx), scale(g.e[1], b * gy)))
    const q = sub(p, f.c)
    return [dot(q, f.e[0]), dot(q, f.e[1])]
  })
  const clip = (inside: (p: [number, number]) => number) => {
    const out: [number, number][] = []
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const dp = inside(p)
      const dq = inside(q)
      if (dp >= 0) out.push(p)
      if (dp >= 0 !== dq >= 0) {
        const t = dp / (dp - dq)
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
      }
    }
    poly = out
  }
  clip((p) => fx - p[0])
  clip((p) => fx + p[0])
  clip((p) => fy - p[1])
  clip((p) => fy + p[1])
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    area += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(area) / 2
}

/**
 * Pairs of boxes with faces in the same plane (within `tol`), facing the same way and sharing
 * area: the faces that would z-fight. Faces that face each other, or only touch along an edge,
 * are fine.
 */
export function faceClashes(
  boxes: readonly Box[],
  tol: Inch = 1 / 64,
): (readonly [number, number])[] {
  const groups = new Map<string, Face[]>()
  boxes.forEach((b, i) => {
    for (const f of facesOf(b, i)) {
      const key = f.n.map((x) => Math.round(x * 1e4)).join(',')
      const list = groups.get(key)
      if (list) list.push(f)
      else groups.set(key, [f])
    }
  })
  const seen = new Set<string>()
  const out: (readonly [number, number])[] = []
  for (const faces of groups.values()) {
    faces.sort((p, q) => p.d - q.d)
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i]
      for (let j = i + 1; j < faces.length && faces[j].d - f.d <= tol; j++) {
        const g = faces[j]
        if (g.owner === f.owner || dot(f.n, g.n) < 1 - 1e-9) continue
        if ([0, 1, 2].some((q) => f.lo[q] - tol > g.hi[q] || g.lo[q] - tol > f.hi[q])) continue
        if (sharedArea(f, g, tol) <= 1e-9) continue
        const pair = [Math.min(f.owner, g.owner), Math.max(f.owner, g.owner)] as const
        const key = `${pair[0]}:${pair[1]}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push(pair)
        }
      }
    }
  }
  return out
}
