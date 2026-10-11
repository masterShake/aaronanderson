import { Group, Mesh, PointLight, Scene, Vector3, type Material, type TubeGeometry } from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import { DUR, FLOW } from '@/motion/timing/global'
import { COLOR } from '@/styles/tokens'
import {
  DEMO_BOXES,
  DEMO_GAUGE,
  DEMO_PEN,
  DEMO_ROUTES,
  demoSegments,
} from '@/app/kit/stage/demo-plan'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { fadeEdge, lineMat, segments } from '@/stage/runtime/kit/lines'
import {
  EXTRUDE_FLOOR,
  extrudeRect,
  rectRing,
  rectVerticals,
  setExtrude,
} from '@/stage/runtime/kit/extrude'
import { RoutePath, makePipe, setGrowth } from '@/stage/runtime/kit/pipes'
import { PacketField, type PacketPlan } from '@/stage/runtime/kit/packets'
import { makeGauge, type Gauge } from '@/stage/runtime/kit/gauges'
import {
  TUNING,
  aluminum,
  emissive,
  powderOrange,
  withFlatMix,
  type FlatMixed,
} from '@/stage/runtime/kit/materials'
import { ease, span } from '@/stage/runtime/kit/ease'

/**
 * The stage lane's demo for /kit/stage: three extrusions, two pipes with
 * packets and a gauge, through the full hand-off. Pose 0 draws exactly the
 * page's SVG plan (demo-plan.ts): cyan outlines and conduits, faces flat at
 * the panel tone. After the hand-off it extrudes, anodizes, tilts to iso,
 * grows the pipes, then runs FLOW.loops loops of packets and idles.
 */

const T = {
  extrude: [0, 900],
  anodize: [600, 1200],
  edge: [900, 1500],
  grow: [1200, 2000],
  gauge: [1600, 2000],
  flow: 2000,
} as const
const PIPE_R = 4.5
const PIPE_Y = 8

const mod: SceneModule = {
  id: '_demo',
  create(ctx) {
    const vb = ctx.viewBox
    const q = ctx.quality
    const three = new Scene()
    const rig = new OrthoRig('plan')
    const lineMats: LineMaterial[] = []
    const edgeMats: LineMaterial[] = []
    const own: { geometry: { dispose(): void }; material?: Material }[] = []
    const boxes: Mesh[] = []
    const faces: FlatMixed<ReturnType<typeof aluminum>>[] = []
    const verticals: ReturnType<typeof segments>[] = []
    const pipes: Mesh<TubeGeometry>[] = []
    const paths: RoutePath[] = []
    const bounds: Vector3[] = []
    let packets: PacketField | null = null
    let gauge: Gauge | null = null
    const gaugeGroup = new Group()
    let t = 0
    let running = false
    let beat: Beat | undefined

    const mkLine = (edge: boolean) => {
      const m = lineMat({ color: COLOR.cyan, width: ctx.strokePx(DEMO_PEN) })
      lineMats.push(m)
      if (edge) edgeMats.push(m)
      return m
    }

    function* build() {
      for (const b of DEMO_BOXES) {
        const face = withFlatMix(b.material === 'orange' ? powderOrange(q) : aluminum(q))
        const mesh = new Mesh(extrudeRect(b.rect, b.height), face)
        own.push(mesh)
        faces.push(face)
        const ring = segments([...rectRing(b.rect, 0), ...rectRing(b.rect, b.height)], mkLine(true))
        const vert = segments(rectVerticals(b.rect, b.height), mkLine(true))
        vert.visible = false
        own.push(ring, vert)
        mesh.add(ring, vert)
        verticals.push(vert)
        setExtrude(mesh, 0)
        boxes.push(mesh)
        three.add(mesh)
        const [x, y, w, h] = b.rect
        for (const px of [x, x + w])
          for (const pz of [y, y + h])
            bounds.push(new Vector3(px, 0, pz), new Vector3(px, b.height, pz))
        yield
      }
      const conduits = demoSegments()
        .slice(DEMO_BOXES.length * 4)
        .flatMap(([a, b, c, d]) => [a, 0, b, c, 0, d])
      const cl = segments(conduits, mkLine(false))
      own.push(cl)
      three.add(cl)
      yield
      const pipeMat = aluminum(q)
      for (const r of DEMO_ROUTES) {
        const path = new RoutePath(r, PIPE_Y, 12)
        const pipe = makePipe(path, PIPE_R, pipeMat)
        own.push({ geometry: pipe.geometry })
        paths.push(path)
        pipes.push(pipe)
        three.add(pipe)
        yield
      }
      packets = new PacketField(16, emissive())
      three.add(packets.mesh)
      gauge = makeGauge({ r: DEMO_GAUGE.r, bezelMat: aluminum(q), tickPx: 1 })
      const top = DEMO_BOXES[2]!.height
      gaugeGroup.position.set(DEMO_GAUGE.at[0], top + 4, DEMO_GAUGE.at[1])
      gaugeGroup.add(gauge.group)
      three.add(gaugeGroup)
      yield
      const cx = vb[0] + vb[2] / 2
      const cz = vb[1] + vb[3] / 2
      const spanW = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(cx + ox * spanW, oy * spanW, cz + oz * spanW)
      three.add(key)
      reset()
    }

    /** One long route for the packets: a then b. */
    const plans = (): PacketPlan[] => {
      const out: PacketPlan[] = []
      for (let loop = 0; loop < FLOW.loops; loop++)
        for (let k = 0; k * FLOW.packetEvery < FLOW.loop - 2000; k++)
          for (let r = 0; r < paths.length; r++)
            out.push({
              path: paths[r]!,
              t0: loop * FLOW.loop + k * FLOW.packetEvery + r * 400,
              speed: FLOW.speed,
            })
      return out
    }
    let packetPlans: PacketPlan[] = []

    function pose(at: number) {
      const e = ease.machine(span(at, 0, DUR.tilt))
      rig.pose(e)
      const ext = ease.machine(span(at, T.extrude[0], T.extrude[1]))
      for (const b of boxes) setExtrude(b, ext)
      for (const v of verticals) v.visible = ext > EXTRUDE_FLOOR + 0.01
      const flat = 1 - span(at, T.anodize[0], T.anodize[1])
      for (const f of faces) f.uFlat.value = flat
      const edge = span(at, T.edge[0], T.edge[1]) * 0.45
      for (const m of edgeMats) fadeEdge(m, COLOR.cyan, COLOR.alu300, edge)
      const grow = span(at, T.grow[0], T.grow[1])
      for (const p of pipes) setGrowth(p, grow)
      const g = ease.settle(span(at, T.gauge[0], T.gauge[1]))
      gaugeGroup.visible = g > 0
      gaugeGroup.scale.setScalar(Math.max(0.001, g))
      const flowMs = at - T.flow
      let n = 0
      if (flowMs >= 0 && packets) n = packets.update(flowMs, packetPlans)
      else packets?.clear()
      gauge?.setTarget(flowMs >= 0 ? Math.sin(flowMs / 900) * 0.6 : 0)
      return n
    }

    function reset() {
      t = 0
      running = false
      beat = undefined
      packetPlans = plans()
      pose(0)
      gauge?.snap()
    }

    const total = T.flow + FLOW.loop * FLOW.loops

    return {
      three,
      rig,
      build,
      reset,
      start() {
        running = true
      },
      update(dt, p) {
        if (!running) return { animating: false }
        void p
        t = Math.min(total, t + dt)
        const n = pose(t)
        const needle = gauge?.update(dt) ?? false
        const next: Beat = t >= total ? 'idle' : t >= T.flow ? 'running' : 'built'
        const changed = next !== beat
        beat = next
        return {
          beat: changed ? next : undefined,
          animating: t < total || needle || n > 0,
        }
      },
      setPose(p) {
        rig.pose(p === 'iso' ? 1 : 0)
      },
      resize(w, h) {
        rig.fit(vb, w, h, bounds)
        const px = ctx.strokePx(DEMO_PEN)
        for (const m of lineMats) m.linewidth = px
      },
      dispose() {
        for (const o of own) {
          o.geometry.dispose()
          if (o.material && !o.material.userData.shared) o.material.dispose()
        }
        for (const m of lineMats) m.dispose()
        packets?.dispose()
        gauge?.dispose()
        three.clear()
      },
    }
  },
}

export default mod
