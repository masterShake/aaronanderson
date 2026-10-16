import 'server-only'
import type { DrawingBuilder, LayoutId, Part, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { STILL_K, docsBuilder, graphDoc, partsNodes, pencil, cad } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { toStillSvg } from '@/drawings/lib/svg-string'
import { seedFrom } from '@/drawings/lib/geometry'
import { cloudPrim, placeSymbol } from '@/drawings/symbols'
import {
  S01_ART,
  S01_CLOUDED,
  S01_FAN,
  S01_REV,
  S01_ROUTES,
  S01_STATION,
  S01_TOOLS,
  crossAt,
  crossP,
  rectOf,
  s01Glyph,
  s01Graph,
} from '@/drawings/views/s01'

/**
 * The S-01 drawing files (owner: svc-a), served by /drawings/[file]:
 *   s01.{family}.json             every layer, both states merged
 *   s01.{family}.{rev}.still.svg  asFound (pencil) and surveyed (the final frame)
 *
 * asFound: on l-pencil the pencil sketch (boxes with their glyphs, hand-off lines with
 * paper), which the scan erases; on l-pkt the surveyor and the total station (who stay),
 * the fan, crosshairs and clouds. surveyed: the deep panel and the clean map of the same topology (by-hand routes
 * dashed cyan-dim, syncs solid, glyphs in cyan). Classes tag each beat (sk sketch, gl glyph,
 * sv survey, fan, xh crosshair, cl cloud, pn panel, rd redraw); s01.module.css runs them
 * on --p. The final frame has no pencil under the map: the sketch is gone, the surveyor
 * stays (on paper, under the panel).
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

const glyphPrims = (tool: (typeof S01_TOOLS)[number], family: Fam): Prim[] =>
  s01Glyph(tool, family).map((pts) => ({ t: 'poly' as const, pts }))

/** The pencil sketch: graph boxes (rotated ±1.5°), hand-off lines, and each box's glyph. */
function sketch(family: Fam): SvgNode[] {
  const doc = graphDoc(s01Graph, S01_REV, family, { medium: 'pencil' })
  const tools = new Set<string>(S01_TOOLS)
  let k = 0
  // stagger: the eight boxes first (structure), then the nine hand-off lines (connections)
  const order = (part: string | undefined) => {
    const t = S01_TOOLS.indexOf(part as (typeof S01_TOOLS)[number])
    if (t >= 0) return t
    const r = S01_ROUTES.indexOf(part as (typeof S01_ROUTES)[number])
    return r >= 0 ? S01_TOOLS.length + r : undefined
  }
  return doc.groups.flatMap((g) =>
    g.children.map((n) => {
      const tagged = retag(n, (cls) => `${cls} sk`, order(n.el === 'g' ? n.part : undefined))
      if (n.el !== 'g' || !n.part || !tools.has(n.part)) return tagged
      const tool = n.part as (typeof S01_TOOLS)[number]
      const r = rectOf(tool, family)
      const a = k++ % 2 ? 1.5 : -1.5
      const glyph = roughPaths(
        glyphPrims(tool, family),
        `s01:${family}:glyph:${tool}`,
        `${tool}.glyph`,
        S01_TOOLS.indexOf(tool),
        `${strokeCls({ pen: '025', ink: 'pencil' })} gl`,
      )
      return {
        ...tagged,
        children: [...(tagged.el === 'g' ? tagged.children : []), ...glyph],
        transform: `rotate(${a} ${r2(r.x + r.w / 2)} ${r2(r.y + r.h / 2)})`,
      }
    }),
  )
}

/** The total station on its tripod, and the surveyor at it. */
function survey(family: Fam): SvgNode[] {
  const s = S01_STATION[family]
  const [fx, fy] = s.feet
  const [hx, hy] = s.head
  const u = family === 'wide' ? 1.3 : 0.55
  const spread = 18 * u
  const legs: Prim[] = [
    { t: 'line', a: [hx, hy + 8 * u], b: [fx - spread, fy] },
    { t: 'line', a: [hx, hy + 8 * u], b: [fx, fy] },
    { t: 'line', a: [hx, hy + 8 * u], b: [fx + spread, fy] },
  ]
  const head: Prim[] = [
    { t: 'rect', at: [hx - 9 * u, hy - 8 * u], size: [18 * u, 14 * u] },
    { t: 'circle', c: [hx + 4 * u, hy - 1 * u], r: 3.5 * u },
    { t: 'line', a: [hx - 12 * u, hy + 8 * u], b: [hx + 12 * u, hy + 8 * u] },
  ]
  const parts: Part[] = placeSymbol('fig.survey', s.person, { k: s.k, prefix: 'surveyor' })
  const seed = `s01:${family}:station`
  const cls = `${strokeCls({ pen: '035', ink: 'pencil' })} sv`
  return [
    group('station', [
      path(head.slice(0, 1), 'station.head', 0, `${strokeCls({ fill: 'paper', draw: false })} sv`),
      ...roughPaths(legs, `${seed}:legs`, 'station.legs', 0, cls),
      ...roughPaths(head, `${seed}:head`, 'station.head', 0, cls),
    ]),
    {
      ...group(
        'surveyor',
        partsNodes(parts, { variant: 'pencil', seed: `${seed}:person`, i: 0, ink: 'pencil' }).map(
          (n) => retag(n, (c) => `${c} sv`),
        ),
        'person',
      ),
      // mirrored about his feet, so he faces the instrument
      ...(s.mirror ? { transform: `translate(${r2(2 * s.person[0])} 0) scale(-1 1)` } : {}),
    },
  ]
}

/** The 12° fan, drawn pointing at its start from the instrument; CSS turns it through the sweep. */
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
    transform: `translate(${hx} ${hy}) rotate(${S01_FAN.startDeg[family]})`,
    children: [
      group(
        'fan',
        [
          path([wedge], 'fan.fill', 0, `${strokeCls({ fill: 'cad', draw: false })} fan`),
          path(edges, 'fan.edge', 0, `${strokeCls({ pen: '025', ink: 'cad', draw: false })} fan`),
        ],
        's01-fan',
      ),
    ],
  }
}

/**
 * A crosshair in each box's corner, drawn when the fan crosses it (--i carries that
 * progress × 1000). A clouded box's crosshair (xc1 to xc3) gives way to its Δ tag.
 */
function crosshairs(family: Fam): SvgNode[] {
  return S01_TOOLS.map((tool) => {
    const { c, r, arm } = crossAt(tool, family)
    const prims: Prim[] = [
      { t: 'circle', c, r },
      { t: 'line', a: [c[0] - arm, c[1]], b: [c[0] + arm, c[1]] },
      { t: 'line', a: [c[0], c[1] - arm], b: [c[0], c[1] + arm] },
    ]
    const i = Math.round(crossP(tool, family) * 1000)
    const n = S01_CLOUDED.indexOf(tool)
    const xc = n < 0 ? '' : ` xc xc${n + 1}`
    return group(`xh.${tool}`, [
      path(prims, `xh.${tool}`, i, `${strokeCls({ pen: '035', ink: 'cad' })} xh${xc}`),
    ])
  })
}

/** Revision clouds Δ1–Δ3 around the three worst bottlenecks (--i is the cloud's order). */
function clouds(family: Fam): SvgNode[] {
  return S01_CLOUDED.map((tool, i) => {
    const r = rectOf(tool, family)
    const pad = family === 'wide' ? 5 : 2
    const cp = cloudPrim(
      { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad },
      { seed: seedFrom(`s01:${family}:cloud:${tool}`), r: family === 'wide' ? 7 : 4 },
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
  const map = doc.groups.flatMap((g) =>
    g.children.map((n) =>
      retag(n, (cls, part) => {
        let c = cls.replace('f-panel', 'f-deep')
        if (byHand.has(part)) c = c.replace('p-070 i-cyan', 'p-050 i-cyan-dim d-hidden')
        return `${c} rd`
      }),
    ),
  )
  const glyphs = S01_TOOLS.map((tool, i) =>
    group(`${tool}.glyph`, [
      path(
        glyphPrims(tool, family),
        `${tool}.glyph`,
        i,
        `${strokeCls({ pen: '035', ink: 'cyan' })} rd`,
      ),
    ]),
  )
  return [...map, ...glyphs]
}

function make(family: Fam, rev: string): SvgDoc {
  const vb = s01Graph.viewBox[family]
  if (rev === 'asFound')
    return {
      viewBox: vb,
      groups: [
        { layer: 'pencil', rev, children: sketch(family) },
        {
          layer: 'pkt',
          rev,
          children: [...survey(family), fan(family), ...crosshairs(family), ...clouds(family)],
        },
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

/** The final frame (p = 1): the clean map on the deep panel, the surveyor beside it on paper. */
function finalStill(family: Fam): string {
  const found = docs.doc(family, 'asFound')
  const keep = new Set(['station', 'surveyor'])
  const surveyor = found.groups
    .filter((g) => g.layer === 'pkt')
    .map((g) => ({
      ...g,
      children: g.children.filter((c) => c.el === 'g' && keep.has(c.part ?? '')),
    }))
  const done = docs.doc(family, 'surveyed')
  return toStillSvg(
    { viewBox: done.viewBox, groups: [...done.groups, ...surveyor] },
    { k: STILL_K[family], ground: 'paper', remap: { panel: 'paper' } },
  )
}

export const drawing: DrawingBuilder = {
  files: docs.files,
  build(file) {
    const [family, rev] = file.split('.') as [Fam, string]
    if (rev === 'surveyed' && file.endsWith('.still.svg')) return finalStill(family)
    return docs.build(file)
  },
}
