import {
  CapsuleGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type MeshBasicMaterial,
} from 'three'
import type { RoutePath } from './pipes'

/**
 * Packets (§2.5): beads on the pipes. One InstancedMesh per scene
 * (frustumCulled false: its bounding sphere is computed once). Data never
 * eases: s(ms) is linear at `speed` (units per second), flat during holds,
 * hidden before t0 and after the end. Unlit orange, never tone mapped.
 */

export interface PacketPlan {
  path: RoutePath
  /** Mechanism ms when the packet leaves the source. */
  t0: number
  /** Units per second (FLOW.speed or the figure's own). */
  speed: number
  /** Pauses at arc length s for ms (a valve, a tank). */
  holds?: readonly { s: number; ms: number }[]
}

const _m = new Matrix4()
const _p = new Vector3()
const _a = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const UP = new Vector3(0, 1, 0)
const ZERO = new Matrix4().makeScale(0, 0, 0)

/** Arc length at mechanism time ms, or -1 when the packet is not on the line. */
export function packetS(plan: PacketPlan, ms: number): number {
  let t = ms - plan.t0
  if (t < 0) return -1
  let s = 0
  const v = plan.speed / 1000
  for (const h of plan.holds ?? []) {
    const reach = (h.s - s) / v
    if (t <= reach) return s + t * v
    t -= reach
    s = h.s
    if (t <= h.ms) return s
    t -= h.ms
  }
  s += t * v
  return s > plan.path.length ? -1 : s
}

export class PacketField {
  readonly mesh: InstancedMesh

  constructor(
    readonly max: number,
    mat: MeshBasicMaterial,
    radius = 6.5,
    length = 10,
  ) {
    this.mesh = new InstancedMesh(new CapsuleGeometry(radius, length, 4, 10), mat, max)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, ZERO)
  }

  update(ms: number, plans: readonly PacketPlan[]): number {
    let n = 0
    for (const plan of plans) {
      if (n >= this.max) break
      const s = packetS(plan, ms)
      if (s < 0) continue
      const L = plan.path.length || 1
      plan.path.getPoint(s / L, _p)
      plan.path.getPoint(Math.min(1, (s + 1) / L), _a)
      _a.sub(_p)
      if (_a.lengthSq() < 1e-9) _a.copy(UP)
      _q.setFromUnitVectors(UP, _a.normalize())
      this.mesh.setMatrixAt(n++, _m.compose(_p, _q, _s.set(1, 1, 1)))
    }
    for (let i = n; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO)
    this.mesh.instanceMatrix.needsUpdate = true
    return n
  }

  /** Hides every packet (the hand-off frame has none in flight). */
  clear(): void {
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, ZERO)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.dispose()
  }
}
