/**
 * planDrawing(house): the finished floor-plan sheet as primitives, in the order a draftsperson
 * builds it up. Each primitive is tagged with the beat that draws it (lib/draft/script.ts) and
 * with its element index.
 */
import { codeChecks, EGRESS, EGRESS_DOOR_MIN, HALL_MIN } from '@/lib/house/code-checks'
import { pieceLength, type OutlinePiece } from '@/lib/geom/outline'
import { bounds, boundsOfPoints, expand, translate, type Rect, type Vec2 } from '@/lib/geom/rect'
import type { ResolvedHouse, ResolvedWall } from '@/lib/house/resolve'
import { houseSummary } from '@/lib/house/summary'
import { testFitChip, testFits } from '@/lib/house/testfits'
import type { Door, Window } from '@/lib/house/types'
import { dimGeometry } from '@/lib/plan/dims'
import type { PenId } from '@/lib/plan/pens'
import {
  fixtureSymbol,
  hexagon,
  northArrow,
  rectLine,
  slidingPanels,
  smokeAlarm,
  swingDoor,
  wallPoint,
  windowSymbol,
  type Polyline,
} from '@/lib/plan/symbols'
import type {
  BeatId,
  ElementKind,
  ElementRef,
  Fill,
  FitGroup,
  Label,
  Mark,
  PlanDrawing,
  Stroke,
} from '@/lib/plan/types'
import { CUT_PLANE, formatFtIn, formatIn, formatSize } from '@/lib/units'

/** Setout lines run this far past every corner of the building line. */
export const SETOUT_OVERRUN = 24
/** Test fits A and C sit this far from the real house. */
export const FIT_OFFSET = { wide: 720, narrow: 528 } as const

const INTERIOR_ORDER = [
  'hall-s',
  'hall-n',
  'bed2-bed3',
  'clo2-front',
  'clo2-end',
  'clo3-front',
  'clo3-end',
  'bed3-great',
  'primary-e',
  'wet',
  'laundry-great',
  'bath-wic',
  'bath2-laundry',
]

const LABEL_FIRST = ['great', 'kitchen']

export function planDrawing(house: ResolvedHouse): PlanDrawing {
  const { spec } = house
  const fp = spec.footprint
  const elements: ElementRef[] = []
  const index = new Map<string, number>()
  const el = (kind: ElementKind, id: string) => {
    const key = `${kind}:${id}`
    let i = index.get(key)
    if (i === undefined) {
      i = elements.length
      elements.push({ kind, id })
      index.set(key, i)
    }
    return i
  }
  const strokes: Stroke[] = []
  const fills: Fill[] = []
  const labels: Label[] = []
  const marks: Mark[] = []
  const stroke = (pen: PenId, beat: BeatId, e: number, pts: Polyline, extra?: Partial<Stroke>) =>
    strokes.push({ pen, beat, el: e, pts, ...extra })
  const label = (l: Omit<Label, 'anchor' | 'color' | 'lod'> & Partial<Pick<Label, 'anchor' | 'color' | 'lod'>>) =>
    labels.push({ anchor: { x: 'center', y: 'middle' }, color: 'ink', lod: 1, ...l })
  const report = codeChecks(house)

  // ── Setout: construction lines on the building line, overrunning every corner. ───────────
  {
    const o = SETOUT_OVERRUN
    const lines: [string, Polyline][] = [
      ['s', [[fp[0] - o, fp[1]], [fp[2] + o, fp[1]]]],
      ['e', [[fp[2], fp[1] - o], [fp[2], fp[3] + o]]],
      ['n', [[fp[2] + o, fp[3]], [fp[0] - o, fp[3]]]],
      ['w', [[fp[0], fp[3] + o], [fp[0], fp[1] - o]]],
    ]
    for (const [id, pts] of lines) stroke('setout', 'setout', el('setout', id), pts, { track: 0 })
  }

  // ── Test fits: three layouts compared side by side; B is the real plan. ──────────────────
  const fits = testFits(spec)
  for (const fit of fits) {
    const group = fit.id as FitGroup
    const e = el('testfit', fit.id)
    const pen: PenId = group === 'B' ? 'guide' : 'ai'
    const track = group === 'B' ? 0 : group === 'A' ? 1 : 2
    if (group !== 'B') stroke(pen, 'testfits', e, rectLine(fp), { group, track })
    for (const room of fit.rooms) stroke(pen, 'testfits', e, rectLine(room.rect), { group, track })
    marks.push({
      id: `fit-${fit.id}`,
      beat: 'chips',
      at: [(fp[0] + fp[2]) / 2, fp[3]],
      text: testFitChip(fit),
      group,
      dir: 'n',
      ...(group === 'B' ? { then: 'B · SELECTED', thenCheck: true } : {}),
    })
  }
  // Selection brackets around B.
  {
    const e = el('check', 'select')
    const d = 18
    const arm = 48
    const [x0, y0, x1, y1] = [fp[0] - d, fp[1] - d, fp[2] + d, fp[3] + d]
    const brackets: Polyline[] = [
      [[x0 + arm, y0], [x0, y0], [x0, y0 + arm]],
      [[x1 - arm, y0], [x1, y0], [x1, y0 + arm]],
      [[x1, y1 - arm], [x1, y1], [x1 - arm, y1]],
      [[x0, y1 - arm], [x0, y1], [x0 + arm, y1]],
    ]
    for (const b of brackets) stroke('ai-bold', 'select', e, b, { track: 0 })
  }

  // ── Walls: the exact outline of all wall rectangles minus the rough openings. ────────────
  const ownerWall = (q: OutlinePiece) => house.walls[q.owner]
  const perimeter = 2 * (fp[2] - fp[0] + fp[3] - fp[1])
  /** Counter-clockwise position of a point around the building line, starting at the SW corner. */
  const ccw = ([x, y]: Vec2): number => {
    const W = fp[2] - fp[0]
    const D = fp[3] - fp[1]
    const dS = Math.abs(y - fp[1])
    const dE = Math.abs(x - fp[2])
    const dN = Math.abs(y - fp[3])
    const dW = Math.abs(x - fp[0])
    const m = Math.min(dS, dE, dN, dW)
    if (m === dS) return x - fp[0]
    if (m === dE) return W + (y - fp[1])
    if (m === dN) return W + D + (fp[2] - x)
    return (2 * W + D + (fp[3] - y)) % perimeter
  }
  const extPieces = house.outline.filter((q) => ownerWall(q).spec.kind === 'exterior')
  const onBuildingLine = (q: OutlinePiece) =>
    (q.a[1] === q.b[1] && (q.a[1] === fp[1] || q.a[1] === fp[3])) ||
    (q.a[0] === q.b[0] && (q.a[0] === fp[0] || q.a[0] === fp[2]))
  // Outer faces already run counter-clockwise (region on the left).
  const outer = extPieces.filter(onBuildingLine).sort((p, q) => ccw(p.a) - ccw(q.a))
  // Inner faces and jambs: orient counter-clockwise around the building as well.
  const inner = extPieces
    .filter((q) => !onBuildingLine(q))
    .map((q) => (ccw(q.b) < ccw(q.a) && ccw(q.a) - ccw(q.b) < perimeter / 2 ? { ...q, a: q.b, b: q.a } : q))
    .sort((p, q) => ccw(p.a) - ccw(q.a) || pieceLength(q) - pieceLength(p))
  for (const q of outer) stroke('cut', 'exterior', el('wall', ownerWall(q).spec.id), [q.a, q.b], { track: 0 })
  for (const q of inner) stroke('cut', 'exterior', el('wall', ownerWall(q).spec.id), [q.a, q.b], { track: 1 })

  for (const id of INTERIOR_ORDER) {
    const w = house.wall(id)
    const wi = house.walls.indexOf(w)
    const pieces = house.outline
      .filter((q) => q.owner === wi)
      .map((q) => orientAlong(w, q))
      .sort((p, q) => sAt(w, p.a) - sAt(w, q.a))
    for (const q of pieces) {
      const face = faceOf(w, q)
      stroke('cut', 'interior', el('wall', id), [q.a, q.b], { track: face === 'lo' ? 0 : 1 })
    }
  }
  // Poché: one fill per wall piece, wiping along the wall in the pen's direction.
  for (const w of house.walls) {
    const e = el('wall', w.spec.id)
    const reverse = w.spec.kind === 'exterior' && (w.spec.id === 'ext-n' || w.spec.id === 'ext-w')
    const tc = (w.t0 + w.t1) / 2
    const from = wallPoint(w, reverse ? w.s1 : w.s0, tc)
    const to = wallPoint(w, reverse ? w.s0 : w.s1, tc)
    for (const p of w.pieces)
      fills.push({ kind: 'poche', beat: 'poche', el: e, poly: rectPoly(p), wipe: { from, to } })
  }

  // ── Openings: windows by tag, then swing doors, then sliding and bypass panels. ─────────
  {
    const all = house.walls.flatMap((w) => w.openings.map((o) => ({ w, o })))
    const windows = all.filter((x) => x.o.spec.kind === 'window').sort((a, b) => (a.o.spec as Window).tag - (b.o.spec as Window).tag)
    for (const { w, o } of windows) {
      const e = el('opening', o.spec.id)
      const sym = windowSymbol(w, o)
      stroke('ink', 'openings', e, sym.frame[0], { track: 0 })
      stroke('ink', 'openings', e, sym.frame[1], { track: 1 })
      stroke('fine', 'openings', e, sym.glass[0], { track: 0 })
    }
    const doors = all.filter((x) => x.o.spec.kind === 'door')
    const swings = doors.filter((x) => (x.o.spec as Door).op === 'swing').sort((a, b) => a.o.spec.id.localeCompare(b.o.spec.id))
    swings.forEach(({ w, o }, i) => {
      const e = el('opening', o.spec.id)
      const sym = swingDoor(w, o)
      stroke('ink', 'openings', e, sym.leaf, { track: i % 2 })
      stroke('fine', 'openings', e, sym.arc, { track: i % 2 })
    })
    const panels = doors.filter((x) => (x.o.spec as Door).op !== 'swing').sort((a, b) => a.o.spec.id.localeCompare(b.o.spec.id))
    panels.forEach(({ w, o }, i) => {
      const e = el('opening', o.spec.id)
      for (const p of slidingPanels(w, o)) stroke('ink', 'openings', e, p, { track: i % 2 })
    })
  }

  // ── Casework and fixtures. Kitchen first, then the baths, laundry and closets. ─────────
  {
    const order = ['kitchen', 'bath1', 'bath2', 'laundry', 'clo2', 'clo3', 'wic']
    const fixtures = [...spec.fixtures].sort((a, b) => order.indexOf(a.room) - order.indexOf(b.room))
    fixtures.forEach((f, i) => {
      const e = el('fixture', f.id)
      const overhead = f.z[0] > CUT_PLANE
      const sym = fixtureSymbol(f)
      const track = i % 2
      for (const line of sym.outline) stroke(overhead ? 'overhead' : 'graphite', 'casework', e, line, { track })
      for (const line of sym.detail) stroke(overhead ? 'overhead' : 'fine', 'casework', e, line, { track })
      const note = f.kind === 'fridge' ? 'REF' : f.kind === 'dw' ? 'DW' : f.kind === 'washer' ? 'W' : f.kind === 'dryer' ? 'D' : null
      if (note) {
        // The DW sits under the upper cabinets; keep its tag clear of their dashed front edge.
        const at: Vec2 = [(f.rect[0] + f.rect[2]) / 2, f.kind === 'dw' ? f.rect[1] + 6 : (f.rect[1] + f.rect[3]) / 2]
        label({ beat: 'labels', el: e, text: note, at, rot: 0, size: 'note', color: 'graphite', lod: 2 })
      }
    })
  }

  // ── Site: porch, posts, steps, roof outline (overhead) and ridge. ────────────────────────
  {
    const porch = spec.porch
    const e = el('porch', 'porch')
    const [px0, py0, px1, py1] = porch.rect
    stroke('ink', 'site', e, [[px0, py1], [px0, py0], [px1, py0], [px1, py1]], { track: 0 })
    for (const post of porch.posts) {
      stroke('ink', 'site', e, rectLine(post), { track: 0 })
      fills.push({ kind: 'solid', beat: 'site', el: e, poly: rectPoly(post) })
    }
    const st = porch.steps.rect
    stroke('ink', 'site', e, rectLine(st), { track: 0 })
    const treads = porch.steps.risers - 1
    for (let i = 1; i < treads + 1; i++) {
      const y = st[3] - ((st[3] - st[1]) * i) / treads
      if (y > st[1]) stroke('fine', 'site', e, [[st[0], y], [st[2], y]], { track: 0 })
    }
    const roofE = el('roof', 'roof')
    const m = spec.roof.main
    const outline: Rect = [fp[0] - m.rake, fp[1] - m.eave, fp[2] + m.rake, fp[3] + m.eave]
    stroke('overhead', 'site', roofE, rectLine(outline), { track: 0 })
    const pr = spec.roof.porch.rect
    stroke('overhead', 'site', roofE, [[pr[0], pr[3]], [pr[0], pr[1]], [pr[2], pr[1]], [pr[2], pr[3]]], { track: 0 })
    stroke('ridge', 'site', roofE, [[outline[0], m.ridgeAt], [outline[2], m.ridgeAt]], { track: 0 })
  }

  // ── Dimensions: north overall, north partitions, west overall, west partitions, interior.
  {
    const order = ['dim-n-2', 'dim-n-1', 'dim-w-2', 'dim-w-1', 'dim-int-1']
    const dims = [...spec.dims].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    for (const d of dims) {
      const e = el('dim', d.id)
      const g = dimGeometry(house, d)
      for (const x of g.extensions) stroke('fine', 'dims', e, x, { track: 1 })
      stroke('fine', 'dims', e, g.line, { track: 0 })
      for (const t of g.ticks) stroke('tick', 'dims', e, t, { track: 1 })
      for (const t of g.texts)
        label({ beat: 'dims', el: e, text: t.text, at: t.at, rot: t.rot, size: 'dim', anchor: { x: 'center', y: 'bottom' }, lod: d.lod })
    }
  }

  // ── Labels: room names (great room and kitchen first) with sizes, then tags and annotations.
  {
    const rooms = [...house.rooms]
      .filter((r) => !r.spec.unlabeled)
      .sort((a, b) => rank(a.spec.id) - rank(b.spec.id))
    for (const r of rooms) {
      const e = el('room', r.spec.id)
      const at = r.spec.label ?? [(r.spec.rect[0] + r.spec.rect[2]) / 2, (r.spec.rect[1] + r.spec.rect[3]) / 2]
      const lod = r.spec.lod ?? 1
      if (r.spec.size) {
        label({ beat: 'labels', el: e, text: r.spec.name, at: [at[0], at[1] + 1.5], rot: 0, size: 'name', anchor: { x: 'center', y: 'bottom' }, lod })
        label({ beat: 'labels', el: e, text: formatSize(...r.size), at: [at[0], at[1] - 1.5], rot: 0, size: 'size', anchor: { x: 'center', y: 'top' }, color: 'graphite', lod: 2 })
      } else {
        label({ beat: 'labels', el: e, text: r.spec.name, at, rot: 0, size: 'name', lod })
      }
    }
    // Window tags: a hexagon 2′ outside the wall face, with the window number.
    for (const w of house.walls) {
      for (const o of w.openings) {
        if (o.spec.kind !== 'window') continue
        const e = el('opening', o.spec.id)
        const outward = outwardOf(w, fp)
        const faceT = outward < 0 ? w.t0 : w.t1
        const c = wallPoint(w, (o.s0 + o.s1) / 2, faceT + outward * 24)
        stroke('tag', 'labels', e, hexagon(c, 18), { track: 0 })
        label({ beat: 'labels', el: e, text: String((o.spec as Window).tag), at: c, rot: 0, size: 'tag', lod: 2 })
      }
    }
    const ann = el('annotation', 'north-arrow')
    const na = northArrow(spec.annotations.northArrow, 12)
    stroke('ink', 'labels', ann, na.ring, { track: 0 })
    fills.push({ kind: 'solid', beat: 'labels', el: ann, poly: na.triangle })
    label({ beat: 'labels', el: ann, text: 'N', at: [spec.annotations.northArrow[0], spec.annotations.northArrow[1] + 15], rot: 0, size: 'tag', anchor: { x: 'center', y: 'bottom' } })
    const sb = el('annotation', 'scale-bar')
    const [sx, sy] = spec.annotations.scaleBar
    const marksAt = [0, 48, 96, 192]
    stroke('ink', 'labels', sb, rectLine([sx, sy - 3, sx + 192, sy + 3]), { track: 0 })
    for (let i = 0; i + 1 < marksAt.length; i += 2)
      fills.push({ kind: 'solid', beat: 'labels', el: sb, poly: rectPoly([sx + marksAt[i], sy - 3, sx + marksAt[i + 1], sy + 3]) })
    marksAt.forEach((m, i) =>
      label({ beat: 'labels', el: sb, text: i === 0 ? '0' : formatFtIn(m), at: [sx + m, sy - 6], rot: 0, size: 'tag', anchor: { x: 'center', y: 'top' } }),
    )
  }

  // ── AI code checks: markup in blue, values from codeChecks. ─────────────────────────────
  {
    // R310: a caliper across one egress window per bedroom, inside the room.
    const e = el('check', 'egress')
    const shown = report.egress.map((r) => r.windows.find((w) => w.pass)).filter((w) => w !== undefined)
    for (const win of shown) {
      const o = house.opening(win.id)
      const w = house.wall(o.spec.wall)
      const inward = -outwardOf(w, fp)
      const t = (inward > 0 ? w.t1 : w.t0) + inward * 9
      for (const line of caliper(w, o.s0, o.s1, t, 6)) stroke('ai', 'egress', e, line, { track: 0 })
    }
    // The chip hangs off the primary bedroom's north window, clear of the dimension strings.
    const primary = shown.find((w) => w.id === 'W07') ?? shown[0]
    const best = Math.min(...shown.map((w) => w.area))
    if (primary) {
      const o = house.opening(primary.id)
      const w = house.wall(o.spec.wall)
      const inward = -outwardOf(w, fp)
      const t = (inward > 0 ? w.t1 : w.t0) + inward * 9
      marks.push({
        id: 'egress',
        beat: 'egress',
        at: wallPoint(w, (o.s0 + o.s1) / 2, t),
        text: `R310 EGRESS · ${shown.length} BEDROOMS · ${best.toFixed(1)} SF ≥ ${EGRESS.area}`,
        check: true,
        dir: inward > 0 ? 'n' : 's',
      })
    }

    // R311 hall width.
    const hall = report.hall[0]
    const hallRoom = house.room(hall.room).spec.rect
    const he = el('check', 'hall')
    const hx = 60
    for (const line of caliperY(hx, hallRoom[1], hallRoom[3], 6)) stroke('ai', 'hall', he, line, { track: 0 })
    marks.push({ id: 'hall', beat: 'hall', at: [hx, hallRoom[3]], text: `R311 HALL · ${formatIn(hall.clear)} ≥ ${formatIn(HALL_MIN)}`, check: true, dir: 'n' })

    // R311 egress door clear width, outside the door.
    const de = el('check', 'door')
    const door = house.opening(report.door.opening)
    const mid = (door.s0 + door.s1) / 2
    const [c0, c1] = [mid - report.door.clear / 2, mid + report.door.clear / 2]
    for (const line of caliper(house.wall(door.spec.wall), c0, c1, -9, 6)) stroke('ai', 'door', de, line, { track: 0 })
    marks.push({ id: 'door', beat: 'door', at: [mid, -9], text: `R311 DOOR · ${formatIn(report.door.clear)} CLR ≥ ${formatIn(EGRESS_DOOR_MIN)}`, check: true, dir: 's' })

    // R307 WC clearance zones.
    const we = el('check', 'wc')
    for (const w of report.wc) {
      fills.push({ kind: 'wash', beat: 'wc', el: we, poly: rectPoly(w.box) })
      stroke('ai-dash', 'wc', we, rectLine(w.box), { track: 0 })
    }
    const wc2 = report.wc[report.wc.length - 1]
    if (wc2)
      marks.push({ id: 'wc', beat: 'wc', at: [wc2.box[2], (wc2.box[1] + wc2.box[3]) / 2], text: 'R307 WC · 15″ SIDES · 21″ FRONT', check: true, dir: 'e' })

    // R314 smoke alarms: the catch. They are "not shown" until AI adds them.
    for (const d of spec.devices) for (const line of smokeAlarm(d.at)) stroke('alarm', 'alarms', el('device', d.id), line, { track: 0 })
    const hallAlarm = spec.devices.find((d) => d.room === 'hall') ?? spec.devices[0]
    if (hallAlarm)
      marks.push({
        id: 'alarms',
        beat: 'alarms',
        at: hallAlarm.at,
        text: 'R314 · SMOKE ALARMS NOT SHOWN',
        then: `R314 · ${spec.devices.length} ALARMS ADDED`,
        thenCheck: true,
        dir: 'e',
      })

    const checks = 5
    marks.push({ id: 'summary', beat: 'signoff', at: [fp[2], fp[1] - 84], text: `${checks} CHECKS · 1 FIX`, check: true, dir: 's' })
  }

  // ── Framing boxes. ───────────────────────────────────────────────────────────────────────
  const main = strokes.filter((s) => !s.group && s.beat !== 'select').flatMap((s) => s.pts)
  // Margin covers label text beyond its anchor (10 px is ~20″ at phone scale).
  const drawing = expand(boundsOfPoints([...main, ...labels.map((l) => l.at)]), 24)
  const fitBox = (dx: number, dy: number) => translate(fp, dx, dy)
  const fitOffsets = {
    wide: { A: [-FIT_OFFSET.wide, 0], B: [0, 0], C: [FIT_OFFSET.wide, 0] },
    narrow: { A: [0, FIT_OFFSET.narrow], B: [0, 0], C: [0, -FIT_OFFSET.narrow] },
  } satisfies PlanDrawing['fitOffsets']
  const chipRoom = 96
  const testfitsWide = bounds([fitBox(-FIT_OFFSET.wide, 0), fitBox(FIT_OFFSET.wide, 0)])
  const testfitsNarrow = bounds([fitBox(0, FIT_OFFSET.narrow), fitBox(0, -FIT_OFFSET.narrow)])

  return {
    elements,
    index,
    strokes,
    fills,
    labels,
    marks,
    box: {
      building: fp,
      drawing,
      testfits: {
        wide: [testfitsWide[0] - 24, testfitsWide[1] - 24, testfitsWide[2] + 24, testfitsWide[3] + chipRoom],
        narrow: [testfitsNarrow[0] - 24, testfitsNarrow[1] - 24, testfitsNarrow[2] + 24, testfitsNarrow[3] + chipRoom],
      },
    },
    fitOffsets,
    summary: houseSummary(spec),
  }
}

function rank(id: string) {
  const i = LABEL_FIRST.indexOf(id)
  return i < 0 ? LABEL_FIRST.length : i
}

const rectPoly = (r: Rect): Vec2[] => [
  [r[0], r[1]],
  [r[2], r[1]],
  [r[2], r[3]],
  [r[0], r[3]],
]

/** For an exterior wall: −1 if its t0 face is the building line (outside is toward −t), else +1. */
const outwardOf = (w: ResolvedWall, fp: Rect): 1 | -1 => (w.t0 === (w.axis === 'x' ? fp[1] : fp[0]) ? -1 : 1)

const sAt = (w: ResolvedWall, p: Vec2) => (w.axis === 'x' ? p[0] : p[1])
const tAt = (w: ResolvedWall, p: Vec2) => (w.axis === 'x' ? p[1] : p[0])

/** Re-orient a piece so it runs toward +s (pieces across the wall run toward +t). */
function orientAlong(w: ResolvedWall, q: OutlinePiece): OutlinePiece {
  const ds = sAt(w, q.b) - sAt(w, q.a)
  const dt = tAt(w, q.b) - tAt(w, q.a)
  return ds < 0 || (ds === 0 && dt < 0) ? { ...q, a: q.b, b: q.a } : q
}

/** Which face of the wall a piece lies on ('end' for pieces across the wall: ends and jambs). */
function faceOf(w: ResolvedWall, q: OutlinePiece): 'lo' | 'hi' | 'end' {
  if (sAt(w, q.a) === sAt(w, q.b)) return 'end'
  return tAt(w, q.a) === w.t0 ? 'lo' : 'hi'
}

/** A caliper along a wall's axis at offset t: a line from s0 to s1 with end bars. */
function caliper(w: ResolvedWall, s0: number, s1: number, t: number, bar: number): Polyline[] {
  return [
    [wallPoint(w, s0, t - bar), wallPoint(w, s0, t + bar)],
    [wallPoint(w, s0, t), wallPoint(w, s1, t)],
    [wallPoint(w, s1, t - bar), wallPoint(w, s1, t + bar)],
  ]
}

function caliperY(x: number, y0: number, y1: number, bar: number): Polyline[] {
  return [
    [[x - bar, y0], [x + bar, y0]],
    [[x, y0], [x, y1]],
    [[x - bar, y1], [x + bar, y1]],
  ]
}

