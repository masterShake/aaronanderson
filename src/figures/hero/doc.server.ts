import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode, SymbolId } from '@/drawings/types'
import { heroGraph, HERO_PERSON, HERO_NOTES, HERO_SUBJECT } from '@/drawings/views/hero'
import { nodeRect, routeGraph } from '@/drawings/lib/route'
import { isConnection } from '@/drawings/lib/counts'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { planFrame } from '@/drawings/lib/frame'
import { fitIso, isoToViewBox, planToWorld } from '@/drawings/lib/iso'
import { frameNodes, pencil, isoPrintDoc, modelBounds } from '@/drawings/render'
import { group } from '@/drawings/render/cad'
import { arrowhead, cloudPrim, placeSymbol } from '@/drawings/symbols'
import { buildHeroModel, HERO_FLOW } from '@/scenes/model/spec'
import { modelDecor, plate, sightGlass, type DecorLine } from '@/scenes/model/decor'
import { HERO } from '@/motion/timing/hero'
import { EASE } from '@/motion/timing/global'

/**
 * The hero's inline drawing, built on the server (D10: only the hero is inline). One doc per
 * family, every layer:
 *   panel   the blueprint-deep panel the scan reveals
 *   pencil  as found: 7 (6) boxes with their glyphs, 9 (8) hand-carry lines, 3 people, 3
 *           redline clouds
 *   cad     rewired: planFrame(model) plus the decor (tool glyphs, plates, screws, the
 *           instruments' detail: the hand-off frame, drawn again by the 3D scene), the label
 *           leaders, and the rewired people as pencil cut-outs
 *   pkt     the plan mechanism: dash packets on the flowing routes, the valve branch, the
 *           sight-glass level
 *   iso     the iso print (svg-tier idle and the still tier; shipped once), decor on the tops
 * Coordinates of the rough strokes are rounded to whole units (the inline budget).
 *
 * `--i` on each path is its stagger index; for the people, clouds and cut-outs it is the ms
 * at which the scan bar crosses them (crossAt), which the hero CSS uses as the delay.
 */

type Fam = LayoutId

/** Whole-unit coordinates and no spare separators: the inline budget (15 KB gzip). */
export const round = (d: string) =>
  d
    .replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))))
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s*([MLCHVAZmlchvaz])\s*/g, '$1')
    .replace(/ -/g, '-')
    .trim()

/** A prim mirrored about the vertical line x = cx (a person facing the other way). */
function mirror(q: Prim, cx: number): Prim {
  const m = (p: Pt): Pt => [2 * cx - p[0], p[1]]
  switch (q.t) {
    case 'line':
      return { ...q, a: m(q.a), b: m(q.b) }
    case 'poly':
      return { ...q, pts: q.pts.map(m) }
    case 'rect':
      return { ...q, at: [2 * cx - q.at[0] - q.size[0], q.at[1]] }
    case 'circle':
      return { ...q, c: m(q.c) }
    case 'arc':
      return { ...q, c: m(q.c), from: 180 - q.to, to: 180 - q.from }
    case 'cubic':
      return { ...q, a: m(q.a), c1: m(q.c1), c2: m(q.c2), b: m(q.b) }
    default:
      return q
  }
}

/** A symbol's parts as one clean path each: paper fill and pencil stroke on the same path. */
function personNodes(
  symbol: SymbolId,
  at: Pt,
  k: number,
  prefix: string,
  i: number,
  cls = 'p-035 i-pencil',
  flip = false,
): SvgNode[] {
  return placeSymbol(symbol, at, { k, prefix }).map((p) =>
    path(
      round((flip ? p.prims.map((q) => mirror(q, at[0])) : p.prims).map(primD).join('')),
      0,
      p.id,
      i,
      `${p.fill && p.fill !== 'none' ? 'f-paper ' : ''}${cls}`,
    ),
  )
}

const path = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len),
  part,
  i,
  cls,
})

function rough(
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: 'box' | 'line' | 'cloud' | 'person',
): SvgNode[] {
  return pencil(prims, { seed: seedFrom(seed), preset }).map((s) =>
    path(round(s.d), s.len, part, i, cls),
  )
}

const clean = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode =>
  path(
    prims.map(primD).join(''),
    prims.reduce((s, p) => s + primLength(p), 0),
    part,
    i,
    cls,
  )

/** Decor lines as one path: exact (the 3D decal paints the same points). */
const decorD = (ls: readonly DecorLine[], at: (p: Pt) => Pt = (p) => p) =>
  ls
    .map(
      (l) =>
        `M${l.pts
          .map(at)
          .map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`)
          .join('L')}${l.closed ? 'Z' : ''}`,
    )
    .join('')
    .replace(/ -/g, '-')

/** cubic-bezier(x1,y1,x2,y2) solved for t at progress y (bisection), as CSS eases it. */
function invEase(css: string, y: number): number {
  const [x1, y1, x2, y2] = (/\(([^)]+)\)/.exec(css)?.[1] ?? '0,0,1,1').split(',').map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const b = (a: number, c: number, t: number) =>
    3 * a * t * (1 - t) * (1 - t) + 3 * c * t * t * (1 - t) + t * t * t
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const s = (lo + hi) / 2
    // progress at curve parameter s, then time at s
    if (b(y1, y2, s) < y) lo = s
    else hi = s
  }
  return b(x1, x2, (lo + hi) / 2)
}

/** The ms at which the scan bar (0 → 110% over HERO.scanDur, machine ease) crosses x. */
export function crossAt(x: number, width: number): number {
  const f = Math.min(1, Math.max(0, x / width / 1.1))
  return Math.round(HERO.scanStart + HERO.scanDur * invEase(EASE.machine, f))
}

export interface HeroLabel {
  key: string
  /** Plan anchor (centre), viewBox units. */
  at: Pt
  /** Iso print anchor, viewBox units. */
  iso?: Pt
  /** A tool's name plate width (viewBox units): the label never leaves it. */
  w?: number
  /** ms at which the scan crosses it. */
  scan: number
  /** ms at which it appears (tools with their box; instruments as the scan draws them). */
  pop: number
}

export interface HeroBuild {
  doc: SvgDoc
  /** The still tier's inset: the as-found drawing, clean, for a small inset. */
  inset: SvgDoc
  labels: readonly HeroLabel[]
  notes: readonly {
    key: 'estimate' | 'inbox' | 'report'
    at: Pt
    scan: number
  }[]
  places: readonly { key: string; at: Pt; scan: number }[]
  /** Where the APPROVED chip sits (plan, viewBox units), beside the person at the valve. */
  approved: Pt
  /** The owner's report box: bottom centre and width (its card slides out under it). */
  report: { at: Pt; w: number }
  /** First arrival at the valve on the branch, ms after the mechanism starts, and its period. */
  approve: { first: number; every: number }
}

/**
 * Where each instrument's and place's label sits on the plan (centre, viewBox units), in clear
 * space beside its object: the AI reader's under it, the sign-off beside the person at the
 * valve, the store's up and to the side with a leader. Checked frame by frame at 1280, 1440,
 * 390 and 360 px.
 */
const PLAN_LABELS: Readonly<Record<Fam, Readonly<Record<string, Pt>>>> = {
  wide: {
    'sym.ai': [268, 606],
    'sym.valve': [424, 452],
    'sym.store': [590, 282],
    'place.estimating': [536, 160],
    'place.site': [222, 404],
  },
  tall: {
    'sym.ai': [175, 356],
    'sym.valve': [306, 232],
    'sym.store': [228, 456],
    'place.estimating': [96, 118],
    'place.site': [56, 252],
  },
}

/** APPROVED, under the sign-off label. */
const APPROVED: Readonly<Record<Fam, Pt>> = { wide: [424, 478], tall: [306, 256] }

/** Label leaders (thin, cyan-dim) from the label to its object, plan units. */
const LEADERS: Readonly<Record<Fam, readonly (readonly Pt[])[]>> = {
  wide: [
    [
      [268, 590],
      [268, 561],
    ],
    [
      [548, 286],
      [511, 291],
    ],
  ],
  tall: [
    [
      [175, 345],
      [181, 324],
    ],
    [
      [258, 455],
      [281, 451],
    ],
  ],
}

/**
 * The iso print is small, the tall one especially: these move instrument labels clear of the
 * model (viewBox units), checked at 360 and 390 px.
 */
const TALL_ISO_NUDGE: Readonly<Record<string, Pt>> = {
  ai: [-44, 0],
  store: [0, 73],
  valve: [7, 21],
  pm: [8, -12],
}

/**
 * The tall iso print fits the box's width and leaves its lower quarter empty: it moves down by
 * this much (viewBox units), so it sits at the optical centre, under the AS FOUND inset.
 */
const ISO_SHIFT: Readonly<Record<Fam, number>> = { wide: 0, tall: 50 }

const cache = new Map<Fam, HeroBuild>()

export function heroBuild(family: Fam): HeroBuild {
  let b = cache.get(family)
  if (!b) cache.set(family, (b = build(family)))
  return b
}

function build(family: Fam): HeroBuild {
  const g = heroGraph(family)
  const vb = g.viewBox.wide
  const W = vb[2]
  const seed = (id: string) => `hero:${g.seed}:${family}:${id}`
  const model = buildHeroModel(family)
  const deco = modelDecor(model.spec)
  const k = HERO_PERSON[family] / 64

  // ── panel: the deep panel, revealed by the scan ─────────────────────────
  const panel: SvgNode[] = [path(`M0 0H${W}V${vb[3]}H0Z`, 0, 'panel', 0, 'f-deep')]

  // ── pencil: as found ────────────────────────────────────────────────────
  const found = routeGraph(g, 'asFound', 'wide', { bend: 0 })
  const boxes = g.nodes.filter((n) => n.kind === 'tool')
  const pencilKids: SvgNode[] = []
  boxes.forEach((n, i) => {
    const rc = nodeRect(n, 'wide')
    const box: Prim = { t: 'rect', at: [rc.x, rc.y], size: [rc.w, rc.h] }
    // the glyph and the plate divider in pencil (no screws: a sketch has none)
    const glyph = (deco.tools[n.id] ?? []).slice(0, -4)
    pencilKids.push(
      group(
        n.id,
        [
          clean([box], n.id, i, 'f-paper'),
          ...rough([box], seed(n.id), n.id, i, 'draw p-035 i-pencil', 'cloud'),
          path(decorD(glyph), 0, `${n.id}.glyph`, i, 'p-025 i-pencil glyph'),
        ],
        'k-box',
      ),
    )
  })
  let li = 0
  for (const r of found.values()) {
    if (!isConnection(r.route)) continue
    const end = r.pts[r.pts.length - 1]!
    const before = r.pts[r.pts.length - 2]!
    pencilKids.push(
      group(
        r.id,
        [
          ...rough(
            [{ t: 'poly', pts: r.pts }],
            seed(r.id),
            r.id,
            li,
            'draw p-035 i-pencil',
            'cloud',
          ),
          clean([arrowhead(before, end, 10)], r.id, li, 'draw p-035 i-pencil'),
        ],
        'k-line',
      ),
    )
    li++
  }
  const people = (g.people ?? []).flatMap((p) => {
    const f = p.poses.asFound
    const r = p.poses.rewired
    return f && r ? [{ id: p.id, found: f, rewired: r }] : []
  })
  for (const p of people)
    pencilKids.push(
      group(
        p.id,
        personNodes(p.found.symbol as SymbolId, p.found.at, k, p.id, crossAt(p.found.at[0], W)),
        'k-person',
      ),
    )
  // redline clouds round the people
  people.forEach((p, c) => {
    const [x, y] = p.found.at
    const h = HERO_PERSON[family]
    const rect = { x: x - h * 0.42, y: y - h - 8, w: h * 0.84, h: h + 14 }
    const cp = cloudPrim(rect, { seed: seedFrom(seed(`cloud${c}`)) })
    pencilKids.push(
      group(
        `cloud.${p.id}`,
        rough([cp], seed(`cloud${c}`), `cloud.${p.id}`, c, 'draw p-050 i-redline', 'cloud'),
        'k-cloud',
      ),
    )
  })

  // ── cad: the hand-off frame and its decor, the leaders, then the rewired cut-outs ──
  const frame = planFrame(model.spec)
  // exact (the 3D plan pose draws the same lines): separators only, no rounding
  const frameKids = frameNodes(frame).map((n) =>
    n.el === 'path' ? { ...n, d: n.d.replace(/\s*([MLHVAZ])\s*/g, '$1').replace(/ -/g, '-') } : n,
  )
  const decoKids: SvgNode[] = [
    ...Object.entries(deco.tools).map(([id, ls]) =>
      path(decorD(ls), 0, `${id}.decor`, 0, 'p-035 i-cyan'),
    ),
    path(decorD(deco.instruments), 0, 'instruments', 0, 'p-035 i-cyan'),
  ]
  const lead: SvgNode[] = [
    path(
      decorD(LEADERS[family].map((pts) => ({ pts, closed: false }))),
      0,
      'leaders',
      0,
      'p-018 i-cyan-dim',
    ),
  ]
  const cadKids: SvgNode[] = [
    group('frame', [...frameKids, ...decoKids], 'k-frame'),
    group('leaders', lead, 'k-lead'),
  ]
  for (const p of model.people) {
    const subject = p.id === 'p1'
    cadKids.push(
      group(
        `${p.id}.r`,
        personNodes(
          p.symbol as SymbolId,
          p.at,
          subject ? k * HERO_SUBJECT : k,
          `${p.id}.r`,
          crossAt(p.at[0], W) + 120,
          'p-035 i-pencil',
          subject,
        ),
        'k-cut',
      ),
    )
  }

  // ── pkt: the plan mechanism ─────────────────────────────────────────────
  const pktKids: SvgNode[] = []
  HERO_FLOW.forEach((id, i) => {
    const pts = model.routes[id]
    if (!pts) return
    const prim: Prim = { t: 'poly', pts, r: family === 'wide' ? 12 : 10 }
    pktKids.push(clean([prim], `pkt.${id}`, i, 'pk'))
  })
  // every fourth ticket takes the branch through the valve
  const r02 = model.routes.r02
  let approve = { first: 0, every: HERO.loop / 2 }
  if (r02 && model.branch.pts.length === 4) {
    const [a] = model.branch.pts as [Pt, Pt, Pt, Pt]
    const ia = r02.findIndex((_, j) => j > 0 && onSeg(a, r02[j - 1]!, r02[j]!))
    if (ia > 0) {
      const pts: Pt[] = [...r02.slice(0, ia), ...model.branch.pts, ...r02.slice(ia)].filter(
        (q, j, all) => j === 0 || q[0] !== all[j - 1]![0] || q[1] !== all[j - 1]![1],
      )
      const prim: Prim = { t: 'poly', pts, r: 6 }
      pktKids.push(clean([prim], 'pkt.held', HERO_FLOW.length, 'pk pk-held'))
      // distance to the valve along the branch path
      const toA = primLength({ t: 'poly', pts: [...r02.slice(0, ia), a] })
      const [, a2, b2] = model.branch.pts as [Pt, Pt, Pt, Pt]
      const toValve = toA + dist(a, a2) + dist(a2, b2) / 2
      const every = 4 * HERO.packetGap
      approve = { first: Math.round((toValve / HERO.packetSpeed) * 1000), every }
    }
  }
  // the DATA tank's level rises in its sight glass over the three loops
  const { c: tc, r: tr } = model.store
  const [gx, gy, gw, gh] = sightGlass(tc, tr, family === 'wide')
  pktKids.push(
    path(
      `M${gx + 1.5} ${gy + 1.5}h${gw - 3}v${gh - 3}h${3 - gw}Z`,
      0,
      'tank.level',
      0,
      'f-cyan tank-level',
    ),
  )

  // ── iso: the print, with each tool's decor on its top face ───────────────
  const iso = isoPrintDoc(model.spec)
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(model.spec))
  const isoAt = (p: Pt, z: number): Pt => {
    const q = isoToViewBox(planToWorld(p, z), vb, fit)
    return [Math.round(q[0] * 10) / 10, Math.round((q[1] + ISO_SHIFT[family]) * 10) / 10]
  }
  const faces = iso.groups[0]!.children.map((n) =>
    n.el === 'path'
      ? {
          ...n,
          d: round(
            ISO_SHIFT[family]
              ? n.d.replace(
                  /(-?[\d.]+) (-?[\d.]+)/g,
                  (_, x: string, y: string) => `${x} ${Number(y) + ISO_SHIFT[family]}`,
                )
              : n.d,
          ),
        }
      : n,
  )
  // each part's detail goes straight after the last of its faces (faces are sorted back to front)
  const extras = new Map<string, SvgNode[]>()
  for (const part of model.spec.parts) {
    const n = { i: 0 }
    const add = (...xs: SvgNode[]) => extras.set(part.id, xs)
    if (deco.tools[part.id])
      add(
        path(
          decorD(deco.tools[part.id]!, (q) => isoAt(q, part.depth)),
          0,
          `${part.id}.decor`,
          n.i,
          `p-025 ${part.material === 'orange' ? 'i-asphalt' : 'i-graphite'}`,
        ),
      )
    else if (part.kind === 'tank') {
      // the sight glass on the side facing the viewer, full: the batch is in
      const [cx, cy] = model.store.c
      const rr = model.store.r
      const u = Math.SQRT1_2
      const side = (s: number): Pt => [cx + rr * u + s * u, cy + rr * u - s * u]
      const w = family === 'wide' ? 7 : 5
      const quad = (a: number, b: number, s: number) => [
        {
          pts: [isoAt(side(-s), a), isoAt(side(s), a), isoAt(side(s), b), isoAt(side(-s), b)],
          closed: true,
        },
      ]
      const d = part.depth
      add(
        path(decorD(quad(d * 0.12, d * 0.88, w)), 0, 'tank.glass', n.i, 'f-deep p-035 i-asphalt'),
        path(decorD(quad(d * 0.16, d * 0.7, w - 2.5)), 0, 'tank.level', n.i, 'f-cyan'),
      )
    } else if (part.kind === 'valve') {
      // bonnet stem and handwheel, as the 3D model has them
      const c = model.valve
      const t = part.depth
      const h = t * 1.3
      const R = t * 0.8
      const wheel = Array.from({ length: 16 }, (_, j) => {
        const a = (j * Math.PI) / 8
        return isoAt([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)], t + h)
      })
      add(
        path(
          decorD([
            { pts: [isoAt(c, t), isoAt(c, t + h)], closed: false },
            { pts: wheel, closed: true },
          ]),
          0,
          'valve.wheel',
          n.i,
          'p-035 i-asphalt',
        ),
      )
    }
  }
  const last = new Map<string, number>()
  faces.forEach((n, j) => n.el === 'path' && last.set(n.part, j))
  const isoKids: SvgNode[] = faces.flatMap((n, j) =>
    n.el === 'path' && last.get(n.part) === j ? [n, ...(extras.get(n.part) ?? [])] : [n],
  )

  // ── labels ──────────────────────────────────────────────────────────────
  const labels: HeroLabel[] = []
  for (const part of model.spec.parts) {
    if (!part.anchor) continue
    const prim = part.prims[0]!
    const c: Pt =
      prim.t === 'rect'
        ? [prim.at[0] + prim.size[0] / 2, prim.at[1] + prim.size[1] / 2]
        : prim.t === 'circle'
          ? prim.c
          : model.valve
    const top = (part.z ?? 0) + part.depth
    const pl =
      prim.t === 'rect' ? plate([prim.at[0], prim.at[1], prim.size[0], prim.size[1]]) : null
    const at: Pt = pl ? pl.c : (PLAN_LABELS[family][part.anchor] ?? c)
    const iso0 = isoAt(pl ? pl.c : c, top + (pl ? 0 : 10))
    const iso1: Pt =
      part.id === 'ai'
        ? [iso0[0] - 18, iso0[1] + 30]
        : part.id === 'valve'
          ? [iso0[0] + 18, iso0[1] - 30]
          : iso0
    const nudge = family === 'tall' ? TALL_ISO_NUDGE[part.id] : undefined
    const isoP: Pt = nudge ? [iso1[0] + nudge[0], iso1[1] + nudge[1]] : iso1
    const bi = boxes.findIndex((n) => n.id === part.id)
    const scan = crossAt(at[0], W)
    labels.push({
      key: part.anchor,
      at,
      iso: isoP,
      ...(pl ? { w: pl.w } : {}),
      scan,
      pop: bi >= 0 ? HERO.sketchStart + bi * HERO.toolGap + HERO.toolDur : scan,
    })
  }
  const places = people.flatMap((p) => {
    const key = p.id === 'p2' ? 'place.estimating' : p.id === 'p3' ? 'place.site' : null
    if (!key) return []
    const at = PLAN_LABELS[family][key]!
    return [{ key, at, scan: crossAt(p.rewired.at[0], W) + 120 }]
  })
  const notes = HERO_NOTES[family].map((n) => ({ key: n.key, at: n.at, scan: crossAt(n.at[0], W) }))
  const reportNode = g.nodes.find((n) => n.id === 'report')!
  const rr = nodeRect(reportNode, 'wide')

  // ── inset: as found, clean and small ────────────────────────────────────
  const insetKids: SvgNode[] = [
    ...boxes.map((n, i) => {
      const rc = nodeRect(n, 'wide')
      return clean(
        [{ t: 'rect', at: [rc.x, rc.y], size: [rc.w, rc.h] }],
        n.id,
        i,
        'f-paper p-050 i-pencil',
      )
    }),
    ...[...found.values()]
      .filter((r) => isConnection(r.route))
      .map((r, i) => clean([{ t: 'poly', pts: r.pts }], r.id, i, 'p-050 i-pencil')),
    // the people as redline rings (a cloud at this size is a ring)
    ...people.map((p, i) => {
      const [x, y] = p.found.at
      const h = HERO_PERSON[family]
      return clean([{ t: 'circle', c: [x, y - h / 2], r: h * 0.6 }], p.id, i, 'p-070 i-redline')
    }),
  ]

  return {
    doc: {
      viewBox: vb,
      groups: [
        { layer: 'panel', children: panel },
        { layer: 'pencil', rev: 'asFound', children: pencilKids },
        { layer: 'cad', rev: 'rewired', children: cadKids },
        { layer: 'pkt', children: pktKids },
        { layer: 'iso', children: isoKids },
      ],
    },
    inset: { viewBox: vb, groups: [{ layer: 'pencil', children: insetKids }] },
    labels,
    notes,
    places,
    approved: APPROVED[family],
    report: { at: [rr.x + rr.w / 2, rr.y + rr.h], w: rr.w },
    approve,
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const onSeg = (p: Pt, a: Pt, b: Pt) => Math.abs(dist(a, p) + dist(p, b) - dist(a, b)) < 1e-6
