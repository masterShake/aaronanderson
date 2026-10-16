import type { DrawingBuilder, LayoutId, Prim, Pt, SvgDoc, SvgNode, ViewBox } from '@/drawings/types'
import { frontFrame } from '@/drawings/lib/frame'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { toStillSvg } from '@/drawings/lib/svg-string'
import { frameNodes, pencil } from '@/drawings/render'
import { STILL_K, bundle } from '@/drawings/render'
import { strokeCls } from '@/drawings/render/cad'
import {
  S03_LEADERS,
  dialHub,
  finishDetails,
  magazine,
  placePrimS03,
  sectionLine,
  sketchPrims,
  stackSheets,
} from '@/drawings/views/s03'
import {
  DIAL,
  G,
  S03_FAMILY,
  dialC,
  hatch,
  place,
  s03Spec,
  sectionExtras,
} from '@/scenes/s03/section'

/**
 * The S-03 drawing files (pure; drawing.server.ts serves them):
 *   s03.{family}.json                 every layer, for the live svg tier
 *   s03.{family}.held.still.svg       the section at HELD FOR APPROVAL
 *   s03.{family}.approved.still.svg   the section after approval
 *
 * Groups carry a role in data-rev (sketch, ghost, cut, section, batch) so the
 * figure CSS can window them on --p and on the batch state.
 */

type State = 'live' | 'held' | 'approved'

const node = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})

/** The hand-off frame: frontFrame of the rect parts plus the section details (C1). */
export function s03Frame(f: LayoutId) {
  const base = frontFrame(s03Spec(f))
  const x = sectionExtras(f)
  return { ...base, fills: [...x.fills, ...base.fills], lines: [...base.lines, ...x.lines] }
}

const fmt = (n: number) => Math.round(n * 100) / 100

/** Moving frame parts, posed for a still: rotations about their pivots (family units). */
function posed(f: LayoutId, state: State): Readonly<Record<string, string>> {
  if (state === 'live') return {}
  const c = place(f, dialC(f))
  const p = place(f, G.gate.pivot)
  const needle = state === 'held' ? DIAL.checkDeg : 0
  const gate = state === 'held' ? G.gate.deg : 0
  return {
    needle: `rotate(${needle} ${fmt(c[0])} ${fmt(c[1])})`,
    gate: `rotate(${gate} ${fmt(p[0])} ${fmt(p[1])})`,
  }
}

/**
 * Phones (tall) only: the feed magazine on the hopper, in section (cut walls with hatch, the
 * waiting sheets, the weight plate). SVG only: the tall family never hands off to WebGL.
 */
function magazineNodes(f: LayoutId): SvgNode[] {
  if (f !== 'tall') return []
  const { walls, sheets, plate } = magazine()
  const out: SvgNode[] = []
  const P = (p: Prim) => placePrimS03(f, p)
  walls.forEach((w, i) => {
    const poly = P({ t: 'poly', pts: w, closed: true })
    out.push(node(primD(poly), 0, `mag.wall.${i}`, 0, strokeCls({ fill: 'deep', draw: false })))
    hatch(w, 10).forEach(([a, b], j) => {
      const l = P({ t: 'line', a, b })
      out.push(
        node(
          primD(l),
          primLength(l),
          `mag.hatch.${i}.${j}`,
          0,
          strokeCls({ pen: '025', ink: 'cyan-dim' }),
        ),
      )
    })
    out.push(
      node(
        primD(poly),
        primLength(poly),
        `mag.wall.${i}`,
        0,
        strokeCls({ pen: '070', ink: 'cyan' }),
      ),
    )
  })
  const paper = strokeCls({ pen: '025', ink: 'cyan', fill: 'paper', draw: false })
  sheets.forEach((s, i) => {
    const p = P(s)
    out.push(node(primD(p), primLength(p), `mag.sheet.${i}`, 0, paper))
  })
  plate.forEach((s, i) => {
    const p = P(s)
    if (i === 0)
      out.push(node(primD(p), 0, 'mag.plate', 0, strokeCls({ fill: 'deep', draw: false })))
    out.push(
      node(
        primD(p),
        primLength(p),
        `mag.plate.${i}`,
        0,
        strokeCls({ pen: i ? '035' : '050', ink: 'cyan' }),
      ),
    )
  })
  return out
}

function sectionNodes(f: LayoutId, state: State): SvgNode[] {
  const nodes = [...frameNodes(s03Frame(f)), ...magazineNodes(f)]
  const pose = posed(f, state)
  return nodes.map((n) => {
    if (n.el !== 'path') return n
    const t = pose[n.part]
    const cls = state === 'live' ? `${n.cls} pv` : n.cls
    const out = { ...n, cls }
    return t ? { el: 'g', part: n.part, transform: t, children: [out] } : out
  })
}

const rectD = (f: LayoutId, [x, y, w, h]: readonly [number, number, number, number]) => {
  const corners: Pt[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  const pts = corners.map((q) => place(f, q))
  return {
    d: `M${pts.map((q) => `${fmt(q[0])} ${fmt(q[1])}`).join('L')}Z`,
    len: 2 * (w + h) * S03_FAMILY[f].s,
  }
}

/** The finishing details (SVG only): bezel, ticks, lens housing, hubs, plates, bracket. */
function finishNodes(f: LayoutId, state: State): SvgNode[] {
  const live = state === 'live'
  const out: SvgNode[] = []
  for (const d of finishDetails(f)) {
    const prims = d.prims.map((p) => placePrimS03(f, p))
    const path = prims.map(primD).join('')
    const len = prims.reduce((s, p) => s + primLength(p), 0)
    if (d.fill)
      out.push(node(path, 0, `fin.${d.id}`, d.step, strokeCls({ fill: d.fill, draw: false })))
    out.push(
      node(
        path,
        len,
        `fin.${d.id}`,
        d.step,
        strokeCls({ pen: d.pen, ink: d.ink, draw: live, extra: live ? 'pv' : '' }),
      ),
    )
  }
  const hub = placePrimS03(f, dialHub(f))
  out.push(node(primD(hub), 0, 'fin.hub-dial', 2, strokeCls({ fill: 'cyan', draw: false })))
  // the batch waiting in the hopper (live only: in the stills it has gone through)
  if (live) {
    const paper = strokeCls({ pen: '025', ink: 'cyan', fill: 'paper', draw: false })
    stackSheets().forEach((sheet, i) => {
      const p = placePrimS03(f, sheet)
      out.push({
        el: 'g',
        part: `stack.${i}`,
        children: [node(primD(p), primLength(p), `stack.${i}`, 1, paper)],
      })
    })
  }
  return out
}

/** Leader lines from labels to their objects (thin pen, a dot at the object). */
function leaderNodes(f: LayoutId, state: State): SvgNode[] {
  const live = state === 'live'
  return Object.entries(S03_LEADERS[f]).map(([key, [a, b]], j): SvgNode => {
    const line: Prim = { t: 'line', a, b }
    const dot: Prim = { t: 'circle', c: b, r: 2.5 }
    return {
      el: 'g',
      part: `leader.${key}`,
      children: [
        node(
          primD(line),
          primLength(line),
          `leader.${key}`,
          j,
          strokeCls({ pen: '025', ink: 'cyan-dim', draw: live, extra: live ? 'pv' : '' }),
        ),
        node(primD(dot), 0, `leader.${key}.dot`, j, strokeCls({ fill: 'cyan-dim', draw: false })),
      ],
    }
  })
}

/** Documents, cards, the lamp and the stamp. Live: at rest (CSS moves them); stills: posed. */
function batchNodes(f: LayoutId, state: State): SvgNode[] {
  const s = S03_FAMILY[f].s
  const out: SvgNode[] = []
  const paper = strokeCls({ pen: '025', ink: 'cyan', fill: 'paper', draw: false })
  // documents: three sheets under the throat
  const doc = rectD(f, G.doc)
  for (let i = 0; i < 3; i++) {
    if (state !== 'live' && i < 2) continue
    const d = node(doc.d, doc.len, `doc.${i}`, i, paper)
    const [dx, dy] = G.heldAt
    const t = state === 'live' ? undefined : `translate(${fmt(dx * s)} ${fmt(dy * s)})`
    const kids: SvgNode[] = [d]
    if (i === 2 && state !== 'held') {
      const st = rectD(f, [G.doc[0] + 15, G.doc[1] - 4, 18, 4])
      kids.push(node(st.d, st.len, 'stamp', 0, strokeCls({ fill: 'orange', draw: false })))
    }
    out.push({ el: 'g', part: `doc.${i}`, ...(t ? { transform: t } : {}), children: kids })
  }
  // data cards on the tray, bottom first
  const cards = state === 'held' ? 2 : 3
  for (let i = 0; i < cards; i++) {
    const [x, y, w, h] = G.card
    const c = rectD(f, [x, y - i * (h + 1), w, h])
    out.push({
      el: 'g',
      part: `card.${i}`,
      children: [node(c.d, c.len, `card.${i}`, i, paper)],
    })
  }
  // the lamp, lit while the batch waits for a person
  if (state !== 'approved') {
    const lamp = s03Frame(f).fills.find((x) => x.id === 'lamp')!
    const d = `M${lamp.pts.map((q) => `${fmt(q[0])} ${fmt(q[1])}`).join('L')}Z`
    out.push(node(d, 0, 'lamp-on', 0, strokeCls({ fill: 'orange', draw: false })))
  }
  return out
}

function sketchNodes(f: LayoutId, draw: boolean, ink: string): SvgNode[] {
  const out: SvgNode[] = []
  let i = 0
  for (const s of sketchPrims(f)) {
    const prims = s.prims.map((p) => placePrimS03(f, p))
    for (const st of pencil(prims, { seed: seedFrom(`s03:${s.id}`), preset: 'box' }))
      out.push(
        node(
          st.d,
          st.len,
          `sketch.${s.id}`,
          i,
          strokeCls({ pen: '035', ink, draw, extra: draw ? 'pv' : '' }),
        ),
      )
    i++
  }
  return out
}

function cutNodes(f: LayoutId): SvgNode[] {
  const { line, arrows } = sectionLine()
  const l = placePrimS03(f, { t: 'poly', pts: line })
  const fade = 'pv fade'
  const out: SvgNode[] = [
    node(
      primD(l),
      primLength(l),
      'cut',
      0,
      strokeCls({ pen: '050', ink: 'orange', dash: 'center', draw: false, extra: fade }),
    ),
  ]
  arrows.forEach((a, j) => {
    const p = placePrimS03(f, { t: 'poly', pts: a, closed: true })
    out.push(
      node(
        primD(p),
        primLength(p),
        `cut.arrow${j}`,
        j + 1,
        strokeCls({ fill: 'orange', draw: false, extra: fade }),
      ),
    )
  })
  return out
}

function panelNode(vb: ViewBox): SvgNode {
  const [x, y, w, h] = vb
  return node(
    `M${x} ${y}H${x + w}V${y + h}H${x}Z`,
    0,
    'panel',
    0,
    strokeCls({ fill: 'deep', draw: false }),
  )
}

/** The live drawing for one family: every layer the svg tier animates. */
export function s03Doc(f: LayoutId): SvgDoc {
  const vb = S03_FAMILY[f].vb
  return {
    viewBox: vb,
    groups: [
      { layer: 'panel', rev: 'panel', children: [panelNode(vb)] },
      { layer: 'pencil', rev: 'sketch', children: sketchNodes(f, true, 'pencil') },
      { layer: 'ghost', rev: 'ghost', children: sketchNodes(f, false, 'paper') },
      { layer: 'pencil', rev: 'cut', children: cutNodes(f) },
      { layer: 'cad', rev: 'section', children: sectionNodes(f, 'live') },
      { layer: 'cad', rev: 'finish', children: finishNodes(f, 'live') },
      { layer: 'cad', rev: 'leader', children: leaderNodes(f, 'live') },
      { layer: 'pkt', rev: 'batch', children: batchNodes(f, 'live') },
    ],
  }
}

/** A still: the finished section on blueprint (no pencil ghost), at HELD or after approval. */
export function s03StillDoc(f: LayoutId, state: 'held' | 'approved'): SvgDoc {
  const vb = S03_FAMILY[f].vb
  return {
    viewBox: vb,
    groups: [
      { layer: 'cad', children: sectionNodes(f, state) },
      { layer: 'cad', children: finishNodes(f, state) },
      { layer: 'cad', children: leaderNodes(f, state) },
      { layer: 'pkt', children: batchNodes(f, state) },
    ],
  }
}

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const STATES = ['held', 'approved'] as const

export const s03Drawing: DrawingBuilder = {
  files: FAMILIES.flatMap((f) => [`${f}.json`, ...STATES.map((s) => `${f}.${s}.still.svg`)]),
  build(file) {
    const [family, state] = file.split('.') as [LayoutId, string]
    if (file.endsWith('.json')) return JSON.stringify(bundle(s03Doc(family)))
    return toStillSvg(s03StillDoc(family, state as 'held' | 'approved'), {
      k: STILL_K[family],
      ground: 'deep',
      remap: { panel: 'deep' },
    })
  },
}
