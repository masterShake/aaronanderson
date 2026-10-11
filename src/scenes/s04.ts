import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  Vector3,
  type BufferGeometry,
  type Material,
  type TubeGeometry,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { Pen, Pt } from '@/drawings/types'
import { COLOR } from '@/styles/tokens'
import { S04 } from '@/motion/timing/s04'
import {
  S04_DIALS,
  S04_LAYOUT,
  S04_NEEDLE,
  S04_QUESTIONS,
  capsulePts,
  type Rect,
  type S04Dial,
  type S04Question,
  type S04Reading,
} from '@/drawings/views/s04'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { fadeEdge, lineMat, segments } from '@/stage/runtime/kit/lines'
import {
  EXTRUDE_FLOOR,
  extrudePoly,
  extrudeRect,
  rectRing,
  setExtrude,
} from '@/stage/runtime/kit/extrude'
import { RoutePath, makePipe, setGrowth } from '@/stage/runtime/kit/pipes'
import { PacketField, type PacketPlan } from '@/stage/runtime/kit/packets'
import { makeGauge, type Gauge } from '@/stage/runtime/kit/gauges'
import { TUNING, aluminum, emissive, withFlatMix } from '@/stage/runtime/kit/materials'
import { projectAnchors, type LabelMap } from '@/stage/runtime/kit/labels'
import { ease, span } from '@/stage/runtime/kit/ease'
import { ringSegments } from './plumbing/plan'

/**
 * S-04 Data & Dashboards (owner: scenes-a; optional, behind SHIP.s04). Pose 0 draws the
 * S-04 hand-off frame exactly as the SVG does (views/s04.ts): the panel outline and its
 * cells, three gauges (paper faces, LOW / IN RANGE / CHECK bands, needles at LOW), the
 * printer and question slots, the nameplate, the data store and its risers. Scrub p (S04
 * table): tilt to iso, the slab extrudes and hinges up about its south edge, anodizes, the
 * risers grow into pipes, the bezels settle. Loops: packets rise, needles settle into
 * IN RANGE, the owner's report comes out. `ask` turns one needle (scripted sample).
 */

const DEG = Math.PI / 180

const mod: SceneModule = {
  id: 's04',
  create(ctx) {
    const L = S04_LAYOUT[ctx.layout]
    const vb = ctx.viewBox
    const q = ctx.quality
    const [px, py, pw, ph] = L.panel
    const zH = py + ph
    const { slab: T, tankH, pipeR, pipeY } = L.d3
    const three = new Scene()
    const rig = new OrthoRig('plan')
    const pivot = new Group()
    const inner = new Group()
    const top = new Group()
    const tankTop = new Group()
    pivot.position.set(0, 0, zH)
    inner.position.set(0, 0, -zH)
    pivot.add(inner)
    three.add(pivot)
    const lines: [LineMaterial, Pen][] = []
    const plan: LineMaterial[] = []
    const edges: LineMaterial[] = []
    const mats: Material[] = []
    const faces: ReturnType<typeof withFlatMix>[] = []
    const gauges = {} as Record<S04Dial, Gauge>
    const bezels: Object3D[] = []
    const chosen = new Map<S04Dial, S04Reading>()
    const anchors = new Map<string, Object3D>()
    const labels: LabelMap = new Map()
    const risers: RoutePath[] = []
    const pipes: Mesh<TubeGeometry>[] = []
    let slab: Mesh | null = null
    let tank: Mesh | null = null
    let card: Mesh | null = null
    let packets: PacketField | null = null
    let bounds: Vector3[] = []
    let w = 1
    let h = 1
    let t = 0
    let running = false
    let cardK = 0

    const line = (color: string, pen: Pen, list?: LineMaterial[]) => {
      const m = lineMat({ color, width: ctx.strokePx(pen) })
      lines.push([m, pen])
      list?.push(m)
      return m
    }
    const basic = (color: string) => {
      const m = new MeshBasicMaterial({ color, toneMapped: false })
      mats.push(m)
      return m
    }
    /** A flat rect lying on the panel (facing up), at its plan position. */
    const flat = ([x, y, rw, rh]: Rect, m: Material, lift = 0.05) => {
      const mesh = new Mesh(new PlaneGeometry(rw, rh).rotateX(-Math.PI / 2), m)
      mesh.position.set(x + rw / 2, lift, y + rh / 2)
      return mesh
    }
    const anchor = (parent: Object3D, key: string, x: number, y: number, z: number) => {
      const o = new Object3D()
      o.position.set(x, y, z)
      parent.add(o)
      anchors.set(key, o)
    }
    const circle = (c: Pt, r: number, n = 48): Pt[] =>
      Array.from({ length: n }, (_, i) => [
        c[0] + r * Math.cos((2 * Math.PI * i) / n),
        c[1] + r * Math.sin((2 * Math.PI * i) / n),
      ])

    function* build() {
      const face = withFlatMix(aluminum(q))
      faces.push(face)
      mats.push(face)
      slab = new Mesh(extrudeRect(L.panel, T), face)
      slab.add(
        segments(
          [...rectRing(L.panel, 0), ...rectRing(L.panel, T)],
          line(COLOR.cyan, '050', edges),
        ),
      )
      inner.add(slab, top)
      const cells = line(COLOR.cyanDim, '025', plan)
      top.add(
        segments(
          [
            px + pw / 3,
            0.1,
            py,
            px + pw / 3,
            0.1,
            py + ph,
            px + (2 * pw) / 3,
            0.1,
            py,
            px + (2 * pw) / 3,
            0.1,
            py + ph,
            px,
            0.1,
            py + ph / 2,
            px + pw,
            0.1,
            py + ph / 2,
          ],
          cells,
        ),
      )
      yield
      for (const d of S04_DIALS) {
        const { c, r } = L.dials[d]
        const g = makeGauge({ r, bezelMat: aluminum(q), tickPx: ctx.strokePx('018') })
        g.group.position.set(c[0], 3.1, c[1])
        g.group.traverse((o) => {
          if (o instanceof Mesh && o.geometry.type === 'TorusGeometry') bezels.push(o)
        })
        gauges[d] = g
        top.add(g.group)
        top.add(segments(ringSegments(circle(c, r, 24), true, 0.2), line(COLOR.cyan, '035', plan)))
        const [nx, ny, nw, nh] = L.names[d]
        anchor(top, `dial.${d}`, nx + nw / 2, 0, ny + nh / 2)
        const [rx, ry, rw, rh] = L.readings[d]
        anchor(top, `reading.${d}`, rx + rw / 2, 0, ry + rh / 2)
        yield
      }
      const asphalt = basic(COLOR.asphalt)
      top.add(
        flat(L.printer, asphalt),
        flat(L.slot, asphalt),
        flat(L.nameplate, basic(COLOR.alu300)),
      )
      const [nx, ny, nw, nh] = L.nameplate
      top.add(
        segments(
          ringSegments(
            [
              [nx, ny],
              [nx + nw, ny],
              [nx + nw, ny + nh],
              [nx, ny + nh],
            ],
            true,
            0.1,
          ),
          line(COLOR.cyan, '035', plan),
        ),
      )
      const [cx, cy, cw, ch] = L.card
      card = new Mesh(
        new PlaneGeometry(cw, ch).translate(0, -ch / 2, 0).rotateX(-Math.PI / 2),
        basic(COLOR.paper),
      )
      card.position.set(cx + cw / 2, 0.08, cy)
      card.visible = false
      top.add(card)
      anchor(top, 'report', cx + cw / 2, 0.1, cy + ch / 2)
      yield
      const cap = capsulePts(L.tank)
      const tFace = withFlatMix(aluminum(q))
      faces.push(tFace)
      mats.push(tFace)
      tank = new Mesh(extrudePoly(cap, tankH, 1), tFace)
      tank.add(
        segments(
          [...ringSegments(cap, true, 0), ...ringSegments(cap, true, tankH)],
          line(COLOR.cyan, '050', edges),
        ),
      )
      three.add(tank, tankTop)
      const [tx, ty, tw, th] = L.tank
      const glass: Pt[] = [
        [tx + tw * 0.8, ty + th * 0.2],
        [tx + tw * 0.84, ty + th * 0.2],
        [tx + tw * 0.84, ty + th * 0.8],
        [tx + tw * 0.8, ty + th * 0.8],
      ]
      tankTop.add(segments(ringSegments(glass, true, 0.1), line(COLOR.cyan, '035', plan)))
      tankTop.add(flat([tx + tw * 0.8, ty + th * 0.4, tw * 0.04, th * 0.4], basic(COLOR.cyanDim)))
      anchor(three, 'store', tx + tw / 2, tankH + 2, ty + th / 2)
      for (const [a, b] of L.risers) {
        const m = line(COLOR.cyan, '070', plan)
        three.add(segments([a[0], 0, a[1], b[0], 0, b[1]], m))
        const path = new RoutePath([a, b], pipeY, 0)
        const pipe = makePipe(path, pipeR, aluminum(q))
        risers.push(path)
        pipes.push(pipe)
        three.add(pipe)
      }
      packets = new PacketField(9, emissive(), pipeR * 1.45, pipeR * 2)
      three.add(packets.mesh)
      const size = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(vb[0] + vb[2] / 2 + ox * size, oy * size, vb[1] + vb[3] / 2 + oz * size)
      three.add(key)
      // The end pose's corners: the hinged slab (with the gauges' height), the store, the risers.
      const a = S04.hingeDeg * DEG
      const hinge = (x: number, y: number, z: number) =>
        new Vector3(
          x,
          y * Math.cos(a) - (z - zH) * Math.sin(a),
          y * Math.sin(a) + (z - zH) * Math.cos(a) + zH,
        )
      bounds = []
      for (const [x, z] of [
        [px, py],
        [px + pw, py],
        [px + pw, py + ph],
        [px, py + ph],
      ] as const)
        bounds.push(hinge(x, 0, z), hinge(x, T + 6, z))
      for (const [x, z] of cap) bounds.push(new Vector3(x, 0, z), new Vector3(x, tankH, z))
      reset()
      yield
    }

    /** Packet plans for one loop: one bead per riser in turn, every S04.packetEvery. */
    function plans(): PacketPlan[] {
      const out: PacketPlan[] = []
      for (let i = 0; i < 3; i++)
        for (let t0 = i * S04.packetEvery; t0 < S04.packetsTo; t0 += 3 * S04.packetEvery)
          out.push({ path: risers[i]!, t0, speed: S04.riseSpeed })
      return out
    }

    const needle = (d: S04Dial, r: S04Reading) => gauges[d]?.setTarget(S04_NEEDLE[r] / 120)

    function pose(p: number) {
      rig.pose(ease.machine(span(p, S04.tiltA, S04.tiltB)))
      const ext = ease.settle(span(p, S04.extrudeA, S04.extrudeB))
      if (slab) setExtrude(slab, ext)
      if (tank) setExtrude(tank, ext)
      top.position.y = T * Math.max(EXTRUDE_FLOOR, ext)
      tankTop.position.y = tankH * Math.max(EXTRUDE_FLOOR, ext)
      pivot.rotation.x = S04.hingeDeg * DEG * ease.machine(span(p, S04.hingeA, S04.hingeB))
      const an = span(p, S04.anodizeA, S04.anodizeB)
      for (const f of faces) f.uFlat.value = 1 - an
      for (const m of edges) fadeEdge(m, COLOR.cyan, COLOR.alu300, an * 0.45)
      // Plan lines draw over the faces, as the SVG strokes do; once tilting they depth-test.
      const tilting = p > S04.tiltA
      for (const m of plan) m.depthTest = tilting
      tankTop.visible = !tilting
      const grow = span(p, S04.growA, S04.growB)
      for (const pipe of pipes) setGrowth(pipe, grow)
      const bz = ease.settle(span(p, S04.bezelA, S04.bezelB))
      for (const b of bezels) {
        b.visible = bz > 0
        b.scale.setScalar(Math.max(0.001, bz))
      }
    }

    function reset() {
      t = 0
      cardK = 0
      packets?.clear()
      if (card) card.visible = false
      for (const d of S04_DIALS) {
        needle(d, chosen.get(d) ?? 'low')
        gauges[d]?.snap()
      }
      pose(S04.handoffP)
    }

    return {
      three,
      rig,
      build,
      reset,
      start() {
        running = true
      },
      update(dt, p) {
        pose(p)
        const looping = running && p >= S04.motionFromP
        if (!looping) t = 0
        else t += dt
        const done = t >= S04.loop * S04.loops
        const loop = Math.min(S04.loops - 1, Math.floor(t / S04.loop))
        const ms = t - loop * S04.loop
        if (looping && !done) packets?.update(ms, plans())
        else packets?.clear()
        const settled = looping && (done || loop > 0 || ms >= S04.settleAt)
        for (const d of S04_DIALS) needle(d, chosen.get(d) ?? (settled ? 'in' : 'low'))
        cardK = looping ? (done ? 1 : span(ms, S04.cardA, S04.cardB)) : 0
        if (card) {
          card.visible = cardK > 0
          card.scale.z = Math.max(0.001, cardK)
        }
        let moving = false
        for (const d of S04_DIALS) moving = gauges[d]!.update(dt) || moving
        const show = p >= S04.labelsP
        projectAnchors(
          anchors,
          rig.camera,
          w,
          h,
          (k) => (k === 'report' ? show && cardK > 0.4 : show),
          labels,
        )
        const beat: Beat = !looping ? 'built' : done ? 'idle' : 'running'
        return { beat, labels, animating: (looping && !done) || moving }
      },
      setPose(p) {
        rig.pose(p === 'iso' ? 1 : 0)
      },
      command(c, arg) {
        if (c === 'ask' && arg && arg in S04_QUESTIONS) {
          const { dial, reading } = S04_QUESTIONS[arg as S04Question]
          chosen.set(dial, reading)
          needle(dial, reading)
        } else if (c === 'runAgain' || c === 'replay') t = 0
      },
      resize(cw, ch) {
        w = cw
        h = ch
        rig.fit(vb, cw, ch, bounds)
        for (const [m, pen] of lines) m.linewidth = ctx.strokePx(pen)
        for (const d of S04_DIALS) gauges[d]?.setTickWidth(ctx.strokePx('018'))
      },
      dispose() {
        const geos = new Set<BufferGeometry>()
        three.traverse((o) => {
          const g = (o as { geometry?: BufferGeometry }).geometry
          if (g) geos.add(g)
        })
        for (const d of S04_DIALS) gauges[d]?.dispose()
        for (const g of geos) g.dispose()
        for (const m of mats) m.dispose()
        for (const [m] of lines) m.dispose()
        packets?.dispose()
        three.clear()
      },
    }
  },
}

export default mod
