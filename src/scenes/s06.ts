import {
  CanvasTexture,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  SpotLight,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type TubeGeometry,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { ModelPart, Pen, Pt } from '@/drawings/types'
import { S06 } from '@/motion/timing/s06'
import { COLOR } from '@/styles/tokens'
import { HERO_DATA } from './model/data'
import { S06_EXTRA, s06Glyphs } from './model/s06-data'
import { isSolid, outline, partLines, quarterLater, type LiteLine } from './model/frame-lite'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { fadeEdge, lineMat, segments } from '@/stage/runtime/kit/lines'
import { extrudePoly, extrudeRect, setExtrude } from '@/stage/runtime/kit/extrude'
import { RoutePath, makePipe, setGrowth } from '@/stage/runtime/kit/pipes'
import {
  TUNING,
  aluminum,
  emissive,
  powderOrange,
  withFlatMix,
  type FlatMixed,
} from '@/stage/runtime/kit/materials'
import { projectAnchors, type LabelMap } from '@/stage/runtime/kit/labels'
import { ease, span } from '@/stage/runtime/kit/ease'

/**
 * S-06 Run & Improve (stage-hero §4.4), scrub only (1024 px and up, fine pointer): the hero's
 * machine at the exact plan frame (p .15, a 1:1 decal of planFrame's lines like the hero's),
 * built by p .39, then from p .40 a monthly inspection: a spot light sweeps the aluminium three
 * times and the flange at the store's inlet pulses on the last (FIXED); each further .15 of p
 * bolts on a month's instrument (stub, then puck), reversibly. Wide only: a tall layout throws
 * in build and the figure keeps its SVG.
 */

type Solid = FlatMixed<ReturnType<typeof aluminum>>
const { handoffP: PH, monthStepP, motionFromP, bandMs } = S06
/** The p at which month m (1–3) bolts on. */
const land = (m: number) => S06.monthFromP + m * monthStepP

function linePositions(pts: readonly Pt[], closed: boolean, y: number) {
  const P = closed ? [...pts, pts[0]!] : pts
  const out: number[] = []
  for (let i = 1; i < P.length; i++) out.push(P[i - 1]![0], y, P[i - 1]![1], P[i]![0], y, P[i]![1])
  return out
}

function trace(g: CanvasRenderingContext2D, l: Pick<LiteLine, 'pts' | 'r'> & { closed?: boolean }) {
  const P = l.pts
  g.moveTo(P[0]![0], P[0]![1])
  for (let i = 1; i < P.length; i++) {
    const b = P[i]!
    const c = P[i + 1]
    if (l.r && c) {
      const a = P[i - 1]!
      g.arcTo(
        b[0],
        b[1],
        c[0],
        c[1],
        Math.min(
          l.r,
          Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
          Math.hypot(c[0] - b[0], c[1] - b[1]) / 2,
        ),
      )
    } else g.lineTo(b[0], b[1])
  }
  if (l.closed) g.closePath()
}

const centre = (p: ModelPart): Pt => {
  const q = p.prims[0]!
  return q.t === 'rect'
    ? [q.at[0] + q.size[0] / 2, q.at[1] + q.size[1] / 2]
    : q.t === 'circle'
      ? q.c
      : q.t === 'poly'
        ? q.pts[1]!
        : [0, 0]
}

/** The month a part belongs to (1–3), or 0. */
const monthOf = (p: ModelPart) => Number(p.revs?.[0]?.slice(1) ?? 0)

const mod: SceneModule = {
  id: 's06',
  create(ctx) {
    if (ctx.layout !== 'wide') throw new Error('s06: wide only')
    const parts: readonly ModelPart[] = [...HERO_DATA.wide.spec.parts, ...S06_EXTRA]
    const vb = ctx.viewBox
    const q = ctx.quality
    const three = new Scene()
    const rig = new OrthoRig('plan', S06.isoPad)
    const own: { geometry?: BufferGeometry; material?: Material; dispose?(): void }[] = []
    const lines: { m: LineMaterial; pen: Pen; o: Object3D }[] = []
    const edges: { m: LineMaterial; ink: string }[] = []
    const pipeLines: { m: LineMaterial; o: Object3D }[] = []
    const solids: {
      mesh: Mesh
      face: Solid
      order: number
      month: number
      c: Color
      cool: number
    }[] = []
    const hot = new Color(COLOR.orange)
    const tubes: { t: Mesh<TubeGeometry>; month: number }[] = []
    const anchors = new Map<string, Object3D>()
    const months = new Map<string, number>()
    const bounds: Vector3[] = []
    const frame = parts.filter((p) => !monthOf(p)).flatMap((p) => partLines(p))
    const glyphs = s06Glyphs(parts)
    const labels: LabelMap = new Map()
    let w = 1
    let h = 1
    let t = 0
    let running = false
    let beat: Beat | undefined
    let spot: SpotLight | null = null
    let ring: Mesh | null = null
    const dialGroup = new Object3D()

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

    let painted = ''
    function paint() {
      const s = rig.scale * ctx.renderer.getPixelRatio()
      // a re-fit at the same size and stroke scale keeps the finished decal
      const key = `${s}:${ctx.strokePx('050')}`
      if (key === painted) return
      painted = key
      cv.width = Math.round(vb[2] * s)
      cv.height = Math.round(vb[3] * s)
      const g = cv.getContext('2d')!
      g.setTransform(cv.width / vb[2], 0, 0, cv.height / vb[3], -vb[0] * s, -vb[1] * s)
      g.lineCap = g.lineJoin = 'round'
      for (const l of frame) {
        g.beginPath()
        trace(g, l)
        g.strokeStyle = l.ink === 'orange' ? COLOR.orange : COLOR.cyan
        g.lineWidth = ctx.strokePx(l.pen) / rig.scale
        g.stroke()
      }
      // the tool glyphs, as the CAD plan draws them
      g.lineWidth = ctx.strokePx('025') / rig.scale
      for (const gl of glyphs) {
        g.beginPath()
        trace(g, gl)
        g.strokeStyle = gl.id === 'glyph.report' ? COLOR.asphalt : COLOR.cyan
        g.stroke()
      }
      tex.needsUpdate = true
      quarter()
      quarter = quarterLater(g, () => (tex.needsUpdate = true))
    }
    let quarter = () => {}

    const mkLine = (l: LiteLine, y: number, order: number, parent: Object3D) => {
      const m = lineMat({
        color: l.ink === 'orange' ? COLOR.orange : COLOR.cyan,
        width: 1,
        a2c: true,
      })
      const o = segments(linePositions(l.pts, l.closed, y), m)
      o.renderOrder = 10 + order
      own.push({ geometry: o.geometry })
      lines.push({ m, pen: l.pen, o })
      parent.add(o)
      return { m, o }
    }

    /**
     * The monitor's dial on the gauge's top face: a paper face, nine ticks and a needle (asphalt)
     * and the IN RANGE arc (blueprint), riding the gauge's extrusion as its children.
     */
    function dial(mesh: Mesh, [cx, cz]: Pt, rim: readonly Pt[], top: number, order: number) {
      const r = Math.hypot(rim[0]![0] - cx, rim[0]![1] - cz) * 0.82
      const geo = new CircleGeometry(r, 32).rotateX(-Math.PI / 2).translate(cx, top + 0.3, cz)
      const mat = new MeshBasicMaterial({ color: COLOR.paper, toneMapped: false })
      // the dial waits for the extrusion (never on the plan frame the seam compares)
      mesh.add(dialGroup)
      dialGroup.add(new Mesh(geo, mat))
      own.push({ geometry: geo, material: mat })
      const y = top + 0.6
      const at = (deg: number, k: number) => {
        const a = (deg * Math.PI) / 180
        return [cx + Math.sin(a) * r * k, y, cz - Math.cos(a) * r * k]
      }
      const ink: number[] = [cx, y, cz, ...at(14, 0.72)]
      const arc: number[] = []
      for (let d = -120; d <= 120; d += 30) ink.push(...at(d, 0.8), ...at(d, 0.98))
      for (let d = -40; d < 40; d += 10) arc.push(...at(d, 0.6), ...at(d + 10, 0.6))
      for (const [pos, color, pen] of [
        [ink, COLOR.asphalt, '035'],
        [arc, COLOR.blueprint, '100'],
      ] as const) {
        const m = lineMat({ color, width: 1, a2c: true })
        const o = segments(pos, m)
        o.renderOrder = 10 + order
        own.push({ geometry: o.geometry })
        lines.push({ m, pen, o })
        dialGroup.add(o)
      }
    }

    function* build() {
      parts.forEach((p, order) => {
        const top = p.depth
        const z0 = p.z ?? 0
        const month = monthOf(p)
        for (const c of p.prims)
          for (const pt of outline(c).pts)
            bounds.push(new Vector3(pt[0], z0, pt[1]), new Vector3(pt[0], z0 + top, pt[1]))
        if (p.kind === 'pipe') {
          if (!month) for (const l of partLines(p)) pipeLines.push(mkLine(l, 0, order, three))
          for (const c of p.prims) {
            if (c.t !== 'poly') continue
            const tb = makePipe(new RoutePath(c.pts, z0 + top / 2, c.r ?? 0), top / 2, aluminum(q))
            own.push({ geometry: tb.geometry })
            tubes.push({ t: tb, month })
            three.add(tb)
          }
          return
        }
        if (!isSolid(p)) return
        const orange = p.material === 'orange'
        // the hero's valve: orange on the plan (flat), aluminum once built, edges still orange
        const valve = p.id === 'valve'
        const face = withFlatMix(
          orange && !valve ? powderOrange(q) : aluminum(q),
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
          for (const y of [0, top]) edges.push({ m: mkLine(l, y, order, mesh).m, ink: l.ink })
          setExtrude(mesh, 0)
          // when it settles from orange to aluminum (months: after hotP; the valve: as the
          // inspection starts); 0: never orange
          const cool = month ? land(month) + S06.hotP : valve ? motionFromP : 0
          solids.push({ mesh, face, order, month, c: face.color.clone(), cool })
          three.add(mesh)
          if (p.id === 'gauge') dial(mesh, centre(p), outline(c).pts, top, order)
          // the tool's glyph on its top face (blueprint; dark on the orange report)
          const pos: number[] = []
          for (const gl of glyphs)
            if (gl.id === `glyph.${p.id}`) pos.push(...linePositions(gl.pts, false, top + 0.4))
          if (pos.length) {
            const m = lineMat({
              color: orange ? COLOR.asphalt : COLOR.blueprint,
              width: 1,
              a2c: true,
            })
            const o = segments(pos, m)
            o.renderOrder = 10 + order
            own.push({ geometry: o.geometry })
            lines.push({ m, pen: '025', o })
            mesh.add(o)
          }
        })
        if (p.anchor) {
          // every labelled part (the hero's tools and store, the flange, the gauge and the month
          // instruments) at its top face's centre, as on the print; CSS sets each label's offset
          const a = new Object3D()
          const [cx, cz] = centre(p)
          a.position.set(cx, z0 + top, cz)
          anchors.set(p.anchor, a)
          if (month) months.set(p.anchor, month)
          three.add(a)
        }
        if (p.id === 'flange') {
          const g = new TorusGeometry(16, 2.5, 8, 32).rotateX(Math.PI / 2)
          ring = new Mesh(g, emissive())
          own.push({ geometry: g })
          const [cx, cz] = centre(p)
          ring.position.set(cx, z0 + top / 2, cz)
          ring.visible = false
          three.add(ring)
        }
      })
      yield
      const cx = vb[0] + vb[2] / 2
      const cz = vb[1] + vb[3] / 2
      const s = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(cx + ox * s, oy * s, cz + oz * s)
      three.add(key)
      // the inspection light: intensity 0 at rest; added before compile
      spot = new SpotLight('#ffffff', 0, 0, 0.26, 0.7, 0)
      spot.position.set(cx, 800, cz)
      spot.target.position.set(cx, 0, cz)
      three.add(spot, spot.target)
      reset()
    }

    /** The model at progress p (smoothed), and the inspection at loop time m (ms; -1 before). */
    function pose(p: number, m: number) {
      const e = ease.machine(span(p, PH + 0.04, PH + 0.24))
      rig.pose(e)
      const flat = 1 - span(p, PH + 0.08, PH + 0.2)
      for (const sd of solids) {
        const mm = land(sd.month)
        const ext = sd.month
          ? ease.settle(span(p, mm, mm + 0.04))
          : ease.settle(span(p, PH + 0.04 + sd.order * 0.004, PH + 0.14 + sd.order * 0.004))
        setExtrude(sd.mesh, ext)
        sd.mesh.visible = !sd.month || ext > 0
        if (sd.cool) {
          // lands orange, settles to aluminum: the owner's report is the one constant orange
          const k = span(p, sd.cool, sd.cool + S06.coolP)
          sd.face.color.lerpColors(hot, sd.c, k)
          sd.face.metalness = k * TUNING.aluminum.standard.metalness
        }
        sd.face.uFlat.value = flat
      }
      decal.visible = p < PH + 0.07
      dialGroup.visible = p > PH + 0.12
      decalMat.opacity = 1 - span(p, PH + 0.04, PH + 0.07)
      // the model's lines, once it starts to rise off the plan
      const up = p > PH + 0.04
      for (const l of lines) l.o.visible = up
      const fade = span(p, PH + 0.08, PH + 0.2) * 0.45
      for (const ed of edges) {
        ed.m.depthTest = up
        if (ed.ink !== 'orange') fadeEdge(ed.m, COLOR.cyan, COLOR.alu300, fade)
      }
      const grow = span(p, PH + 0.12, PH + 0.2)
      for (const tb of tubes) {
        const mm = land(tb.month)
        setGrowth(tb.t, tb.month ? span(p, mm - 0.02, mm) : grow)
      }
      for (const pl of pipeLines) {
        pl.m.transparent = true
        pl.m.opacity = 1 - grow
        pl.o.visible = up && grow < 1
      }
      // the inspection: three sweeps, the flange pulses on the last
      const loops = 3
      const band = bandMs
      const on = m >= 0 && m < band * loops
      const k = on ? (m % band) / band : 0
      if (spot) {
        spot.intensity = on ? 6 * Math.sin(Math.PI * k) : 0
        spot.target.position.x = vb[0] + 40 + (vb[2] - 80) * ease.machine(k)
      }
      const fx = m - band * (loops - 0.5)
      if (ring) {
        ring.visible = fx >= 0 && fx < 500
        const u = (fx % 250) / 250
        ring.scale.setScalar(1 + 0.3 * u)
      }
      return e
    }

    function reset() {
      t = 0
      running = false
      beat = undefined
      pose(0, -1)
    }

    return {
      three,
      rig,
      build,
      reset,
      start() {
        running = true
        t = 0
      },
      update(dt, p) {
        // the pose follows p even before start (seek, holds); only the loops need running
        const looping = running && p >= motionFromP
        if (looping) t += dt
        else t = 0
        const end = bandMs * 3
        const e = pose(p, looping ? Math.min(t, end) : -1)
        const month = Math.max(0, Math.min(3, Math.floor((p - motionFromP) / monthStepP)))
        const next: Beat =
          month > 0
            ? (`month${month}` as Beat)
            : looping && t >= bandMs * 2.5
              ? 'fixed'
              : e >= 0.999
                ? 'built'
                : 'running'
        const changed = next !== beat
        beat = next
        projectAnchors(
          anchors,
          rig.camera,
          w,
          h,
          (key) => e >= 0.999 && (months.get(key) ?? 0) <= month,
          labels,
        )
        return { beat: changed ? next : undefined, labels, animating: looping && t < end }
      },
      setPose(pp) {
        pose(pp === 'iso' ? 1 : 0, -1)
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
        three.clear()
      },
    }
  },
}

export default mod
