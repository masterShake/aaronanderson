import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { Beat, SceneModule } from '@/stage/types'
import type { Pen, Pt } from '@/drawings/types'
import { S03, S03_POSE } from '@/motion/timing/s03'
import { OrthoRig } from '@/stage/runtime/kit/rig'
import { lineMat, segments } from '@/stage/runtime/kit/lines'
import { EXTRUDE_FLOOR } from '@/stage/runtime/kit/extrude'
import { TUNING, aluminum, emissive, withFlatMix } from '@/stage/runtime/kit/materials'
import { ease, span } from '@/stage/runtime/kit/ease'
import { projectAnchors, type LabelMap } from '@/stage/runtime/kit/labels'
import {
  DIAL,
  G,
  MOVING,
  S03_BOUNDS,
  S03_DESIGN,
  S03_FAMILY,
  TRAVEL,
  dialC,
  place,
  sectionFrame,
  wallPieces,
} from './s03/section'
import { S03_LABELS } from './s03/labels'

/**
 * S-03, the reading machine in WebGL. Pose 0 draws exactly the SVG's section A–A
 * (sectionFrame: the same fills and lines), at the front elevation. After the
 * hand-off the machine extrudes back, anodizes and the camera turns to the
 * three-quarter view (az 32°, el 20°). From motionFromP the batch runs once:
 * two documents read within tolerance become data cards, the third goes down
 * the chute, and the scene holds (beat 'held') until command('approve').
 * The approved state belongs to the figure; command('approve', 'instant') restores it.
 */

const RAD = Math.PI / 180
type Step = 'feed' | 'read' | 'out' | 'gate' | 'drop'
type Leg = readonly [doc: number, step: Step, ms: number]
/** Two documents read within tolerance; the third goes to a person (views/s03 S03_BATCH). */
const LEGS: readonly Leg[] = [0, 1, 2].flatMap((d): Leg[] => {
  const tail: Leg[] =
    d < 2
      ? [[d, 'out', S03.outMs]]
      : [
          [d, 'gate', S03.gateMs],
          [d, 'drop', S03.dropMs],
        ]
  return [[d, 'feed', S03.feedMs], [d, 'read', S03.readMs], ...tail]
})
const HELD_MS = LEGS.reduce((s, l) => s + l[2], 0)
const MOVES: ReadonlySet<string> = new Set(MOVING)

const mod: SceneModule = {
  id: 's03',
  create(ctx) {
    const F = S03_FAMILY[ctx.layout]
    const vb = ctx.viewBox
    const H = vb[1] + vb[3]
    const s = F.s
    const D = S03_DESIGN.depth * s
    const C = ctx.tokens.color
    const three = new Scene()
    const rig = new OrthoRig(
      'front',
      ctx.tokens.scene.padding,
      S03_POSE.azDeg * RAD,
      S03_POSE.elDeg * RAD,
    )
    const own: { geometry: BufferGeometry; material?: Material | Material[] }[] = []
    const ownMats: Material[] = []
    const mats: [LineMaterial, Pen][] = []
    const flat: ReturnType<typeof withFlatMix>[] = []
    const bounds: Vector3[] = []
    const anchors = new Map<string, Object3D>()
    const labels: LabelMap = new Map()
    const body = new Group()
    const live = new Group()
    const docs: Mesh[] = []
    const cards: Group[] = []
    const pivots: Record<string, Group> = {}
    let lamp: Mesh | null = null
    let stamp: Mesh | null = null
    let plate: Mesh | null = null
    let back: Mesh | null = null
    let w = 1
    let h = 1
    // batch state
    let p = 0
    let batch = -1
    let approveT = -1
    let instant = false
    let needle = 0
    let needleV = 0
    let beat: Beat | undefined

    /** SVG (family units) → world on the front plane. */
    const W = ([x, y]: Pt, z = 0) => new Vector3(x, H - y, z)
    const shape = (pts: readonly Pt[]) => new Shape(pts.map(([x, y]) => new Vector2(x, H - y)))
    const add = <T extends Mesh>(m: T, parent: Object3D = three) => {
      own.push(m)
      parent.add(m)
      return m
    }
    const basic = (c: number) => new MeshBasicMaterial({ color: c, toneMapped: false })
    const metal = () => {
      const m = withFlatMix(aluminum(ctx.quality))
      flat.push(m)
      return m
    }
    const inkHex: Record<string, number> = {
      cyan: C.cyan,
      'cyan-dim': C.cyanDim,
      redline: C.redline,
      paper: C.paper,
    }

    function* build() {
      const frame = sectionFrame(ctx.layout)
      // fills: one mesh per colour, on the front plane under the lines
      const byInk = new Map<string, Shape[]>()
      for (const f of frame.fills) {
        const list = byInk.get(f.ink) ?? []
        list.push(shape(f.pts))
        byInk.set(f.ink, list)
      }
      for (const [ink, shapes] of byInk) {
        const m = add(
          new Mesh(
            new ShapeGeometry(shapes),
            basic(ink === 'deep' ? C.blueprintDeep : (inkHex[ink] ?? C.cyan)),
          ),
        )
        m.position.z = 0.5
      }
      yield
      // lines: one LineSegments2 per pen and ink; the moving parts in their own pivots
      const groups = new Map<string, number[]>()
      const moving = new Map<string, number[]>()
      for (const l of frame.lines) {
        const pos: number[] = []
        const n = l.pts.length
        for (let i = 0; i < (l.closed ? n : n - 1); i++) {
          const a = l.pts[i]!
          const b = l.pts[(i + 1) % n]!
          if (a[0] === b[0] && a[1] === b[1]) continue
          pos.push(a[0], H - a[1], 1, b[0], H - b[1], 1)
        }
        const key = `${l.pen}|${l.ink}`
        if (MOVES.has(l.id)) moving.set(l.id, pos)
        else groups.set(key, [...(groups.get(key) ?? []), ...pos])
      }
      const lineFor = (key: string, pos: number[], parent: Object3D) => {
        const [pen, ink] = key.split('|') as [Pen, string]
        const m = lineMat({ color: inkHex[ink] ?? C.cyan, width: ctx.strokePx(pen) })
        mats.push([m, pen])
        const seg = segments(pos, m)
        own.push({ geometry: seg.geometry })
        parent.add(seg)
      }
      for (const [key, pos] of groups) lineFor(key, pos, three)
      const pivotAt = (id: string, c: Pt) => {
        const g = new Group()
        const o = W(c)
        g.position.set(o.x, o.y, 0)
        three.add(g)
        pivots[id] = g
        return g
      }
      for (const l of frame.lines) {
        if (!MOVES.has(l.id)) continue
        const c: Pt =
          l.id === 'needle'
            ? place(ctx.layout, dialC(ctx.layout))
            : l.id === 'gate'
              ? place(ctx.layout, G.gate.pivot)
              : place(ctx.layout, G.rollers[Number(l.id.slice(-1))]!)
        const g = pivotAt(l.id, c)
        const o = W(c)
        const pos = moving
          .get(l.id)!
          .map((v, i) => (i % 3 === 0 ? v - o.x : i % 3 === 1 ? v - o.y : v))
        lineFor(`${l.pen}|${l.ink}`, pos, g)
      }
      yield
      // the machine, extruded back from the cut (−z), aluminium that starts flat at the panel tone
      three.add(body)
      const ext = (pts: readonly Pt[][], depth: number) => {
        const g = new ExtrudeGeometry(
          pts.map((q) => shape(q)),
          { depth, steps: 1, bevelEnabled: false, curveSegments: 1 },
        ).translate(0, 0, -depth)
        return add(new Mesh(g, metal()), body)
      }
      const rect = ([x, y, rw, rh]: readonly number[]): Pt[] => [
        place(ctx.layout, [x!, y!]),
        place(ctx.layout, [x! + rw!, y!]),
        place(ctx.layout, [x! + rw!, y! + rh!]),
        place(ctx.layout, [x!, y! + rh!]),
      ]
      ext(
        [
          ...wallPieces().map((q) => q.map((pt) => place(ctx.layout, pt))),
          G.hopper.map((pt) => place(ctx.layout, pt)),
          rect(G.head),
          rect(G.tray),
          ...G.legs.slice(0, 2).map(rect),
        ],
        D,
      )
      ext([rect(G.desk), rect(G.signTray), ...G.legs.slice(2).map(rect)], D * 0.6)
      const { x0, y0, x1, y1, t } = G.body
      back = add(
        new Mesh(new PlaneGeometry((x1 - x0 - 2 * t) * s, (y1 - y0 - 2 * t) * s), metal()),
        body,
      )
      back.position.copy(W(place(ctx.layout, [(x0 + x1) / 2, (y0 + y1) / 2]), -D))
      for (const r of G.rollers) {
        const m = add(
          new Mesh(
            new CylinderGeometry(G.rollerR * s, G.rollerR * s, D, 24).rotateX(Math.PI / 2),
            metal(),
          ),
          body,
        )
        m.position.copy(W(place(ctx.layout, r), -D / 2))
      }
      plate = add(new Mesh(new BoxGeometry(G.gate.len * s, 3 * s, D * 0.9), metal()), pivots.gate!)
      plate.position.set((G.gate.len * s) / 2, 0, -D * 0.45)
      yield
      // the batch: documents, cards with bars, the lamp and the stamp
      three.add(live)
      const paper = basic(C.paper)
      const ink = basic(C.blueprint)
      ownMats.push(paper, ink)
      const docGeo = new BoxGeometry(G.doc[2] * s, G.doc[3] * s, D * 0.7)
      const cardGeo = new BoxGeometry(G.card[2] * s, G.card[3] * s, D * 0.55)
      own.push({ geometry: docGeo }, { geometry: cardGeo })
      // a data card: paper with its filled (blueprint) face up
      const cardMats = [paper, paper, ink, paper, paper, paper]
      for (let i = 0; i < 3; i++) {
        const m = new Mesh(docGeo, paper)
        live.add(m)
        docs.push(m)
        const g = new Group()
        g.add(new Mesh(cardGeo, cardMats))
        live.add(g)
        cards.push(g)
      }
      const lampGeo = new SphereGeometry(G.lamp.r * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
      lamp = add(new Mesh(lampGeo, emissive()), live)
      lamp.position.copy(W(place(ctx.layout, G.lamp.c), -D / 2))
      stamp = add(new Mesh(new BoxGeometry(18 * s, 4 * s, D * 0.3), emissive()), docs[2]!)
      stamp.position.set(0, 4 * s, 0)
      // label anchors on the front plane, at each label's top-left corner
      for (const [key, at] of Object.entries(S03_LABELS)) {
        const o = new Object3D()
        // mid-depth, so a label stays with the machine as it turns (pose 0 ignores depth)
        o.position.copy(W(at[ctx.layout], key === 'section' ? 0 : -D / 2))
        three.add(o)
        anchors.set(key, o)
      }
      const [bx0, by0] = place(ctx.layout, [S03_BOUNDS.x0, S03_BOUNDS.y0])
      const [bx1, by1] = place(ctx.layout, [S03_BOUNDS.x1, S03_BOUNDS.y1])
      for (const x of [bx0, bx1])
        for (const y of [by0, by1]) for (const z of [0, -D]) bounds.push(W([x, y], z))
      const span3 = Math.max(vb[2], vb[3])
      const [ox, oy, oz] = TUNING.keyLight.offset
      const key = new PointLight('#ffffff', TUNING.keyLight.intensity, 0, 0)
      key.position.set(vb[2] / 2 + ox * span3, H / 2 + oy * span3, -D / 2 - oz * span3)
      three.add(key)
      reset()
    }

    /** Document i's offset from its rest (design units) at time t of its leg. */
    function place3(i: number, leg: Step | 'done' | 'wait', k: number): [number, number, boolean] {
      if (leg === 'wait') return [0, 0, false]
      if (leg === 'feed') {
        const drop = ease.machine(span(k, 0, 0.4))
        return [TRAVEL.read * ease.machine(span(k, 0.4, 1)), TRAVEL.drop * (1 - drop), true]
      }
      if (leg === 'read') return [TRAVEL.read, 0, true]
      if (leg === 'out') return [TRAVEL.read + (TRAVEL.out - TRAVEL.read) * k, 0, k < 1]
      if (leg === 'gate') return [TRAVEL.read + (TRAVEL.gate - TRAVEL.read) * k, 0, true]
      if (leg === 'drop') {
        const e = ease.machine(k)
        return [TRAVEL.gate + (TRAVEL.heldX - TRAVEL.gate) * e, TRAVEL.heldY * e, true]
      }
      return i === 2 ? [TRAVEL.heldX, TRAVEL.heldY, true] : [TRAVEL.out, 0, false]
    }

    /** Lays out the batch at time t (ms since it started; −1 = not started). */
    function pose(t: number) {
      let at = -1
      let k = 0
      let sum = 0
      if (t >= 0) {
        at = LEGS.length
        for (let i = 0; i < LEGS.length; i++) {
          if (t < sum + LEGS[i]![2]) {
            at = i
            k = (t - sum) / LEGS[i]![2]
            break
          }
          sum += LEGS[i]![2]
        }
      }
      const held = at >= LEGS.length
      const approved = held && approveT >= 0
      const aK = approved ? Math.min(1, approveT / S03.approveMs) : 0
      let cardsIn = 0
      let target = 0
      let gate = 0
      for (let i = 0; i < 3; i++) {
        const curDoc = at >= 0 && at < LEGS.length ? LEGS[at]![0] : -1
        const leg: Step | 'done' | 'wait' =
          at < 0 ? 'wait' : held || curDoc > i ? 'done' : curDoc === i ? LEGS[at]![1] : 'wait'
        const [dx, dy, vis] = place3(i, leg, k)
        const d = docs[i]!
        d.visible = vis
        d.position.copy(
          W(
            place(ctx.layout, [G.doc[0] + G.doc[2] / 2 + dx, G.doc[1] + G.doc[3] / 2 + dy]),
            -D * 0.45,
          ),
        )
        if (i < 2 && (leg === 'done' || leg === 'out'))
          cardsIn = Math.max(cardsIn, i + (leg === 'out' ? k : 1))
        if (curDoc === i && (leg === 'read' || leg === 'out'))
          target = i < 2 ? DIAL.okDeg : DIAL.checkDeg
        if (i === 2 && (leg === 'gate' || leg === 'drop')) {
          target = DIAL.checkDeg
          gate = leg === 'gate' ? k : 1
        }
      }
      if (held && !approved) {
        target = DIAL.checkDeg
        gate = 1
      }
      if (approved) gate = 1 - Math.min(1, approveT / S03.gateMs)
      const card3 = approved ? span(approveT, S03.stampMs, S03.approveMs) : 0
      for (let i = 0; i < 3; i++) {
        const c = cards[i]!
        const kIn = i < 2 ? Math.min(1, Math.max(0, cardsIn - i)) : card3
        c.visible = kIn > 0
        const x = G.card[0] + G.card[2] / 2 + TRAVEL.card * (1 - ease.settle(kIn))
        const y = G.card[1] - i * (G.card[3] + 1) + G.card[3] / 2
        c.position.copy(W(place(ctx.layout, [x, y]), -D / 2))
      }
      pivots.gate!.rotation.z = -G.gate.deg * RAD * ease.machine(gate)
      lamp!.visible = held && !approved && rigE() > 0
      stamp!.visible = approved && aK > 0
      stamp!.position.y =
        (4 + TRAVEL.stamp * -(1 - ease.machine(span(approveT, 0, S03.stampMs)))) * s
      return {
        held,
        approved,
        target,
        spinning: at >= 0 && at < LEGS.length && LEGS[at]![1] === 'feed',
      }
    }

    let e = 0
    const rigE = () => e

    function model(pp: number) {
      e = ease.machine(span(pp, S03.handoffP + 0.04, S03.tiltToP))
      rig.pose(e)
      body.scale.z = Math.max(
        EXTRUDE_FLOOR,
        ease.settle(span(pp, S03.extrudeFromP, S03.extrudeToP)),
      )
      const fl = 1 - span(pp, S03.anodizeFromP, S03.anodizeToP)
      for (const m of flat) m.uFlat.value = fl
      // At pose 0 the frame's fills and lines are the whole picture (the pencil ghost shows
      // through the open interior, as in the SVG); the solid model exists once it turns.
      // (The walls stay, flat under their own fills, so compileAsync sees their program.)
      live.visible = e > 0
      if (plate) plate.visible = e > 0
      if (back) back.visible = e > 0
    }

    function reset() {
      p = 0
      batch = -1
      approveT = -1
      instant = false
      needle = 0
      needleV = 0
      beat = undefined
      model(0)
      pose(-1)
      pivots.needle!.rotation.z = 0
    }

    return {
      three,
      rig,
      build,
      reset,
      start() {},
      update(dt, pp) {
        p = pp
        model(p)
        let next: Beat | undefined = beat
        if (batch < 0 && p >= S03.motionFromP) {
          batch = 0
          next = 'running'
        }
        if (batch >= 0) batch = Math.min(HELD_MS, batch + dt)
        if (instant && batch >= 0) {
          batch = HELD_MS
          approveT = S03.approveMs
        } else if (approveT >= 0 && batch >= HELD_MS)
          approveT = Math.min(S03.approveMs, approveT + dt)
        const st = pose(batch)
        if (st.held && !st.approved) next = 'held'
        if (st.approved && approveT >= S03.approveMs) next = 'approved'
        // needle: θ'' = 170(θt − θ) − 18θ' (the gauge kit's spring), substeps ≤ 1/120 s
        const tgt = st.approved ? 0 : st.target
        let left = Math.min(dt, 100) / 1000
        while (left > 0) {
          const hh = Math.min(left, 1 / 120)
          needleV += (170 * (tgt - needle) - 18 * needleV) * hh
          needle += needleV * hh
          left -= hh
        }
        const swinging = Math.abs(tgt - needle) > 0.05 || Math.abs(needleV) > 0.05
        pivots.needle!.rotation.z = -needle * RAD
        if (st.spinning) for (const r of ['spoke.0', 'spoke.1']) pivots[r]!.rotation.z -= dt * 0.012
        const changed = next !== beat
        beat = next
        projectAnchors(anchors, rig.camera, w, h, () => true, labels)
        const busy =
          (batch >= 0 && batch < HELD_MS) || (approveT >= 0 && approveT < S03.approveMs) || swinging
        return { beat: changed ? next : undefined, labels, animating: busy }
      },
      setPose(pp) {
        rig.pose(pp === 'iso' ? 1 : 0)
      },
      command(c, arg) {
        if (c === 'approve') {
          if (approveT < 0) approveT = 0
          if (arg === 'instant') instant = true
        } else if (c === 'runAnother') {
          batch = -1
          approveT = -1
          instant = false
          beat = undefined
        }
      },
      resize(cw, ch) {
        w = cw
        h = ch
        rig.fit(vb, cw, ch, bounds)
        for (const [m, pen] of mats) m.linewidth = ctx.strokePx(pen)
      },
      dispose() {
        for (const o of own) {
          o.geometry.dispose()
          const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
          for (const m of ms) if (!m.userData.shared) m.dispose()
        }
        for (const [m] of mats) m.dispose()
        for (const m of ownMats) m.dispose()
        three.clear()
      },
    }
  },
}

export default mod
