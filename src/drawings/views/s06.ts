import type { LayoutId, ModelPart, ModelSpec, Pt, ViewBox } from '../types'
import { buildHeroModel } from '@/scenes/model/spec'

/**
 * S-06 Run & Improve (pages-drawings §6.6, stage-hero §4.4): the hero's rewired model, the
 * same machine the visitor saw built on Home, plus what a month of care adds. Wide uses the
 * hero wide viewBox (960 × 640); tall is 400 × 500 (the hero's tall plan, with room under it).
 *   flange   on the accounting → store inlet: where the FIXED stall happens
 *   gauge    the monitor, beside the store; it stays IN RANGE
 *   m1…m3    month instruments: a small orange enclosure on a stub off a running line
 * Isomorphic: no roughjs, no DOM, no strings beyond ids and label keys.
 */

export const S06_VIEWBOX: Readonly<Record<LayoutId, ViewBox>> = {
  wide: [0, 0, 960, 640],
  tall: [0, 0, 400, 500],
}

/**
 * Month instruments ride these routes: a stub off the route's longest run at fraction t along
 * it, to its left (+1, facing along the run) or right (−1). Wide m3 sits behind the CRM to
 * estimate line, in the print's open space between those two boxes, clear of the store, the
 * gauge and the owner's report.
 */
const MONTH_ON: Readonly<Record<LayoutId, readonly (readonly [string, number, number])[]>> = {
  wide: [
    ['r01', 0.5, 1],
    ['r05', 0.5, 1],
    ['r11', 0.5, -1],
  ],
  tall: [
    ['r01', 0.5, 1],
    ['r05', 0.5, 1],
    ['r09', 0.5, 1],
  ],
}
export const S06_MONTHS = ['m1', 'm2', 'm3'] as const
/** Label keys of the month instruments, in order. */
export const S06_ADDS = ['add.report', 'add.alert', 'add.automation'] as const
/** The hero's label keys S-06 names on the print and the model (its tools and the store). */
export const S06_NAMES = [
  'tool.field',
  'tool.inbox',
  'tool.crm',
  'tool.estimate',
  'tool.pm',
  'tool.accounting',
  'tool.report',
  'sym.store',
] as const

/** A part's plan centre and its top height: where its label anchor sits. */
export function partTop(part: ModelPart): { c: Pt; z: number } {
  const q = part.prims[0]!
  const c: Pt =
    q.t === 'rect'
      ? [q.at[0] + q.size[0] / 2, q.at[1] + q.size[1] / 2]
      : q.t === 'circle'
        ? q.c
        : [0, 0]
  return { c, z: (part.z ?? 0) + part.depth }
}

export interface S06Model {
  spec: ModelSpec
  flange: Pt
  gauge: Pt
  months: readonly { id: string; at: Pt; from: Pt }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** The longest straight run of a polyline: its ends and unit direction. */
function longest(pts: readonly Pt[]): { a: Pt; b: Pt; dir: Pt } {
  let a = pts[0]!
  let b = pts[1] ?? pts[0]!
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!
    const q = pts[i]!
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(b[0] - a[0], b[1] - a[1])) {
      a = p
      b = q
    }
  }
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return {
    a,
    b,
    dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l],
  }
}

export function buildS06Model(family: LayoutId): S06Model {
  const hero = buildHeroModel(family)
  const wide = family === 'wide'
  const parts: ModelPart[] = [...hero.spec.parts]
  // the flange: where accounting's line enters the store
  const inlet = hero.routes.r08
  const fl: Pt = inlet ? inlet[inlet.length - 1]! : hero.store.c
  parts.push({
    id: 'flange',
    kind: 'flange',
    prims: [{ t: 'circle', c: [r2(fl[0]), r2(fl[1])], r: wide ? 11 : 8 }],
    depth: wide ? 22 : 16,
    z: wide ? 3 : 3,
    material: 'aluminum',
    anchor: 'fixed',
  })
  // the monitor gauge on its post, beside the store
  const s = hero.store
  const gauge: Pt = wide
    ? [r2(s.c[0] + s.r + 44), r2(s.c[1] + 56)]
    : [r2(s.c[0] + s.r + 26), r2(s.c[1] - 40)]
  parts.push({
    id: 'gauge',
    kind: 'cyl',
    prims: [{ t: 'circle', c: gauge, r: wide ? 22 : 13 }],
    depth: wide ? 60 : 44,
    material: 'aluminum',
    anchor: 'gauge',
  })
  const months = MONTH_ON[family].flatMap(([rid, t, side], i) => {
    const pts = hero.routes[rid]
    if (!pts) return []
    const { a, b, dir } = longest(pts)
    const mid: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const n: Pt = [-dir[1] * side, dir[0] * side]
    const off = wide ? 46 : 32
    const at: Pt = [r2(mid[0] + n[0] * off), r2(mid[1] + n[1] * off)]
    const from: Pt = [r2(mid[0]), r2(mid[1])]
    const id = S06_MONTHS[i]!
    parts.push({
      id: `${id}.stub`,
      kind: 'pipe',
      prims: [{ t: 'poly', pts: [from, at] }],
      depth: wide ? 7 : 5,
      z: wide ? 10 : 8,
      material: 'aluminum',
      revs: [id],
    })
    // the bolted-on instrument: a small orange enclosure the stub plugs into
    const [mw, mh] = wide ? [30, 24] : [22, 18]
    parts.push({
      id,
      kind: 'box',
      prims: [{ t: 'rect', at: [r2(at[0] - mw / 2), r2(at[1] - mh / 2)], size: [mw, mh] }],
      depth: wide ? 22 : 16,
      material: 'orange',
      anchor: S06_ADDS[i],
      revs: [id],
    })
    return [{ id, at, from }]
  })
  return {
    spec: {
      id: `s06-${family}`,
      layout: family,
      viewBox: S06_VIEWBOX[family],
      start: 'plan',
      parts,
    },
    flange: fl,
    gauge,
    months,
  }
}
