import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Scene,
  Vector3,
  type BufferGeometry,
  type Material,
  type TubeGeometry,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { ModelPart, Pt } from '@/drawings/types'
import { HERO } from '@/motion/timing/hero'
import { COLOR } from '@/styles/tokens'
import { HERO_DATA } from './model/data'
import { isSolid, outline, partLines } from './model/frame-lite'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { fadeEdge, lineMat, segments } from '@/stage/runtime/kit/lines'
import { extrudePoly, extrudeRect, setExtrude } from '@/stage/runtime/kit/extrude'
import { RoutePath, makePipe, setGrowth } from '@/stage/runtime/kit/pipes'
import { PacketField, type PacketPlan } from '@/stage/runtime/kit/packets'
import {
  TUNING,
  aluminum,
  emissive,
  powderOrange,
  withFlatMix,
  type FlatMixed,
} from '@/stage/runtime/kit/materials'
import { makeCutout, type Cutout } from '@/stage/runtime/kit/people'
import { projectAnchors, type LabelMap } from '@/stage/runtime/kit/labels'
import { ease, span } from '@/stage/runtime/kit/ease'

/**
 * The hero machine (stage-hero §3): the firm model (./model/data.ts) at the exact SVG plan
 * frame, then, after the 120 ms hand-off, extrude and tilt to iso (HERO.tiltDur), anodize,
 * pipes grow, the people stand, and the mechanism runs HERO.loops loops: packets at
 * HERO.packetSpeed, every fourth through the sign-off valve (held there), the DATA tank's
 * sight glass fills and the owner's report slides out. Then idle; Run again replays the loops.
 * Pose 0 draws planFrame(spec) exactly: frame lines in planFrame's order, faces flat at the
 * panel (or orange) tone. No text in the canvas: labels are HTML (--ix/--iy).
 */

type Solid = FlatMixed<ReturnType<typeof aluminum>>
const SEQ = ['r01', 'r05', 'r02', 'r09', 'r11', 'r08', 'r03', 'r10'] as const
const HOLD = 600
const LINE_COVER = 1

/** A plan polyline as Line2 segment positions at height y; fillets as their arcs. */
function linePositions(pts: readonly Pt[], closed: boolean, r: number | undefined, y: number) {
  let P: Pt[] = closed ? [...pts, pts[0]!] : [...pts]
  if (r && P.length > 2) {
    const path = new RoutePath(P, y, r)
    P = []
    // straight runs end to end, each fillet as 16 chords of its arc
    for (const g of path.segs) {
      if (g.kind === 'line') P.push([g.a.x, g.a.z], [g.b.x, g.b.z])
      else
        for (let k = 0; k <= 16; k++) {
          const a = g.a0 + (g.da * k) / 16
          P.push([g.c.x + Math.cos(a) * g.r, g.c.z + Math.sin(a) * g.r])
        }
    }
  }
  const out: number[] = []
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1]!
    const b = P[i]!
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue
    out.push(a[0], y, a[1], b[0], y, b[1])
  }
  return out
}

const centre = (p: ModelPart): Pt => {
  const q = p.prims[0]!
  if (q.t === 'rect') return [q.at[0] + q.size[0] / 2, q.at[1] + q.size[1] / 2]
  if (q.t === 'circle') return q.c
  const pts = p.prims.flatMap((x) => (x.t === 'poly' ? x.pts : []))
  return [
    pts.reduce((s, x) => s + x[0], 0) / (pts.length || 1),
    pts.reduce((s, x) => s + x[1], 0) / (pts.length || 1),
  ]
}

const mod: SceneModule = {
  id: 'hero',
  create(ctx) {
    const data = HERO_DATA[ctx.layout]
    const { spec, routes, branch, store, people } = data.model
    const vb = ctx.viewBox
    const q = ctx.quality
    const three = new Scene()
    const rig = new OrthoRig('plan')
    const own: { geometry?: BufferGeometry; material?: Material }[] = []
    const lines: { m: LineMaterial; pen: ModelPart['kind'] }[] = []
    const edges: { m: LineMaterial; ink: string }[] = []
    const pipeLines: LineMaterial[] = []
    const pipeObjs: Object3D[] = []
    const solids: { mesh: Mesh; face: Solid; order: number }[] = []
    const tubes: Mesh<TubeGeometry>[] = []
    const cards: Cutout[] = []
    const anchors = new Map<string, Object3D>()
    const bounds: Vector3[] = []
    let packets: PacketField | null = null
    let plans: PacketPlan[] = []
    let level: Mesh | null = null
    let card: Mesh | null = null
    let cardOut = new Vector3()
    let cardIn = new Vector3()
    let w = 1
    let h = 1
    let t = 0
    let mech = 0
    let loops: number = HERO.loops
    let running = false
    let beat: Beat | undefined
    const labels: LabelMap = new Map()
    const TILT = HERO.tiltDur
    const PEN_OF: Record<ModelPart['kind'], '050' | '070' | '035'> = {
      box: '050',
      cyl: '050',
      tank: '050',
      pipe: '070',
      flange: '050',
      valve: '050',
      card: '035',
      slot: '035',
    }

    const mkLine = (ink: string, kind: ModelPart['kind']) => {
      // alpha to coverage: analytic edge coverage, as the SVG strokes have
      const m = lineMat({
        color: ink === 'orange' ? COLOR.orange : COLOR.cyan,
        width: 1,
        a2c: true,
      })
      lines.push({ m, pen: kind })
      return m
    }

    function* build() {
      spec.parts.forEach((p, order) => {
        const top = p.depth
        const z0 = p.z ?? 0
        for (const c of p.prims)
          for (const pt of outline(c).pts)
            bounds.push(new Vector3(pt[0], z0, pt[1]), new Vector3(pt[0], z0 + top, pt[1]))
        if (p.kind === 'pipe') {
          for (const l of partLines(p)) {
            const m = mkLine(l.ink, p.kind)
            m.depthTest = false
            pipeLines.push(m)
            const seg = segments(linePositions(l.pts, l.closed, l.r, 0), m)
            seg.renderOrder = 10 + order
            own.push({ geometry: seg.geometry })
            pipeObjs.push(seg)
            three.add(seg)
          }
          p.prims.forEach((c) => {
            if (c.t !== 'poly') return
            const path = new RoutePath(c.pts, z0 + p.depth / 2, c.r ?? 0)
            const tube = makePipe(path, p.depth / 2, aluminum(q))
            own.push({ geometry: tube.geometry })
            tubes.push(tube)
            three.add(tube)
          })
          return
        }
        if (!isSolid(p)) return
        const orange = p.material === 'orange'
        const face = withFlatMix(
          orange ? powderOrange(q) : aluminum(q),
          orange ? COLOR.orange : COLOR.blueprintDeep,
        )
        own.push({ material: face })
        for (const [i, c] of p.prims.entries()) {
          const o = outline(c)
          const geo =
            c.t === 'rect'
              ? extrudeRect([c.at[0], c.at[1], c.size[0], c.size[1]], top)
              : extrudePoly(o.pts, top, 1)
          const mesh = new Mesh(geo, face)
          mesh.position.y = z0
          own.push({ geometry: geo })
          const l = partLines(p)[i]!
          for (const y of [0, top]) {
            const m = mkLine(l.ink, p.kind)
            m.depthTest = false
            edges.push({ m, ink: l.ink })
            const seg = segments(linePositions(l.pts, l.closed, l.r, y), m)
            seg.renderOrder = 10 + order
            own.push({ geometry: seg.geometry })
            mesh.add(seg)
          }
          setExtrude(mesh, 0)
          solids.push({ mesh, face, order })
          three.add(mesh)
        }
        if (p.anchor) {
          const a = new Object3D()
          const [cx, cz] = centre(p)
          // the AI reader's label below it, the valve's above it (they sit close in plan)
          const [dx, dy, dz] =
            p.id === 'ai' ? [-12, -top, 34] : p.id === 'valve' ? [14, 34, -24] : [0, 6, 0]
          a.position.set(cx + dx, z0 + top + dy, cz + dz)
          anchors.set(p.anchor, a)
          three.add(a)
        }
      })
      yield
      // packets: field, held, lead, ticket… every fourth through the valve, held there
      const y = (spec.parts.find((p) => p.kind === 'pipe')?.z ?? 0) + 4.5
      const wide = ctx.layout === 'wide'
      const pipeR = (spec.parts.find((p) => p.kind === 'pipe')?.depth ?? 9) / 2
      packets = new PacketField(48, emissive(), pipeR * 1.5, wide ? 10 : 7)
      three.add(packets.mesh)
      const paths = new Map<string, RoutePath>()
      for (const id of SEQ)
        if (routes[id]) paths.set(id, new RoutePath(routes[id]!, y, wide ? 12 : 10))
      const r02 = routes.r02
      let held: PacketPlan | null = null
      if (r02 && branch.pts.length === 4) {
        const pts: Pt[] = [r02[0]!, ...branch.pts, r02[r02.length - 1]!]
        const path = new RoutePath(pts, y, wide ? 6 : 5)
        const b = branch.pts
        const s =
          Math.hypot(b[0]![0] - pts[0]![0], b[0]![1] - pts[0]![1]) +
          Math.abs(b[1]![1] - b[0]![1]) +
          Math.abs(b[2]![0] - b[1]![0]) / 2
        held = { path, t0: 0, speed: HERO.packetSpeed, holds: [{ s, ms: HOLD }] }
      }
      plans = []
      const v = HERO.packetSpeed / 1000
      // nothing in flight at a loop boundary
      const fits = (k: number, path: RoutePath, hold = 0) =>
        k + path.length / v + hold <= HERO.loop - 400
      for (let L = 0; L < HERO.loops; L++) {
        const base = L * HERO.loop
        // the ticket line: every fourth ticket takes the branch and waits at the valve
        const r02p = paths.get('r02')
        for (let k = 0, j = 0; k < HERO.loop; k += HERO.packetGap, j++) {
          if (j % 4 === 1 && held && fits(k, held.path, HOLD)) plans.push({ ...held, t0: base + k })
          else if (j % 4 !== 1 && r02p && fits(k, r02p))
            plans.push({ path: r02p, t0: base + k, speed: HERO.packetSpeed })
        }
        // every other line runs at twice the gap, phased so the flow reads as one machine
        SEQ.forEach((id, i) => {
          const path = id === 'r02' ? null : paths.get(id)
          if (!path) return
          for (let k = (i * 170) % HERO.packetGap; k < HERO.loop; k += 2 * HERO.packetGap)
            if (fits(k, path)) plans.push({ path, t0: base + k, speed: HERO.packetSpeed })
        })
      }
      yield
      // the DATA tank's sight glass, on its camera-facing side
      const tank = spec.parts.find((p) => p.kind === 'tank')
      if (tank) {
        const g = new BoxGeometry(wide ? 8 : 6, 1, 2).translate(0, 0.5, 0)
        level = new Mesh(g, emissive())
        own.push({ geometry: g })
        level.position.set(
          store.c[0] + store.r * Math.SQRT1_2 + 1,
          tank.depth * 0.12,
          store.c[1] + store.r * Math.SQRT1_2 + 1,
        )
        level.rotation.y = Math.PI / 4
        level.userData.h = tank.depth * 0.76
        three.add(level)
      }
      // the owner's report card slides out of the report box's south face
      const rep = spec.parts.find((p) => p.id === 'report')
      const rr = rep?.prims[0]
      if (rep && rr?.t === 'rect') {
        const [x, yy] = rr.at
        const [rw, rh] = rr.size
        const g = new BoxGeometry(rw * 0.3, 1.5, rh * 0.62)
        const m = new MeshBasicMaterial({ color: COLOR.paper, toneMapped: false })
        card = new Mesh(g, m)
        own.push({ geometry: g, material: m })
        cardIn = new Vector3(x + rw / 2, rep.depth * 0.45, yy + rh * 0.55)
        cardOut = cardIn.clone().add(new Vector3(0, 0, rh * 0.95))
        three.add(card)
      }
      // the people, as pencil cut-outs on cards
      for (const p of people) {
        const sym = data.symbols[p.symbol]
        if (!sym) continue
        const c = makeCutout(
          { viewBox: [0, 0, 40, 72], d: sym },
          data.person * 1.25,
          [p.at[0], p.at[1]],
          ctx.renderer,
        )
        cards.push(c)
        three.add(c.group)
      }
      yield
      const cx = vb[0] + vb[2] / 2
      const cz = vb[1] + vb[3] / 2
      const s = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(cx + ox * s, oy * s, cz + oz * s)
      three.add(key)
      reset()
    }

    /** Mechanism time m (ms) within the loops, or -1 before. */
    function mechanism(m: number) {
      const n = m >= 0 && packets ? packets.update(m, plans) : 0
      if (m < 0) packets?.clear()
      const done = m >= 0 ? Math.min(1, m / (HERO.loop * loops)) : 0
      if (level) {
        level.visible = m >= 0
        level.scale.y = Math.max(0.001, (Math.floor(done * 12) / 12) * level.userData.h)
      }
      if (card) {
        const within = m >= 0 ? m % HERO.loop : 0
        const out = m < 0 ? 0 : m >= HERO.loop * loops ? 1 : ease.settle(span(within, 4800, 5400))
        const back =
          m >= HERO.loop && m < HERO.loop * loops ? 1 - ease.machine(span(within, 0, 300)) : 0
        card.visible = m >= 0
        card.position.lerpVectors(cardIn, cardOut, Math.max(out, back))
      }
      return n
    }

    function pose(at: number) {
      const e = ease.machine(span(at, 0, TILT))
      rig.pose(e)
      for (const s of solids) {
        setExtrude(s.mesh, ease.settle(span(at, 60 * s.order, 60 * s.order + 700)))
        s.face.uFlat.value = 1 - span(at, TILT * 0.2, TILT * 0.7)
      }
      const fade = span(at, TILT * 0.2, TILT * 0.7) * 0.45
      for (const ed of edges) {
        ed.m.depthTest = at > 0
        if (ed.ink !== 'orange') fadeEdge(ed.m, COLOR.cyan, COLOR.alu300, fade)
      }
      const grow = span(at, TILT * 0.45, TILT * 0.8)
      for (const tb of tubes) setGrowth(tb, grow)
      for (const m of pipeLines) {
        // opaque (planFrame's order) at the plan frame; blended while they fade into the pipes
        m.transparent = at > 0
        m.opacity = 1 - grow
      }
      // round caps keep a trace at zero opacity: gone once the pipes are grown
      for (const o of pipeObjs) o.visible = grow < 1
      const stand = ease.settle(span(at, TILT * 0.62, TILT * 0.9))
      for (const c of cards) {
        c.group.visible = at > TILT * 0.62
        c.stand(stand)
      }
      return e
    }

    function reset() {
      t = 0
      mech = 0
      running = false
      beat = undefined
      loops = HERO.loops
      pose(0)
      mechanism(-1)
    }

    return {
      three,
      rig,
      build,
      reset,
      start(at, loop) {
        running = true
        t = 0
        mech = 0
        loops = at === 'boundary' ? Math.max(1, HERO.loops - (loop ?? 0)) : HERO.loops
      },
      update(dt) {
        if (!running) return { animating: false }
        t += dt
        const e = pose(t)
        if (t >= TILT) mech += dt
        const end = HERO.loop * loops
        const m = t >= TILT ? Math.min(mech, end) : -1
        mechanism(m)
        const next: Beat = m >= end ? 'idle' : m >= 0 ? 'running' : 'built'
        const changed = next !== beat
        beat = next
        const on = e >= 0.999
        projectAnchors(anchors, rig.camera, w, h, () => on, labels)
        return {
          beat: changed ? next : undefined,
          labels,
          animating: m < end,
        }
      },
      setPose(p) {
        pose(p === 'iso' ? TILT : 0)
      },
      command(c) {
        if (c !== 'runAgain' && c !== 'replay') return
        running = true
        if (t < TILT) t = TILT
        mech = 0
        loops = HERO.loops
      },
      resize(cw, chh) {
        w = cw
        h = chh
        rig.fit(vb, cw, chh, bounds)
        // MSAA covers a line's edge pixels a little less than the SVG's analytic coverage
        for (const l of lines) l.m.linewidth = ctx.strokePx(PEN_OF[l.pen]) * LINE_COVER
      },
      dispose() {
        for (const o of own) {
          o.geometry?.dispose()
          if (o.material && !o.material.userData.shared) o.material.dispose()
        }
        for (const l of lines) l.m.dispose()
        for (const c of cards) c.dispose()
        packets?.dispose()
        three.clear()
      },
    }
  },
}

export default mod
