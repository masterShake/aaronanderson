import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type TubeGeometry,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { Pen, Pt } from '@/drawings/types'
import { COLOR } from '@/styles/tokens'
import { S02 } from '@/motion/timing/s02'
import {
  S02_DESTS,
  S02_LABEL,
  S02_LAYOUT,
  S02_TOOLS,
  s02LabelAt,
  s02Lamp,
  s02Mech,
  s02Model,
  type S02Dest,
  type S02Route,
  type S02Tool,
} from '@/drawings/views/s02'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { fadeEdge, lineMat, segments } from '@/stage/runtime/kit/lines'
import { extrudePoly, setExtrude } from '@/stage/runtime/kit/extrude'
import { RoutePath, makeFlange, makePipe, setGrowth } from '@/stage/runtime/kit/pipes'
import { PacketField, type PacketPlan } from '@/stage/runtime/kit/packets'
import {
  TUNING,
  aluminum,
  emissive,
  powderOrange,
  withFlatMix,
} from '@/stage/runtime/kit/materials'
import { projectAnchors, type LabelMap } from '@/stage/runtime/kit/labels'
import { ease, span } from '@/stage/runtime/kit/ease'
import { enclosure, routeSegments } from './plumbing/parts'
import { modelCorners, planLines, ringSegments } from './plumbing/plan'

/**
 * S-02 System Integration (owner: scenes-a). Pose 0 draws planFrame(s02Model) exactly:
 * enclosure faces flat at the panel tone with cyan outlines, conduits and the junction in
 * cyan, orange flange ticks. Scrub p (S02 table): tilt to iso .48–.68, enclosures extrude
 * from .50, anodize, the conduits lift into flanged aluminium pipes, flanges and lamps
 * settle in; the names ride their enclosures' tops the whole way (projected anchors), and
 * the fail chip's anchor shows from .68. From S02.motionFromP the loops run (s02Mech, shared
 * with the SVG): one NEW LEAD to the junction, three copies out, the loop-3 sync failure.
 */

const mod: SceneModule = {
  id: 's02',
  create(ctx) {
    const L = S02_LAYOUT[ctx.layout]
    const spec = s02Model(ctx.layout)
    const vb = ctx.viewBox
    const q = ctx.quality
    const three = new Scene()
    const rig = new OrthoRig('plan')
    const bounds = modelCorners(spec)
    const lines: [LineMaterial, Pen][] = []
    const geos: BufferGeometry[] = []
    const mats: Material[] = []
    const faces: ReturnType<typeof withFlatMix>[] = []
    const edges: LineMaterial[] = []
    const glyphs: LineMaterial[] = []
    const hosts: Partial<Record<S02Tool, Mesh>> = {}
    const labelAt: [string, Pt, Pt][] = []
    const ground: LineMaterial[] = []
    const ticks: LineMaterial[] = []
    const boxes: Mesh[] = []
    const verticals: Object3D[] = []
    const pipes: Mesh<TubeGeometry>[] = []
    const paths = {} as Record<S02Route, RoutePath>
    const flanges: Record<string, Group> = {}
    const lamps: Record<string, { mesh: Mesh; mat: MeshStandardMaterial }> = {}
    const anchors = new Map<string, Object3D>()
    const labels: LabelMap = new Map()
    let acctFlash: MeshStandardMaterial | null = null
    let packets: PacketField | null = null
    let w = 1
    let h = 1
    let t = 0
    let running = false
    let leadNow = -1
    let acctX = 0

    const line = (color: string, pen: Pen, list?: LineMaterial[]) => {
      const m = lineMat({ color, width: ctx.strokePx(pen) })
      lines.push([m, pen])
      list?.push(m)
      return m
    }
    const anchor = (key: string, x: number, y: number, z: number, parent: Object3D = three) => {
      const o = new Object3D()
      o.position.set(x, y, z)
      anchors.set(key, o)
      parent.add(o)
      return o
    }

    function* build() {
      for (const pl of planLines(spec)) {
        if (pl.id.startsWith('box.')) {
          const tool = pl.id.slice(4) as (typeof S02_TOOLS)[number]
          const [x, y, bw, bh] = L.boxes[tool]
          const face = withFlatMix(aluminum(q))
          const e = enclosure(
            [x, y, bw, bh],
            L.heights[tool],
            face,
            line(COLOR.cyan, pl.pen, edges),
            {
              inset: L.heights[tool] * 0.16,
              line: line(COLOR.cyan, '025', edges),
            },
          )
          faces.push(face)
          mats.push(face)
          geos.push(e.mesh.geometry)
          boxes.push(e.mesh)
          hosts[tool] = e.mesh
          verticals.push(e.verticals, e.panels!)
          three.add(e.mesh)
          // the name rides its enclosure's top (a child, so it rises with the extrusion)
          const [ax, az] = s02LabelAt(L, tool, 'plan')
          anchor(S02_LABEL[tool], ax, L.heights[tool] + 2, az, e.mesh)
          labelAt.push([S02_LABEL[tool], s02LabelAt(L, tool, 'plan'), s02LabelAt(L, tool, 'iso')])
        } else if (pl.id.startsWith('glyph.')) {
          // The tool's glyph rides on its enclosure's top (a child, so it extrudes with it).
          const tool = pl.id.split('.')[1] as S02Tool
          const l = segments(
            ringSegments(pl.pts, pl.closed, L.heights[tool] + 0.5),
            line(COLOR.cyan, pl.pen, glyphs),
          )
          geos.push(l.geometry)
          hosts[tool]!.add(l)
        } else if (pl.id === 'tee') {
          const part = spec.parts.find((p) => p.id === 'tee')!
          const face = withFlatMix(aluminum(q))
          const mesh = new Mesh(extrudePoly(pl.pts, part.depth, 1), face)
          mesh.add(
            segments(
              [...ringSegments(pl.pts, true, 0), ...ringSegments(pl.pts, true, part.depth)],
              line(COLOR.cyan, pl.pen, edges),
            ),
          )
          faces.push(face)
          mats.push(face)
          geos.push(mesh.geometry)
          boxes.push(mesh)
          three.add(mesh)
        } else if (pl.id.startsWith('pipe.')) {
          const r = pl.id.slice(5) as S02Route
          const flat = new RoutePath(pl.pts, 0, pl.r)
          const m = line(COLOR.cyan, pl.pen, ground)
          m.depthTest = false
          const l = segments(routeSegments(flat, 0), m)
          l.renderOrder = 2
          three.add(l)
          geos.push(l.geometry)
          paths[r] = new RoutePath(pl.pts, L.pipeY, pl.r)
          const pipe = makePipe(paths[r], L.pipeR, aluminum(q))
          pipes.push(pipe)
          geos.push(pipe.geometry)
          three.add(pipe)
        } else if (pl.id.startsWith('flange.')) {
          const k = pl.id.slice(7)
          const m = line(COLOR.orange, pl.pen, ticks)
          m.depthTest = false
          const l = segments(ringSegments(pl.pts, false, 0), m)
          l.renderOrder = 3
          three.add(l)
          geos.push(l.geometry)
          let mat: MeshStandardMaterial = powderOrange(q)
          if (k === 'acct') {
            acctFlash = mat.clone()
            acctFlash.userData = { shared: false }
            acctFlash.emissive.set(COLOR.orange)
            acctFlash.emissiveIntensity = 0
            mat = acctFlash
            mats.push(acctFlash)
          }
          const x = pl.pts[0]![0]
          const z = (pl.pts[0]![1] + pl.pts[1]![1]) / 2
          const g = new Group()
          g.position.set(x, L.pipeY, z)
          if (k === 'acct') acctX = x
          g.add(makeFlange(new Vector3(0, 0, 0), new Vector3(1, 0, 0), L.flangeR, mat))
          g.traverse((o) => {
            if (o instanceof Mesh) geos.push(o.geometry)
          })
          g.visible = false
          flanges[k] = g
          three.add(g)
          if (k === 'acct') anchor(`flange.${k}`, x, L.pipeY + L.flangeR + 2, z)
        }
        yield
      }
      const lampGeo = new SphereGeometry(L.flangeR * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
      geos.push(lampGeo)
      for (const d of S02_DESTS) {
        const [x, y] = s02Lamp(L, d)
        const mat = new MeshStandardMaterial({
          // dark until a copy arrives, then it glows orange (the one focal mark)
          color: COLOR.graphite,
          emissive: COLOR.orange,
          emissiveIntensity: 0,
          roughness: 0.5,
        })
        mats.push(mat)
        const mesh = new Mesh(lampGeo, mat)
        mesh.position.set(x, L.heights[d], y)
        mesh.visible = false
        lamps[d] = { mesh, mat }
        three.add(mesh)
      }
      packets = new PacketField(8, emissive(), L.pipeR * 1.45, L.pipeR * 2)
      three.add(packets.mesh)
      anchor('lead', 0, 0, 0)
      const size = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(vb[0] + vb[2] / 2 + ox * size, oy * size, vb[1] + vb[3] / 2 + oz * size)
      three.add(key)
      reset()
      yield
    }

    const lens = () => ({
      lead: paths.lead.length,
      est: paths.est.length,
      pm: paths.pm.length,
      acct: paths.acct.length,
    })

    /** Packet plans for one loop (ms within the loop), with the loop-3 stall. */
    function plans(loop: number): PacketPlan[] {
      const v = S02.leadSpeed / 1000
      const split = paths.lead.length / v
      const fail = loop === S02.failLoop - 1
      const stallS = Math.max(0, paths.acct.length - L.stallBack)
      const stallAt = split + stallS / v
      return [
        { path: paths.lead, t0: 0, speed: S02.leadSpeed },
        ...S02_DESTS.map((d: S02Dest) => ({
          path: paths[d],
          t0: split,
          speed: S02.leadSpeed,
          ...(d === 'acct' && fail ? { holds: [{ s: stallS, ms: S02.resumeAt - stallAt }] } : {}),
        })),
      ]
    }

    /** The scrub pose (2D-to-3D build), from raw-smoothed p. */
    function pose(p: number) {
      rig.pose(ease.machine(span(p, S02.tiltA, S02.tiltB)))
      boxes.forEach((b, i) => {
        const a = S02.extrudeA + 0.01 * i
        setExtrude(b, ease.settle(span(p, a, a + 0.1)))
      })
      const up = span(p, S02.extrudeA, S02.extrudeA + 0.04) > 0
      for (const v of verticals) v.visible = up
      const flat = 1 - span(p, S02.anodizeA, S02.anodizeB)
      for (const f of faces) f.uFlat.value = flat
      const edge = span(p, S02.anodizeA, S02.anodizeB) * 0.45
      for (const m of edges) fadeEdge(m, COLOR.cyan, COLOR.alu300, edge)
      // glyphs turn from cyan linework to blueprint marks on the aluminium tops
      for (const m of glyphs) fadeEdge(m, COLOR.cyan, COLOR.blueprint, edge / 0.45)
      // Plan lines draw over the faces, as the SVG strokes do; once tilting they depth-test.
      const tilting = p > S02.tiltA
      const lift = span(p, S02.tiltA, S02.liftB)
      for (const m of ground) {
        fadeEdge(m, COLOR.cyan, COLOR.blueprintDeep, lift)
        m.depthTest = tilting
        m.visible = lift < 1
      }
      const grow = span(p, S02.growA, S02.growB)
      for (const pipe of pipes) setGrowth(pipe, grow)
      const fl = ease.settle(span(p, S02.flangeInA, S02.flangeInB))
      for (const g of Object.values(flanges)) {
        g.visible = fl > 0
        g.scale.setScalar(Math.max(0.001, fl))
      }
      // the plan's flange ticks go as the model starts to turn (they stay on the floor while
      // the conduits lift, so lingering they read as stray marks); the 3D flanges replace them
      const tick = ease.machine(span(p, S02.tiltA, S02.extrudeA))
      for (const m of ticks) {
        fadeEdge(m, COLOR.orange, COLOR.blueprintDeep, tick)
        m.depthTest = tilting
        m.visible = tick < 1
      }
      const lp = ease.settle(span(p, S02.lampA, S02.lampB))
      for (const { mesh } of Object.values(lamps)) {
        mesh.visible = lp > 0
        mesh.scale.setScalar(Math.max(0.001, lp))
      }
    }

    function reset() {
      t = 0
      leadNow = -1
      packets?.clear()
      for (const { mat } of Object.values(lamps)) mat.emissiveIntensity = 0
      if (acctFlash) acctFlash.emissiveIntensity = 0
      pose(S02.handoffP)
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
        const looping = running && p >= S02.motionFromP
        if (!looping) t = 0
        else t += dt
        const st = looping ? s02Mech(t, lens(), L.stallBack) : null
        if (st && !st.done) packets?.update(st.ms, plans(st.loop))
        else packets?.clear()
        for (const d of S02_DESTS) lamps[d]!.mat.emissiveIntensity = st?.lamp[d] ? 1.4 : 0
        if (acctFlash) acctFlash.emissiveIntensity = st?.flash ? 0.9 : 0
        const acct = flanges.acct
        const off = st?.beat === 'syncfail' ? 4 * (1 - ease.settle(st.reseat)) : 0
        if (acct) acct.position.x = acctX - off
        leadNow = st && !st.done ? st.lead : -1
        if (leadNow >= 0)
          paths.lead.getPoint(leadNow / paths.lead.length, anchors.get('lead')!.position).y +=
            L.pipeR * 2
        // Each name stays on its enclosure's top through the hand-off, the turn and the end
        // pose: its anchor is a child of the enclosure, and slides with the camera's turn from
        // the plan place (where the SVG label was) to the iso place (forward on the top,
        // clear of the enclosure behind).
        const k = ease.machine(span(p, S02.tiltA, S02.tiltB))
        for (const [key, plan, iso] of labelAt) {
          const a = anchors.get(key)!
          a.position.x = plan[0] + (iso[0] - plan[0]) * k
          a.position.z = plan[1] + (iso[1] - plan[1]) * k
        }
        projectAnchors(
          anchors,
          rig.camera,
          w,
          h,
          (key) => (key === 'lead' ? leadNow >= 0 : key !== 'flange.acct' || p >= S02.labelsP),
          labels,
        )
        const beat: Beat = st ? st.beat : 'built'
        return { beat, labels, animating: !!st && !st.done }
      },
      setPose(p) {
        rig.pose(p === 'iso' ? 1 : 0)
      },
      command(c) {
        if (c === 'runAgain' || c === 'replay') t = 0
      },
      resize(cw, ch) {
        w = cw
        h = ch
        rig.fit(vb, cw, ch, bounds)
        for (const [m, pen] of lines) m.linewidth = ctx.strokePx(pen)
      },
      dispose() {
        three.traverse((o) => {
          const g = (o as { geometry?: BufferGeometry }).geometry
          if (g) geos.push(g)
        })
        for (const g of new Set(geos)) g.dispose()
        for (const m of mats) m.dispose()
        for (const [m] of lines) m.dispose()
        packets?.dispose()
        three.clear()
      },
    }
  },
}

export default mod
