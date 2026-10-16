import {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  Vector3,
  type BufferGeometry,
  type Material,
  type TubeGeometry,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { ModelPart, Pen, Pt } from '@/drawings/types'
import { HERO } from '@/motion/timing/hero'
import { COLOR } from '@/styles/tokens'
import { HERO_DATA } from './model/data'
import { isSolid, outline, partLines, quarterLater, type LiteLine } from './model/frame-lite'
import { centre, modelDecor, plate, segs, trace, wheel } from '@/stage/runtime/kit/decor'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { lineMat, segments } from '@/stage/runtime/kit/lines'
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
 *
 * Pose 0 (the hand-off frame): faces flat at the panel (or orange) tone, and planFrame's lines
 * as a decal painted by the same 2D rasterizer the SVG uses, one texel per device pixel, so
 * the swap is seamless; it fades as the model tilts and the Line2 edges take over.
 * No text in the canvas: labels are HTML (--ix/--iy).
 */

type Solid = FlatMixed<ReturnType<typeof aluminum>>
const SEQ = ['r01', 'r05', 'r02', 'r09', 'r11', 'r08', 'r03', 'r10'] as const
const HOLD = 600

const mod: SceneModule = {
  id: 'hero',
  create(ctx) {
    const data = HERO_DATA[ctx.layout]
    const { spec, people } = data
    const part = (id: string) => spec.parts.find((p) => p.id === id || p.kind === id)
    const routes: Record<string, readonly Pt[]> = {}
    for (const p of spec.parts)
      if (p.kind === 'pipe' && p.prims[0]?.t === 'poly') routes[p.id] = p.prims[0].pts
    const b2 = part('r02')?.prims[1]
    const branch = b2?.t === 'poly' ? b2.pts : []
    const tank = part('tank')
    const tc = tank?.prims[0]
    const vb = ctx.viewBox
    const q = ctx.quality
    const wide = ctx.layout === 'wide'
    const three = new Scene()
    const rig = new OrthoRig('plan')
    const own: { geometry?: BufferGeometry; material?: Material; dispose?(): void }[] = []
    const lines: { m: LineMaterial; pen: Pen; o: Object3D }[] = []
    const pipeLines: LineMaterial[] = []
    const solids: { mesh: Mesh; face: Solid; order: number }[] = []
    const tubes: Mesh<TubeGeometry>[] = []
    const cards: Cutout[] = []
    const anchors = new Map<string, Object3D>()
    const bounds: Vector3[] = []
    const frame = spec.parts.flatMap((p) => partLines(p))
    // the tool glyphs, plate dividers and the instruments' detail, as the CAD SVG draws them;
    // the screws (each tool's last four) show only on the 3D top faces
    const deco = modelDecor(spec)
    const decoAll: LiteLine[] = [
      ...Object.values(deco.tools).flatMap((ls) => ls.slice(0, -4)),
      ...deco.instruments,
    ].map((l) => ({ id: '', pts: l.pts, closed: l.closed, pen: '035', ink: 'cyan' }))
    let packets: PacketField | null = null
    let plans: PacketPlan[] = []
    let level: Mesh | null = null
    let glassM: Mesh | null = null
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

    // the plan decal: planFrame's lines, painted by the 2D rasterizer, one texel per device px
    const cv = document.createElement('canvas')
    const tex = new CanvasTexture(cv)
    tex.colorSpace = SRGBColorSpace
    tex.minFilter = tex.magFilter = NearestFilter
    tex.generateMipmaps = false
    const decalMat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    })
    const decalGeo = new PlaneGeometry(vb[2], vb[3])
      .rotateX(-Math.PI / 2)
      .translate(vb[0] + vb[2] / 2, 0, vb[1] + vb[3] / 2)
    const decal = new Mesh(decalGeo, decalMat)
    decal.renderOrder = 99
    three.add(decal)
    own.push({ geometry: decalGeo, material: decalMat }, tex)

    let quarter = () => {}
    let painted = ''
    function paint() {
      const s = rig.scale * ctx.renderer.getPixelRatio()
      // a re-fit at the same size and stroke scale keeps the finished decal
      const key = `${s}:${ctx.strokePx('050')}`
      if (key === painted) return
      painted = key
      cv.width = Math.round(vb[2] * s)
      cv.height = Math.round(vb[3] * s)
      const g = cv.getContext('2d')
      if (!g) return
      g.setTransform(cv.width / vb[2], 0, 0, cv.height / vb[3], -vb[0] * s, -vb[1] * s)
      g.lineCap = g.lineJoin = 'round'
      for (const l of [...frame, ...decoAll]) {
        g.beginPath()
        trace(g, l)
        g.strokeStyle = l.ink === 'orange' ? COLOR.orange : COLOR.cyan
        g.lineWidth = ctx.strokePx(l.pen) / rig.scale
        g.stroke()
      }
      tex.needsUpdate = true
      quarter()
      quarter = quarterLater(g, () => (tex.needsUpdate = true))
    }

    const mkLine = (l: LiteLine, y: number, order: number, parent: Object3D) => {
      const m = lineMat({
        color: l.ink === 'orange' ? COLOR.orange : COLOR.cyan,
        width: 1,
        a2c: true,
      })
      // corners stay sharp: the decal draws the plan frame, and pipe lines only show while
      // they fade into the grown pipes
      const o = segments(segs([l], y), m)
      o.renderOrder = 10 + order
      own.push({ geometry: o.geometry })
      lines.push({ m, pen: l.pen, o })
      parent.add(o)
      return m
    }

    /** Segment positions (6 numbers each) into a detail line set on `parent`. */
    const addSegs = (pos: number[], color: string, order: number, parent: Object3D) => {
      const m = lineMat({ color, width: 1, a2c: true })
      const o = segments(pos, m)
      o.renderOrder = 10 + order
      own.push({ geometry: o.geometry })
      lines.push({ m, pen: '035', o })
      parent.add(o)
    }

    function addPart(p: ModelPart, order: number) {
      {
        const top = p.depth
        const z0 = p.z ?? 0
        for (const c of p.prims)
          for (const pt of outline(c).pts)
            bounds.push(new Vector3(pt[0], z0, pt[1]), new Vector3(pt[0], z0 + top, pt[1]))
        if (p.kind === 'pipe') {
          for (const l of partLines(p)) pipeLines.push(mkLine(l, 0, order, three))
          for (const c of p.prims) {
            if (c.t !== 'poly') continue
            const tube = makePipe(
              new RoutePath(c.pts, z0 + top / 2, c.r ?? 0),
              top / 2,
              aluminum(q),
            )
            own.push({ geometry: tube.geometry })
            tubes.push(tube)
            three.add(tube)
          }
          return
        }
        if (!isSolid(p)) return
        const orange = p.material === 'orange'
        const face = withFlatMix(
          orange ? powderOrange(q) : aluminum(q),
          orange ? COLOR.orange : COLOR.blueprintDeep,
        )
        own.push({ material: face })
        p.prims.forEach((c, i) => {
          const geo =
            c.t === 'rect'
              ? extrudeRect([c.at[0], c.at[1], c.size[0], c.size[1]], top)
              : extrudePoly(outline(c).pts, top, 1)
          const mesh = new Mesh(geo, face)
          mesh.position.y = z0
          own.push({ geometry: geo })
          const l = partLines(p)[i]!
          for (const y of [0, top]) mkLine(l, y, order, mesh)
          // the decor sits on the top face, engraved in a darker tone than the edges
          const d = deco.tools[p.id]
          const t = top + 0.2
          if (d) addSegs(segs(d, t), orange ? COLOR.asphalt : COLOR.graphite, order, mesh)
          setExtrude(mesh, 0)
          solids.push({ mesh, face, order })
          three.add(mesh)
          if (i) return
          const [cx, cz] = centre(p)
          // the valve's bonnet stem and handwheel (it reads as a valve from any side); the AI
          // reader's lens on its top
          if (p.kind === 'valve')
            addSegs(wheel(cx, cz, t, top * 1.3, top * 0.8), COLOR.asphalt, order, mesh)
          else if (p.id === 'ai')
            addSegs(segs(deco.instruments.slice(0, 2), t), COLOR.cyan, order, mesh)
        })
        if (p.anchor) {
          const a = new Object3D()
          const q = p.prims[0]!
          // a tool's label sits on its name plate (right of the glyph)
          const [cx, cz] =
            q.t === 'rect' ? plate([q.at[0], q.at[1], q.size[0], q.size[1]]).c : centre(p)
          // the AI reader's label below it, the valve's above its handwheel (close in plan)
          const [dx, dy, dz] =
            p.id === 'ai' ? [-12, -top, 34] : p.id === 'valve' ? [-26, 44, -34] : [0, 1, 0]
          a.position.set(cx + dx, z0 + top + dy, cz + dz)
          anchors.set(p.anchor, a)
          three.add(a)
        }
      }
    }

    function* build() {
      // one part per unit (the runtime slices at 8 ms)
      for (const [order, p] of spec.parts.entries()) {
        addPart(p, order)
        yield
      }
      // packets on the pipe centre lines; the ticket line's every fourth waits at the valve
      const pipe = part('pipe')
      const y = (pipe?.z ?? 0) + (pipe?.depth ?? 9) / 2
      packets = new PacketField(48, emissive(), ((pipe?.depth ?? 9) / 2) * 1.5, wide ? 10 : 7)
      three.add(packets.mesh)
      const paths = new Map<string, RoutePath>()
      for (const id of SEQ)
        if (routes[id]) paths.set(id, new RoutePath(routes[id]!, y, wide ? 12 : 10))
      const r02 = routes.r02
      let held: PacketPlan | null = null
      if (r02 && branch.length === 4) {
        const pts: Pt[] = [r02[0]!, ...branch, r02[r02.length - 1]!]
        const b = branch
        const s =
          Math.hypot(b[0]![0] - pts[0]![0], b[0]![1] - pts[0]![1]) +
          Math.abs(b[1]![1] - b[0]![1]) +
          Math.abs(b[2]![0] - b[1]![0]) / 2
        held = {
          path: new RoutePath(pts, y, wide ? 6 : 5),
          t0: 0,
          speed: HERO.packetSpeed,
          holds: [{ s, ms: HOLD }],
        }
      }
      plans = []
      const v = HERO.packetSpeed / 1000
      // nothing in flight at a loop boundary
      const fits = (k: number, path: RoutePath, hold = 0) =>
        k + path.length / v + hold <= HERO.loop - 400
      const r02p = paths.get('r02')
      for (let L = 0; L < HERO.loops; L++) {
        const base = L * HERO.loop
        for (let k = 0, j = 0; k < HERO.loop; k += HERO.packetGap, j++) {
          if (j % 4 === 1) {
            if (held && fits(k, held.path, HOLD)) plans.push({ ...held, t0: base + k })
          } else if (r02p && fits(k, r02p))
            plans.push({ path: r02p, t0: base + k, speed: HERO.packetSpeed })
        }
        // every other line at twice the gap, phased so the flow reads as one machine
        SEQ.forEach((id, i) => {
          const path = id === 'r02' ? null : paths.get(id)
          for (let k = (i * 170) % HERO.packetGap; path && k < HERO.loop; k += 2 * HERO.packetGap)
            if (fits(k, path)) plans.push({ path, t0: base + k, speed: HERO.packetSpeed })
        })
      }
      yield
      // the DATA tank's sight glass, on its camera-facing side
      if (tank && tc?.t === 'circle') {
        // a dark glass the cyan level rises in (orange stays for the packets and the valve)
        const w0 = wide ? 8 : 6
        const H = tank.depth * 0.76
        const g = new BoxGeometry(w0, 1, 2).translate(0, 0.5, 0)
        const gg = new BoxGeometry(w0 + 4, H + 4, 1.5).translate(0, H / 2, 0)
        level = new Mesh(g, emissive(COLOR.cyan))
        const glass = (glassM = new Mesh(gg, emissive(COLOR.asphalt)))
        own.push({ geometry: g }, { geometry: gg })
        for (const [m, o] of [
          [level, 1],
          [glass, 0],
        ] as const) {
          m.position.set(
            tc.c[0] + tc.r * Math.SQRT1_2 + o,
            tank.depth * 0.12 - 2 + 2 * o,
            tc.c[1] + tc.r * Math.SQRT1_2 + o,
          )
          m.rotation.y = Math.PI / 4
          three.add(m)
        }
        level.userData.h = H
      }
      // the owner's report card slides out of the report box's south face
      const rep = part('report')
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
          // the person at the valve is the subject of the approval: larger than the others
          data.person * (p.id === 'p1' ? 2.1 : 1.6),
          p.at,
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
      if (m >= 0) packets?.update(m, plans)
      else packets?.clear()
      const end = HERO.loop * loops
      if (level) {
        level.visible = m >= 0
        level.scale.y = Math.max(
          0.001,
          (Math.floor(Math.min(1, m / end) * 12) / 12) * level.userData.h,
        )
      }
      if (card) {
        const within = m % HERO.loop
        const out = m >= end ? 1 : ease.settle(span(within, 4800, 5400))
        const back = m >= HERO.loop && m < end ? 1 - ease.machine(span(within, 0, 300)) : 0
        card.visible = m >= 0
        card.position.lerpVectors(cardIn, cardOut, Math.max(out, back))
      }
    }

    function pose(at: number) {
      const e = ease.machine(span(at, 0, TILT))
      rig.pose(e)
      for (const s of solids) {
        setExtrude(s.mesh, ease.settle(span(at, 60 * s.order, 60 * s.order + 700)))
        s.face.uFlat.value = 1 - span(at, TILT * 0.2, TILT * 0.7)
      }
      // the decal holds the plan frame; the Line2 edges take over as it tilts
      decal.visible = at < TILT * 0.15
      // the sight glass stands up with the model (none at the plan frame: the seam)
      if (glassM) glassM.visible = at > TILT * 0.3
      decalMat.opacity = 1 - span(at, 0, TILT * 0.15)
      // the Line2 edges (depth-tested) show only once the model leaves the plan frame
      for (const l of lines) l.o.visible = at > 0
      const grow = span(at, TILT * 0.45, TILT * 0.8)
      for (const tb of tubes) setGrowth(tb, grow)
      for (const m of pipeLines) {
        m.transparent = true
        m.opacity = 1 - grow
      }
      // round caps keep a trace at zero opacity: gone once the pipes are grown
      if (grow >= 1) for (const l of lines) if (pipeLines.includes(l.m)) l.o.visible = false
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
        projectAnchors(anchors, rig.camera, w, h, () => e >= 0.999, labels)
        return { beat: changed ? next : undefined, labels, animating: m < end }
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
        for (const l of lines) l.m.linewidth = ctx.strokePx(l.pen)
        paint()
      },
      dispose() {
        quarter()
        for (const o of own) {
          o.geometry?.dispose()
          if (o.material && !o.material.userData.shared) o.material.dispose()
          o.dispose?.()
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
