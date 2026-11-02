/**
 * Camera rig. Every chapter shares one pose model: a target in plan inches, a distance and a view
 * direction (pitch, yaw). Chapter 1 looks straight down, so the flat plan reads as an orthographic
 * drawing; chapter 2 swings out to 3/4 views. Every pose is framed with a lens shift
 * (setViewOffset), which puts the frame centre on the optical axis without distorting anything.
 */
import { MathUtils, type PerspectiveCamera } from 'three'
import type { Box3, Vec3 } from '@/lib/framing/types'
import { dot } from '@/lib/framing/vec3'
import type { Rect } from '@/lib/geom/rect'
import type { CameraKey } from '@/scene/chapters/types'

export const FOV = 20
const TAN_HALF = Math.tan(MathUtils.degToRad(FOV / 2))

/** Canvas size and the frame rect inside it, in CSS px. */
export interface Layout {
  W: number
  H: number
  dpr: number
  frame: { x: number; y: number; w: number; h: number }
  wide: boolean
}

/**
 * A camera pose in plan inches and radians. The target (cx, cy, cz) is on the optical axis,
 * `distance` in front of the lens. pitch −π/2 looks straight down. yaw turns the view about plan
 * +Z: 0 looks north, and +yaw turns the view toward the west (the lens swings east).
 */
export interface Pose {
  cx: number
  cy: number
  cz: number
  distance: number
  pitch: number
  yaw: number
}

/** Chapter 1's view: straight down at the plan, north up. */
export const TOP_DOWN: Readonly<Pick<Pose, 'cz' | 'pitch' | 'yaw'>> = { cz: 0, pitch: -Math.PI / 2, yaw: 0 }

/** The lens axes in plan space, as Euler(pitch, yaw, 0, 'YXZ') turns a camera that looks down −Z. */
export function viewBasis(pitch: number, yaw: number): { right: Vec3; up: Vec3; fwd: Vec3 } {
  // cos(−π/2) is 6e-17 in floating point. Snapping it to 0 keeps every top-down pose bit-exact.
  const cp = pitch === -Math.PI / 2 ? 0 : Math.cos(pitch)
  const sp = Math.sin(pitch)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { right: [c, s, 0], up: [sp * s, -sp * c, cp], fwd: [-cp * s, cp * c, sp] }
}

/** The top-down pose that fits a plan box into the frame, padded, and its scale in px per inch. */
export function fitBox(box: Rect, layout: Layout, pad: number): Pose & { pxPerIn: number } {
  const w = (box[2] - box[0]) * pad
  const h = (box[3] - box[1]) * pad
  const pxPerIn = Math.min(layout.frame.w / w, layout.frame.h / h)
  const cx = (box[0] + box[2]) / 2
  const cy = (box[1] + box[3]) / 2
  return { ...TOP_DOWN, cx, cy, distance: distanceFor(pxPerIn, layout), pxPerIn }
}

/** Scale ↔ distance. Exact top-down; for a 3D pose, the scale at the target's depth. */
export const distanceFor = (pxPerIn: number, layout: Layout): number => layout.H / (2 * TAN_HALF * pxPerIn)
export const pxPerInAt = (distance: number, layout: Layout): number => layout.H / (2 * TAN_HALF * distance)

const corners = ([lo, hi]: Box3): Vec3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [(i & 1 ? hi : lo)[0], (i & 2 ? hi : lo)[1], (i & 4 ? hi : lo)[2]])

/**
 * The pose that fits a 3D box into the frame, padded, seen from (pitch, yaw). It is an exact
 * perspective fit of the 8 corners: the binding axis touches the padded edge, and both axes are
 * centred, so the projected extents sit symmetric about the frame centre. The target is the point
 * on the optical axis at the box centre's depth, so blends between shots orbit the subject.
 */
export function fitBox3(box: Box3, pitch: number, yaw: number, layout: Layout, pad: number): Pose {
  const [b0, b1] = box
  const centre: Vec3 = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, (b0[2] + b1[2]) / 2]
  return fitPoints(corners(box), pitch, yaw, layout, pad, centre)
}

/**
 * fitBox3 for any set of plan points, e.g. a shape's extremePoints, so empty box corners (above a
 * gable's eaves, say) don't shrink the subject. The target sits on the optical axis at `centre`'s depth.
 */
export function fitPoints(
  points: readonly Vec3[],
  pitch: number,
  yaw: number,
  layout: Layout,
  pad: number,
  centre: Vec3,
): Pose {
  const { right, up, fwd } = viewBasis(pitch, yaw)
  const focal = layout.H / (2 * TAN_HALF)
  // The padded frame's half-size on each screen axis, as the tangent of the half-angle it subtends.
  const half = [layout.frame.w / (2 * focal * pad), layout.frame.h / (2 * focal * pad)] as const
  // Corners in view coordinates: [along right, along up, along fwd].
  const P = points.map((q) => [dot(q, right), dot(q, up), dot(q, fwd)] as const)

  // A lens at offset m on screen axis k and depth z along fwd keeps corner q inside the padded
  // frame iff |q[k] − m| ≤ half[k]·(q[2] − z). Over all corners that is m ∈ [lo + half·z, hi − half·z],
  // an interval that closes as the lens moves in. The axis that closes first binds.
  const lo = [-Infinity, -Infinity]
  const hi = [Infinity, Infinity]
  for (const q of P)
    for (const k of [0, 1] as const) {
      lo[k] = Math.max(lo[k], q[k] - half[k] * q[2])
      hi[k] = Math.min(hi[k], q[k] + half[k] * q[2])
    }
  const z = Math.min((hi[0] - lo[0]) / (2 * half[0]), (hi[1] - lo[1]) / (2 * half[1]))

  // Centre each axis on the offset where the extreme projected tangents are equal and opposite.
  // Their sum falls monotonically with m, so bisect it inside the feasible interval, which on the
  // binding axis has already closed to a single point.
  const middle = (k: 0 | 1): number => {
    const spread = (m: number): number => {
      let max = -Infinity
      let min = Infinity
      for (const q of P) {
        const t = (q[k] - m) / (q[2] - z)
        max = Math.max(max, t)
        min = Math.min(min, t)
      }
      return max + min
    }
    const ends = [lo[k] + half[k] * z, hi[k] - half[k] * z]
    let a = Math.min(ends[0], ends[1])
    let b = Math.max(ends[0], ends[1])
    for (let i = 0; i < 64 && a < b; i++) {
      const m = (a + b) / 2
      if (spread(m) > 0) a = m
      else b = m
    }
    return (a + b) / 2
  }
  const x = middle(0)
  const y = middle(1)
  const depth = dot(centre, fwd)
  return {
    cx: x * right[0] + y * up[0] + depth * fwd[0],
    cy: x * right[1] + y * up[1] + depth * fwd[1],
    cz: x * right[2] + y * up[2] + depth * fwd[2],
    distance: depth - z,
    pitch,
    yaw,
  }
}

/**
 * The points of a cloud that lie farthest along n directions spread evenly over the sphere: a cheap
 * stand-in for its convex-hull vertices, which are the only points a perspective fit can bind on.
 * The hull it spans falls short of the true one by about 1% of the cloud's radius at n = 128.
 */
export function extremePoints(points: readonly Vec3[], n = 128): Vec3[] {
  const keep = new Set<number>()
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * i + 1) / n
    const r = Math.sqrt(1 - z * z)
    const d: Vec3 = [r * Math.cos(golden * i), r * Math.sin(golden * i), z]
    let best = -Infinity
    let at = 0
    for (let k = 0; k < points.length; k++) {
      const s = dot(points[k], d)
      if (s > best) {
        best = s
        at = k
      }
    }
    keep.add(at)
  }
  return [...keep].map((k) => points[k])
}

/** Sets every camera property the rig owns from the pose alone, so no frame depends on the last. */
export function applyPose(camera: PerspectiveCamera, pose: Pose, layout: Layout): void {
  const { W, H, frame } = layout
  const d = pose.distance
  const f = viewBasis(pose.pitch, pose.yaw).fwd
  camera.fov = FOV
  camera.aspect = W / H
  // The lens sits `distance` behind the target along the view axis; world = plan (x, z, −y).
  camera.position.set(pose.cx - f[0] * d, pose.cz - f[2] * d, -(pose.cy - f[1] * d))
  // Yaw about world up, then pitch: never singular, even looking straight down.
  camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ')
  camera.near = d * 0.25
  camera.far = d * 4
  camera.setViewOffset(W, H, W / 2 - (frame.x + frame.w / 2), H / 2 - (frame.y + frame.h / 2), W, H)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

/**
 * Where a plan point lands for a pose: CSS px from the canvas's top-left, and its depth in front
 * of the lens in inches. The same projection applyPose sets up, without a camera, so framing can be
 * checked in pure tests.
 */
export function projectPoint(pose: Pose, layout: Layout, q: Vec3): [x: number, y: number, depth: number] {
  const { right, up, fwd } = viewBasis(pose.pitch, pose.yaw)
  const focal = layout.H / (2 * TAN_HALF)
  const r: Vec3 = [q[0] - pose.cx, q[1] - pose.cy, q[2] - pose.cz]
  const depth = dot(r, fwd) + pose.distance
  const { frame } = layout
  const x = frame.x + frame.w / 2 + (focal * dot(r, right)) / depth
  const y = frame.y + frame.h / 2 - (focal * dot(r, up)) / depth
  return [x, y, depth]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Blend poses: target and angles linearly, distance in log space (zooms feel even). Keys never
 * differ by more than π in yaw, so plain lerp takes the short way round.
 */
export const blendPose = (a: Pose, b: Pose, t: number): Pose => ({
  cx: lerp(a.cx, b.cx, t),
  cy: lerp(a.cy, b.cy, t),
  cz: lerp(a.cz, b.cz, t),
  distance: Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), t)),
  pitch: lerp(a.pitch, b.pitch, t),
  yaw: lerp(a.yaw, b.yaw, t),
})

export const inOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** A camera key placed in story time: s = chapter index + the key's chapter progress. */
export type StoryKey = Pick<CameraKey, 'shot' | 'dolly' | 'ease'> & { s: number }

/** Missing shots look down at House No. 1 from well back, rather than failing. */
const FALLBACK: Pose = { ...TOP_DOWN, cx: 288, cy: 192, distance: 3000 }

/**
 * The camera at story time s, from keys sorted by s. Before the first key it holds the first, and
 * past the last it holds the last, so chapters without keys keep the previous pose. Equal-s keys
 * are a cut: at that s the earlier key wins, and the blend after it starts from the later one.
 */
export function poseAt(keys: readonly StoryKey[], poses: ReadonlyMap<string, Pose>, s: number): Pose {
  const keyPose = (k: StoryKey): Pose => {
    const base = poses.get(k.shot) ?? FALLBACK
    return { ...base, distance: base.distance * (k.dolly ?? 1) }
  }
  if (!keys.length) return { ...FALLBACK }
  if (s <= keys[0].s) return keyPose(keys[0])
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (s <= b.s) {
      const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 1
      return blendPose(keyPose(a), keyPose(b), b.ease === 'linear' ? t : inOutCubic(t))
    }
  }
  return keyPose(keys[keys.length - 1])
}
