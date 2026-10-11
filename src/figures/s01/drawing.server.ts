import 'server-only'
import type { DrawingBuilder, LayoutId, Part, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import {
  STILL_K,
  docsBuilder,
  graphDoc,
  mergeDocs,
  partsNodes,
  pencil,
  cad,
} from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { toStillSvg } from '@/drawings/lib/svg-string'
import { seedFrom } from '@/drawings/lib/geometry'
import { center } from '@/drawings/lib/route'
import { cloudPrim, placeSymbol } from '@/drawings/symbols'
import {
  S01_ART,
  S01_CLOUDED,
  S01_FAN,
  S01_REV,
  S01_STATION,
  S01_TOOLS,
  crossP,
  rectOf,
  s01Graph,
} from '@/drawings/views/s01'

/**
 * The S-01 drawing files (owner: services), served by /drawings/[file]:
 *   s01.{family}.json             every layer, both states merged
 *   s01.{family}.{rev}.still.svg  asFound (pencil) and surveyed (the final frame)
 *
 * asFound: the pencil sketch (boxes rotated ±3°, hand-carry lines), the
 * surveyor and total station, and on the packet layer the fan, crosshairs and
 * clouds. surveyed: the deep panel and the clean map of the same topology
 * (by-hand routes dashed cyan-dim, syncs solid cyan). Classes tag each beat
 * (sk sketch, sv survey, fan, xh crosshair, cl cloud, pn panel, rd redraw);
 * src/figures/s01/s01.module.css runs them on --p.
 */

type Fam = LayoutId
const r2 = (n: number) => Math.round(n * 100) / 100

function retag(n: SvgNode, f: (cls: string, part: string) => string, i?: number): SvgNode {
  if (n.el === 'path') return { ...n, cls: f(n.cls, n.part), ...(i !== undefined ? { i } : {}) }
  return { ...n, children: n.children.map((c) => retag(c, f, i)) }
}

const path = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => {
  const c = cad(prims)
  return { el: 'path', d: c.d, len: c.len, part, i, cls }
}

const roughPaths = (
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: 'line' | 'cloud' | 'box' = 'line',
): SvgNode[] =>
  pencil(prims, { seed: seedFrom(seed), preset }).map((s) => ({
    el: 'path' as const,
    d: s.d,
    len: s.len,
    part,
    i,
    cls,
  }))

/** The pencil sketch: graph boxes (rotated ±3°) and hand-carry lines. */
function sketch(family: Fam): SvgNode[] {
  const doc = graphDoc(s01Graph, S01_REV, family, { medium: 'pencil' })
  const tools = new Set<string>(S01_TOOLS)
  let k = 0
  return doc.groups.flatMap((g) =>
    g.children.map((n) => {
      const tagged = retag(n, (cls) => `${cls} sk`)
      if (n.el !== 'g' || !n.part || !tools.has(n.part)) return tagged
      const c = center(rectOf(n.part as (typeof S01_TOOLS)[number], family))
      const a = k++ % 2 ? 3 : -3
      return { ...tagged, transform: `rotate(${a} ${r2(c[0])} ${r2(c[1])})` }
    }),
  )
}

/** The total station on its tripod, and the surveyor bent over it. */
function survey(family: Fam): SvgNode[] {
  const s = S01_STATION[family]
  const [fx, fy] = s.feet
  const [hx, hy] = s.head
  const spread = family === 'wide' ? 16 : 11
  const legs: Prim[] = [
    { t: 'line', a: [hx, hy + 6], b: [fx - spread, fy] },
    { t: 'line', a: [hx, hy + 6], b: [fx, fy] },
    { t: 'line', a: [hx, hy + 6], b: [fx + spread, fy] },
  ]
  const head: Prim[] = [
    { t: 'rect', at: [hx - 8, hy - 7], size: [16, 13] },
    { t: 'circle', c: [hx + 4, hy - 1], r: 3 },
  ]
  const parts: Part[] = placeSymbol('fig.survey', s.person, {
    k: family === 'wide' ? 0.9 : 0.7,
    prefix: 'surveyor',
  })
  const seed = `s01:${family}:station`
  const cls = `${strokeCls({ pen: '035', ink: 'pencil' })} sv`
  return [
    group('station', [
      path(head, 'station.head', 0, `${strokeCls({ fill: 'paper', draw: false })} sv`),
      ...roughPaths(legs, `${seed}:legs`, 'station.legs', 0, cls),
      ...roughPaths(head, `${seed}:head`, 'station.head', 0, cls),
    ]),
    group(
      'surveyor',
      partsNodes(parts, { variant: 'pencil', seed: `${seed}:person`, i: 0, ink: 'pencil' }).map(
        (n) => retag(n, (c) => `${c} sv`),
      ),
      'person',
    ),
  ]
}

/** The 12° fan, drawn pointing east from the instrument; CSS rotates it up through the sweep. */
function fan(family: Fam): SvgNode {
  const L = S01_FAN.len[family]
  const a = (S01_FAN.halfDeg * Math.PI) / 180
  const p1: Pt = [r2(L * Math.cos(a)), r2(-L * Math.sin(a))]
  const p2: Pt = [r2(L * Math.cos(a)), r2(L * Math.sin(a))]
  const wedge: Prim = { t: 'poly', pts: [[0, 0], p1, p2], closed: true }
  const edges: Prim[] = [
    { t: 'line', a: [0, 0], b: p1 },
    { t: 'line', a: [0, 0], b: p2 },
  ]
  const [hx, hy] = S01_STATION[family].head
  return {
    el: 'g',
    part: 'fan.at',
    transform: `translate(${hx} ${hy})`,
    children: [
      group(
        'fan',
        [
          path([wedge], 'fan.fill', 0, `${strokeCls({ fill: 'cad', draw: false })} fan`),
          path(edges, 'fan.edge', 0, `${strokeCls({ pen: '035', ink: 'cad', draw: false })} fan`),
        ],
        's01-fan',
      ),
    ],
  }
}

/** A crosshair (r = 6) in each box, drawn when the fan crosses it: --i carries that progress × 1000. */
function crosshairs(family: Fam): SvgNode[] {
  return S01_TOOLS.map((tool) => {
    const r = rectOf(tool, family)
    const c: Pt = [r.x + r.w - (family === 'wide' ? 22 : 16), r.y + (family === 'wide' ? 22 : 16)]
    const prims: Prim[] = [
      { t: 'circle', c, r: 6 },
      { t: 'line', a: [c[0] - 10, c[1]], b: [c[0] + 10, c[1]] },
      { t: 'line', a: [c[0], c[1] - 10], b: [c[0], c[1] + 10] },
    ]
    const i = Math.round(crossP(tool, family) * 1000)
    return group(`xh.${tool}`, [
      path(prims, `xh.${tool}`, i, `${strokeCls({ pen: '035', ink: 'cad' })} xh`),
    ])
  })
}

/** Revision clouds Δ1–Δ3 around the three worst bottlenecks (--i is the cloud's order). */
function clouds(family: Fam): SvgNode[] {
  return S01_CLOUDED.map((tool, i) => {
    const r = rectOf(tool, family)
    const pad = family === 'wide' ? 12 : 8
    const cp = cloudPrim(
      { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad },
      { seed: seedFrom(`s01:${family}:cloud:${tool}`) },
    )
    return group(
      `cloud.${i + 1}`,
      roughPaths(
        [cp],
        `s01:${family}:cloud:${tool}:rough`,
        `cloud.${i + 1}`,
        i,
        `${strokeCls({ pen: '050', ink: 'redline' })} cl`,
        'cloud',
      ),
      's01-cloud',
    )
  })
}

/** The clean map on the deep panel: same topology, by-hand routes dashed, syncs solid. */
function redraw(family: Fam): SvgNode[] {
  const doc = graphDoc(s01Graph, S01_REV, family, { medium: 'cad', chevrons: 0 })
  const byHand = new Set(
    s01Graph.routes.filter((r) => r.mode && r.mode !== 'sync').map((r) => r.id),
  )
  return doc.groups.flatMap((g) =>
    g.children.map((n) =>
      retag(n, (cls, part) => {
        let c = cls.replace('f-panel', 'f-deep')
        if (byHand.has(part)) c = c.replace('p-070 i-cyan', 'p-050 i-cyan-dim d-hidden')
        return `${c} rd`
      }),
    ),
  )
}

function make(family: Fam, rev: string): SvgDoc {
  const vb = s01Graph.viewBox[family]
  if (rev === 'asFound')
    return {
      viewBox: vb,
      groups: [
        { layer: 'pencil', rev, children: [...sketch(family), ...survey(family)] },
        { layer: 'pkt', rev, children: [fan(family), ...crosshairs(family), ...clouds(family)] },
      ],
    }
  const art = S01_ART[family]
  return {
    viewBox: vb,
    groups: [
      {
        layer: 'panel',
        rev,
        children: [
          path(
            [{ t: 'rect', at: [art.x, art.y], size: [art.w, art.h] }],
            'panel',
            0,
            `${strokeCls({ fill: 'deep', draw: false })} pn`,
          ),
        ],
      },
      { layer: 'cad', rev, children: redraw(family) },
    ],
  }
}

export const S01_STATES = [
  { rev: 'asFound', ground: 'paper' },
  { rev: 'surveyed', ground: 'paper' },
] as const

const docs = docsBuilder(make, S01_STATES)

/** The final frame (p = 1): the clean map on the deep panel over the pencil ghost. */
function finalStill(family: Fam): string {
  const found = docs.doc(family, 'asFound')
  const ghost: SvgDoc = { ...found, groups: found.groups.filter((g) => g.layer === 'pencil') }
  return toStillSvg(mergeDocs([ghost, docs.doc(family, 'surveyed')]), {
    k: STILL_K[family],
    ground: 'paper',
    remap: { panel: 'paper' },
    opacity: { pencil: 0.22 },
  })
}

export const drawing: DrawingBuilder = {
  files: docs.files,
  build(file) {
    const [family, rev] = file.split('.') as [Fam, string]
    if (rev === 'surveyed' && file.endsWith('.still.svg')) return finalStill(family)
    return docs.build(file)
  },
}
