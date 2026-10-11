import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Shape,
  TorusGeometry,
  Vector2,
  type Material,
} from 'three'
import { COLOR } from '@/styles/tokens'
import { lineMat, segments } from './lines'

/**
 * Gauge and needle (§2.6). Bands run −120° to +120°: LOW (alu-500), IN RANGE
 * (blueprint), CHECK (redline). No green, no numerals; the words are HTML,
 * anchored at the band midpoints. The needle is a spring:
 * θ'' = 170(θt − θ) − 18θ', semi-implicit, substeps ≤ 1/120 s.
 * The dial faces +Y (it lies in the plan), centred on the group origin.
 */

export interface GaugeOpts {
  r: number
  ticks?: number
  bezel?: 'alu' | 'orange'
  /** Tick line width in CSS px. */
  tickPx?: number
  bezelMat: Material
}

export interface Gauge {
  group: Group
  anchors: { low: Object3D; inRange: Object3D; check: Object3D; centre: Object3D }
  setTarget(v: number): void
  /** Jump to the target (seek, reset). */
  snap(): void
  update(dtMs: number): boolean
  setTickWidth(px: number): void
  dispose(): void
}

const DEG = Math.PI / 180
const SWEEP = 120 * DEG
/** −1 is the LOW end, 0 straight up (north in plan), 1 the CHECK end. */
const angleOf = (v: number) => -Math.max(-1, Math.min(1, v)) * SWEEP

export function makeGauge(o: GaugeOpts): Gauge {
  const { r } = o
  const group = new Group()
  const dial = new Group()
  // Dial geometry is drawn in XY and laid flat into the plan (facing +Y, north = −Z).
  dial.rotation.x = -Math.PI / 2
  group.add(dial)
  const own: { geometry: BufferGeometry; material?: Material | Material[] }[] = []
  const basic = (color: string) => new MeshBasicMaterial({ color, toneMapped: false })

  const face = new Mesh(new CircleGeometry(r, 48), basic(COLOR.paper))
  face.position.z = -3
  dial.add(face)
  own.push(face)
  const band = (from: number, to: number, color: string) => {
    // RingGeometry angles start at +X, counter-clockwise; ours start at north (+Y in dial space).
    const m = new Mesh(
      new RingGeometry(0.72 * r, 0.86 * r, 32, 1, Math.PI / 2 - to * DEG, (to - from) * DEG),
      basic(color),
    )
    m.position.z = -2.9
    dial.add(m)
    own.push(m)
  }
  band(-120, -40, COLOR.alu500)
  band(-40, 40, COLOR.blueprint)
  band(40, 120, COLOR.redline)

  const n = o.ticks ?? 9
  const tickPos: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 - (-120 + (240 * i) / (n - 1)) * DEG
    tickPos.push(
      Math.cos(a) * 0.88 * r,
      Math.sin(a) * 0.88 * r,
      -2.8,
      Math.cos(a) * 0.98 * r,
      Math.sin(a) * 0.98 * r,
      -2.8,
    )
  }
  const tickMat = lineMat({ color: COLOR.asphalt, width: o.tickPx ?? 1 })
  const ticks = segments(tickPos, tickMat)
  dial.add(ticks)

  const needleShape = new Shape([
    new Vector2(-1.5, 0),
    new Vector2(1.5, 0),
    new Vector2(0, 0.82 * r),
  ])
  const needle = new Mesh(
    new ExtrudeGeometry(needleShape, { depth: 1.5, bevelEnabled: false }),
    basic(COLOR.asphalt),
  )
  needle.position.z = -2.5
  dial.add(needle)
  own.push(needle)
  const hub = new Mesh(new CylinderGeometry(3, 3, 2, 16), basic(COLOR.asphalt))
  hub.rotation.x = Math.PI / 2
  hub.position.z = -1
  dial.add(hub)
  own.push(hub)
  const bezel = new Mesh(new TorusGeometry(r + 2, 2.5, 8, 48), o.bezelMat)
  bezel.position.z = -2
  dial.add(bezel)
  own.push({ geometry: bezel.geometry })

  const anchor = (deg: number, k: number) => {
    const a = Math.PI / 2 - deg * DEG
    const obj = new Object3D()
    obj.position.set(Math.cos(a) * k * r, Math.sin(a) * k * r, 0)
    dial.add(obj)
    return obj
  }
  const anchors = {
    low: anchor(-80, 1.2),
    inRange: anchor(0, 1.2),
    check: anchor(80, 1.2),
    centre: anchor(0, 0),
  }

  let theta = angleOf(0)
  let vel = 0
  let target = theta
  needle.rotation.z = theta
  return {
    group,
    anchors,
    setTarget(v) {
      target = angleOf(v)
    },
    snap() {
      theta = target
      vel = 0
      needle.rotation.z = theta
    },
    update(dtMs) {
      let left = Math.min(dtMs, 100) / 1000
      while (left > 0) {
        const h = Math.min(left, 1 / 120)
        vel += (170 * (target - theta) - 18 * vel) * h
        theta += vel * h
        left -= h
      }
      needle.rotation.z = theta
      const moving = Math.abs(target - theta) > 1e-4 || Math.abs(vel) > 1e-4
      if (!moving) {
        theta = target
        vel = 0
      }
      return moving
    },
    setTickWidth(px) {
      tickMat.linewidth = px
    },
    dispose() {
      for (const m of own) {
        m.geometry.dispose()
        if (m.material && !Array.isArray(m.material) && !m.material.userData.shared)
          m.material.dispose()
      }
      ticks.geometry.dispose()
      tickMat.dispose()
    },
  }
}
