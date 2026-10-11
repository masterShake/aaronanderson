import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode, SymbolId } from '@/drawings/types'
import { heroGraph, HERO_PERSON, HERO_NOTES } from '@/drawings/views/hero'
import { center, nodeRect, routeGraph } from '@/drawings/lib/route'
import { isConnection } from '@/drawings/lib/counts'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { planFrame } from '@/drawings/lib/frame'
import { fitIso, isoToViewBox, planToWorld } from '@/drawings/lib/iso'
import { frameNodes, pencil, isoPrintDoc, modelBounds } from '@/drawings/render'
import { group } from '@/drawings/render/cad'
import { arrowhead, cloudPrim, placeSymbol } from '@/drawings/symbols'
import { buildHeroModel, HERO_FLOW } from '@/scenes/model/spec'
import { HERO } from '@/motion/timing/hero'
import { EASE } from '@/motion/timing/global'

/**
 * The hero's inline drawing, built on the server (D10: only the hero is inline). One doc per
 * family, every layer:
 *   panel   the blueprint-deep panel the scan reveals
 *   pencil  as found: 7 (6) boxes, 9 (8) hand-carry lines, 3 people, 3 redline clouds
 *   cad     rewired: planFrame(model) (the hand-off frame, drawn again by the 3D scene), and
 *           the rewired people as pencil cut-outs
 *   pkt     the plan mechanism: dash packets on the flowing routes, the valve branch, the
 *           DATA tank level
 *   iso     the iso print (svg-tier idle and the still tier; shipped once)
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

/** A symbol's parts as one clean path each: paper fill and pencil stroke on the same path. */
function personNodes(
  symbol: SymbolId,
  at: Pt,
  k: number,
  prefix: string,
  i: number,
  cls = 'p-035 i-pencil',
): SvgNode[] {
  return placeSymbol(symbol, at, { k, prefix }).map((p) =>
    path(
      round(p.prims.map(primD).join('')),
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
    key: 'estimate' | 'inbox' | 'field' | 'report'
    at: Pt
    side: 'n' | 's'
    scan: number
  }[]
  places: readonly { key: string; at: Pt; scan: number }[]
  /** Where the APPROVED chip and the owner's report card sit (plan, viewBox units). */
  valve: Pt
  report: { at: Pt; w: number }
  /** First arrival at the valve on the branch, ms after the mechanism starts, and its period. */
  approve: { first: number; every: number }
}

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
    pencilKids.push(
      group(
        n.id,
        [
          clean([box], n.id, i, 'f-paper'),
          ...rough([box], seed(n.id), n.id, i, 'draw p-035 i-pencil', 'cloud'),
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

  // ── cad: the hand-off frame, then the rewired cut-outs ───────────────────
  const frame = planFrame(model.spec)
  // exact (the 3D plan pose draws the same lines): separators only, no rounding
  const frameKids = frameNodes(frame).map((n) =>
    n.el === 'path' ? { ...n, d: n.d.replace(/\s*([MLHVAZ])\s*/g, '$1').replace(/ -/g, '-') } : n,
  )
  const cadKids: SvgNode[] = [group('frame', frameKids, 'k-frame')]
  for (const p of model.people)
    cadKids.push(
      group(
        `${p.id}.r`,
        personNodes(p.symbol as SymbolId, p.at, k, `${p.id}.r`, crossAt(p.at[0], W) + 120),
        'k-cut',
      ),
    )

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
    const [a, , , bb] = model.branch.pts as [Pt, Pt, Pt, Pt]
    const ia = r02.findIndex((_, j) => j > 0 && onSeg(a, r02[j - 1]!, r02[j]!))
    if (ia > 0) {
      const pts: Pt[] = [...r02.slice(0, ia), ...model.branch.pts, ...r02.slice(ia)].filter(
        (q, j, all) => j === 0 || q[0] !== all[j - 1]![0] || q[1] !== all[j - 1]![1],
      )
      void bb
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
  // the DATA tank's sight glass fills over the three loops
  const { c: tc, r: tr } = model.store
  pktKids.push(
    path(
      `M${tc[0] - tr * 0.45} ${tc[1] - tr * 0.6}h${tr * 0.9}v${tr * 1.2}h${-tr * 0.9}Z`,
      0,
      'tank.level',
      0,
      'f-orange tank-level',
    ),
  )

  // ── iso: the print ──────────────────────────────────────────────────────
  const iso = isoPrintDoc(model.spec)
  const fit = fitIso(vb, vb[2], vb[3], modelBounds(model.spec))
  const isoAt = (p: Pt, z: number): Pt => {
    const q = isoToViewBox(planToWorld(p, z), vb, fit)
    return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]
  }
  const isoKids = iso.groups[0]!.children.map((n) =>
    n.el === 'path' ? { ...n, d: round(n.d) } : n,
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
    // instruments: the AI reader's label under it, the valve's over it, the store's over it
    const r = prim.t === 'circle' ? prim.r : 12
    const pl: Pt =
      part.id === 'ai'
        ? [c[0], c[1] + r + 18]
        : part.id === 'valve' || part.id === 'store'
          ? [c[0], c[1] - r - 16]
          : c
    const iso0 = isoAt(c, top + 10)
    const iso: Pt =
      part.id === 'ai'
        ? [iso0[0] - 18, iso0[1] + 30]
        : part.id === 'valve'
          ? [iso0[0] + 18, iso0[1] - 30]
          : iso0
    const bi = boxes.findIndex((n) => n.id === part.id)
    const scan = crossAt(c[0], W)
    labels.push({
      key: part.anchor,
      at: pl,
      iso,
      scan,
      pop: bi >= 0 ? HERO.sketchStart + bi * HERO.toolGap + HERO.toolDur : scan,
    })
  }
  const places = people.flatMap((p) => {
    const key = p.id === 'p2' ? 'place.estimating' : p.id === 'p3' ? 'place.site' : null
    if (!key) return []
    const at: Pt = [p.rewired.at[0] + 16, p.rewired.at[1] - 12]
    return [{ key, at, scan: crossAt(p.rewired.at[0], W) + 120 }]
  })
  const notes = HERO_NOTES[family].flatMap((n) => {
    const node = g.nodes.find((x) => x.id === n.key)
    if (!node) return []
    const rc = nodeRect(node, 'wide')
    const c = center(rc)
    const at: Pt = n.side === 'n' ? [c[0], rc.y - 16] : [c[0], rc.y + rc.h + 16]
    return [{ key: n.key, at, side: n.side, scan: crossAt(c[0], W) }]
  })
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
    valve: model.valve,
    report: { at: [rr.x + rr.w / 2, rr.y + rr.h], w: rr.w },
    approve,
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const onSeg = (p: Pt, a: Pt, b: Pt) => Math.abs(dist(a, p) + dist(p, b) - dist(a, b)) < 1e-6
