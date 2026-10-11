import { Matrix4, OrthographicCamera, Quaternion, Vector3 } from 'three'
import type { ViewBox } from '@/drawings/types'
import { SCENE } from '@/styles/tokens'
import type { SceneRig } from '../../types'

/**
 * Orthographic rig (§2.1). Plan: SVG (x, y) is world (x, 0, y), camera looking
 * down −Y with up −Z, so SVG +y runs down the screen. Front (S-03): SVG (x, y)
 * is world (x, vb.y + vb.h − y, 0), camera looking along −Z. The end pose is
 * the south-east isometric at SCENE.isoAzimuthDeg / SCENE.isoElevationDeg
 * (no literal angles here, W0 addendum 3). pose(0) is the exact SVG frame:
 * the frustum is the CSS box and the viewBox sits in it as
 * preserveAspectRatio="xMidYMid meet" places it.
 */

export type StartPose = 'plan' | 'front'

const D = 4000
const _v = new Vector3()
const _r = new Vector3()
const _u = new Vector3()
const _b = new Vector3()
const _q = new Quaternion()
const _t = new Vector3()
const _m = new Matrix4()

const RAD = Math.PI / 180
export const ISO_AZ = SCENE.isoAzimuthDeg * RAD
export const ISO_EL = SCENE.isoElevationDeg * RAD

export const svgToWorld = (
  pose: StartPose,
  vb: ViewBox,
  x: number,
  y: number,
  out = new Vector3(),
): Vector3 => (pose === 'plan' ? out.set(x, 0, y) : out.set(x, vb[1] + vb[3] - y, 0))

/** The iso camera basis: right, up, back (toward the camera). */
export function isoBasis(az = ISO_AZ, el = ISO_EL) {
  const b = new Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
  const r = new Vector3(0, 1, 0).cross(b).normalize()
  const u = b.clone().cross(r)
  return { r, u, b }
}

/** Screen (right, up) of a world point under the iso basis, in world units. The print's maths. */
export function isoProject(p: Vector3, az = ISO_AZ, el = ISO_EL): [number, number] {
  const { r, u } = isoBasis(az, el)
  return [p.dot(r), p.dot(u)]
}

export class OrthoRig implements SceneRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 2 * D)
  private readonly q0 = new Quaternion()
  private readonly q1 = new Quaternion()
  private readonly t0 = new Vector3()
  private readonly t1 = new Vector3()
  private z1 = 1
  private readonly zfit = new Float32Array(17)
  /** CSS px per viewBox unit at pose 0 (meet). */
  scale = 1
  e = 0

  constructor(
    readonly start: StartPose,
    private readonly pad: number = SCENE.padding,
    az = ISO_AZ,
    el = ISO_EL,
  ) {
    if (start === 'plan') this.q0.setFromAxisAngle(_v.set(1, 0, 0), -Math.PI / 2)
    const { r, u, b } = isoBasis(az, el)
    this.q1.setFromRotationMatrix(_m.makeBasis(r, u, b))
    this.zfit.fill(1)
  }

  /** Frustum = the CSS box; bounds = the model's corners at full height (for the iso fit). */
  fit(vb: ViewBox, cssW: number, cssH: number, bounds: readonly Vector3[]): void {
    const s = Math.min(cssW / vb[2], cssH / vb[3])
    this.scale = s
    const hw = cssW / (2 * s)
    const hh = cssH / (2 * s)
    const c = this.camera
    c.left = -hw
    c.right = hw
    c.top = hh
    c.bottom = -hh
    svgToWorld(this.start, vb, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, this.t0)
    this.t1.copy(this.t0)
    if (bounds.length) {
      this.z1 = this.zoomFor(this.q1, this.t1, hw, hh, bounds, this.pad, true)
      for (let i = 0; i <= 16; i++) {
        _q.slerpQuaternions(this.q0, this.q1, i / 16)
        _t.lerpVectors(this.t0, this.t1, i / 16)
        this.zfit[i] = this.zoomFor(_q, _t, hw, hh, bounds, 0.02, false)
      }
    }
    this.pose(this.e)
  }

  private zoomFor(
    q: Quaternion,
    target: Vector3,
    hw: number,
    hh: number,
    bounds: readonly Vector3[],
    pad: number,
    recentre: boolean,
  ): number {
    _r.set(1, 0, 0).applyQuaternion(q)
    _u.set(0, 1, 0).applyQuaternion(q)
    let a0 = Infinity
    let a1 = -Infinity
    let b0 = Infinity
    let b1 = -Infinity
    for (const p of bounds) {
      _v.subVectors(p, target)
      const a = _v.dot(_r)
      const b = _v.dot(_u)
      if (a < a0) a0 = a
      if (a > a1) a1 = a
      if (b < b0) b0 = b
      if (b > b1) b1 = b
    }
    if (recentre) {
      target.addScaledVector(_r, (a0 + a1) / 2).addScaledVector(_u, (b0 + b1) / 2)
      return Math.min(
        (hw * (1 - 2 * pad)) / Math.max(1e-6, (a1 - a0) / 2),
        (hh * (1 - 2 * pad)) / Math.max(1e-6, (b1 - b0) / 2),
      )
    }
    return Math.min(
      (hw * (1 - 2 * pad)) / Math.max(1e-6, -a0, a1),
      (hh * (1 - 2 * pad)) / Math.max(1e-6, -b0, b1),
    )
  }

  /** The iso end pose's zoom (about 0.84 for hero-wide). */
  get endZoom() {
    return this.z1
  }

  /** e: eased 0 to 1 (the caller applies the machine ease). e = 0 is the exact SVG frame. */
  pose(e: number): void {
    this.e = e
    const c = this.camera
    c.quaternion.slerpQuaternions(this.q0, this.q1, e)
    _v.lerpVectors(this.t0, this.t1, e)
    c.position.copy(_v).addScaledVector(_b.set(0, 0, 1).applyQuaternion(c.quaternion), D)
    const k = e * 16
    const i = Math.min(15, Math.floor(k))
    const zf = this.zfit[i]! + (this.zfit[i + 1]! - this.zfit[i]!) * (k - i)
    c.zoom = e === 0 ? 1 : Math.min(Math.pow(this.z1, e), zf)
    c.updateProjectionMatrix()
    c.updateMatrixWorld(true)
  }
}
