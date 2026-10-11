import type { LayoutId, ModelPart, ModelSpec, Pt, ViewBox } from '../types'
import { S02 } from '@/motion/timing/s02'

/**
 * S-02 System Integration (owner: scenes-a): one layout per family, shared by the 2D
 * drawing (drawing.server.ts), the label overlay, the controller and the WebGL scene.
 * Isomorphic data plus the loop mechanism; no roughjs, no three, no DOM, no strings.
 *
 * Wide is stage-hero §4.1 at about ×1.2, with the boxes widened to 240 so every labeled
 * box is at least 104 × 36 CSS px at the 440 px family minimum (D10). Tall stacks the
 * three places in a right-hand column (≥ 116 × 40 units, for 360 px).
 */

export type S02Tool = 'crm' | 'est' | 'pm' | 'acct'
export type S02Dest = 'est' | 'pm' | 'acct'
export type S02Route = 'lead' | S02Dest
export type Rect = readonly [x: number, y: number, w: number, h: number]

export const S02_TOOLS: readonly S02Tool[] = ['crm', 'est', 'pm', 'acct']
export const S02_DESTS: readonly S02Dest[] = ['est', 'pm', 'acct']
export const S02_ROUTES: readonly S02Route[] = ['lead', 'est', 'pm', 'acct']
/** Label keys in src/content/figures/s02.ts. */
export const S02_LABEL: Readonly<Record<S02Tool, string>> = {
  crm: 'tool.crm',
  est: 'tool.estimate',
  pm: 'tool.pm',
  acct: 'tool.accounting',
}

export interface S02Layout {
  viewBox: ViewBox
  boxes: Readonly<Record<S02Tool, Rect>>
  /** Extruded heights (3D and the iso print). */
  heights: Readonly<Record<S02Tool, number>>
  tee: Pt
  /** Conduits, source to sink (plan points; corners filleted by `fillet`). */
  routes: Readonly<Record<S02Route, readonly Pt[]>>
  fillet: number
  /** Pipe radius and centre height in 3D. */
  pipeR: number
  pipeY: number
  /** Flange tick half length (plan) and disc radius (3D). */
  flangeHalf: number
  flangeR: number
  /** The hand-carry line (pencil) and the carrier's walk along its middle leg. */
  carry: readonly Pt[]
  walkFrom: Pt
  walkTo: Pt
  /** Pencil scribble rows per box, as fractions of the box. */
  rows: readonly (readonly [y: number, x0: number, x1: number])[]
  /** How far before the flange the stalled copy waits (loop 3). */
  stallBack: number
}

const rows = [
  [0.18, 0.08, 0.62],
  [0.8, 0.08, 0.78],
  [0.9, 0.08, 0.46],
] as const

const WIDE: S02Layout = {
  viewBox: [0, 0, 960, 720],
  boxes: {
    crm: [48, 300, 240, 120],
    est: [624, 108, 240, 120],
    pm: [624, 300, 240, 120],
    acct: [624, 492, 240, 120],
  },
  heights: { crm: 72, est: 58, pm: 58, acct: 58 },
  tee: [408, 360],
  routes: {
    lead: [
      [288, 360],
      [408, 360],
    ],
    est: [
      [408, 360],
      [408, 168],
      [624, 168],
    ],
    pm: [
      [408, 360],
      [624, 360],
    ],
    acct: [
      [408, 360],
      [408, 552],
      [624, 552],
    ],
  },
  fillet: 12,
  pipeR: 5.4,
  pipeY: 21.6,
  flangeHalf: 11,
  flangeR: 10,
  carry: [
    [168, 300],
    [168, 264],
    [744, 264],
    [744, 228],
  ],
  walkFrom: [196, 264],
  walkTo: [716, 264],
  rows,
  stallBack: 16,
}

const TALL: S02Layout = {
  viewBox: [0, 0, 400, 500],
  boxes: {
    crm: [16, 214, 136, 72],
    est: [236, 60, 148, 72],
    pm: [236, 214, 148, 72],
    acct: [236, 368, 148, 72],
  },
  heights: { crm: 40, est: 32, pm: 32, acct: 32 },
  tee: [194, 250],
  routes: {
    lead: [
      [152, 250],
      [194, 250],
    ],
    est: [
      [194, 250],
      [194, 96],
      [236, 96],
    ],
    pm: [
      [194, 250],
      [236, 250],
    ],
    acct: [
      [194, 250],
      [194, 404],
      [236, 404],
    ],
  },
  fillet: 10,
  pipeR: 3,
  pipeY: 12,
  flangeHalf: 7,
  flangeR: 6,
  carry: [
    [84, 214],
    [84, 176],
    [310, 176],
    [310, 132],
  ],
  walkFrom: [100, 176],
  walkTo: [290, 176],
  rows,
  stallBack: 10,
}

export const S02_LAYOUT: Readonly<Record<LayoutId, S02Layout>> = { wide: WIDE, tall: TALL }

/** The port a route leaves or reaches, for the flange ticks: the CRM's and each place's. */
export function s02Flanges(l: S02Layout): Record<'crm' | S02Dest, { at: Pt; dir: Pt }> {
  const end = (r: readonly Pt[]) => r[r.length - 1]!
  const lead = l.routes.lead
  return {
    crm: { at: lead[0]!, dir: [1, 0] },
    est: { at: end(l.routes.est), dir: [1, 0] },
    pm: { at: end(l.routes.pm), dir: [1, 0] },
    acct: { at: end(l.routes.acct), dir: [1, 0] },
  }
}

/** A closed polygon approximating a circle (exact in both renderers: no arcs). */
export function ring(c: Pt, r: number, n = 16): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return [
      Math.round((c[0] + r * Math.cos(a)) * 100) / 100,
      Math.round((c[1] + r * Math.sin(a)) * 100) / 100,
    ]
  })
}

/**
 * The model: four enclosures, the junction (tee), four conduits and four flanges. Its
 * planFrame() is the hand-off frame both renderers draw; isoPrintDoc() is the print.
 */
export function s02Model(family: LayoutId): ModelSpec {
  const l = S02_LAYOUT[family]
  const parts: ModelPart[] = []
  for (const t of S02_TOOLS) {
    const [x, y, w, h] = l.boxes[t]
    parts.push({
      id: `box.${t}`,
      kind: 'box',
      prims: [{ t: 'rect', at: [x, y], size: [w, h] }],
      depth: l.heights[t],
      material: 'aluminum',
      anchor: S02_LABEL[t],
    })
  }
  parts.push({
    id: 'tee',
    kind: 'cyl',
    prims: [{ t: 'poly', pts: ring(l.tee, l.pipeR, 16), closed: true }],
    depth: l.pipeY + l.pipeR * 1.6,
    material: 'aluminum',
  })
  for (const r of S02_ROUTES)
    parts.push({
      id: `pipe.${r}`,
      kind: 'pipe',
      prims: [{ t: 'poly', pts: l.routes[r], r: l.fillet }],
      depth: 2 * l.pipeR,
      z: l.pipeY - l.pipeR,
      material: 'aluminum',
    })
  const fl = s02Flanges(l)
  for (const k of ['crm', ...S02_DESTS] as const) {
    const { at, dir } = fl[k]
    const x = at[0] + dir[0] * (k === 'crm' ? 4 : -4)
    parts.push({
      id: `flange.${k}`,
      kind: 'flange',
      prims: [
        {
          t: 'poly',
          pts: [
            [x, at[1] - l.flangeHalf],
            [x, at[1] + l.flangeHalf],
          ],
        },
      ],
      depth: 2 * l.flangeR,
      z: l.pipeY - l.flangeR,
      material: 'orange',
    })
  }
  return { id: `s02.${family}`, layout: family, viewBox: l.viewBox, start: 'plan', parts }
}

/** Route lengths (filleted), per family: the lead and each place. */
export type S02Lens = Readonly<Record<S02Route, number>>

export interface S02MechState {
  /** 0-based loop; loops === S02.loops means done. */
  loop: number
  ms: number
  done: boolean
  /** Arc length of the lead on its route, or -1. */
  lead: number
  /** Arc length of each copy on its route, or -1. */
  copy: Readonly<Record<S02Dest, number>>
  lamp: Readonly<Record<S02Dest, boolean>>
  /** Loop 3 only. */
  failed: boolean
  flash: boolean
  /** Flange re-seat offset along the pipe axis, 0 to 1 (3D). */
  reseat: number
  beat: 'running' | 'syncfail' | 'synced' | 'idle'
}

/**
 * The loop at mechanism time t (ms since the loops started). The lead runs to the
 * junction and splits into three copies at constant speed; each place's lamp blinks
 * on arrival. On loop S02.failLoop the accounting copy stalls `stallBack` before its
 * flange until S02.resumeAt: two flashes (S02.pulseMs on and off) and the chip.
 */
export function s02Mech(t: number, lens: S02Lens, stallBack: number): S02MechState {
  const total = S02.loop * S02.loops
  const done = t >= total
  const loop = done ? S02.loops : Math.floor(t / S02.loop)
  const ms = done ? S02.loop : t - loop * S02.loop
  const v = S02.leadSpeed / 1000
  const split = lens.lead / v
  const fail = !done && loop === S02.failLoop - 1
  const stallS = Math.max(0, lens.acct - stallBack)
  const stallAt = split + stallS / v
  const lead = !done && ms < split ? ms * v : -1
  const at = (d: S02Dest): number => {
    if (done || ms < split) return -1
    let s = (ms - split) * v
    if (d === 'acct' && fail) {
      if (ms >= stallAt && ms < S02.resumeAt) s = stallS
      else if (ms >= S02.resumeAt) s = stallS + (ms - S02.resumeAt) * v
    }
    return s > lens[d] ? -1 : s
  }
  const arrive = (d: S02Dest) =>
    d === 'acct' && fail ? S02.resumeAt + (lens.acct - stallS) / v : split + lens[d] / v
  const lamp = (d: S02Dest) => !done && ms >= arrive(d) && ms < arrive(d) + S02.blinkMs
  const since = ms - stallAt
  const failed = fail && ms >= stallAt && ms < S02.chipTo
  const flash =
    fail && since >= 0 && since < 3 * S02.pulseMs && Math.floor(since / S02.pulseMs) % 2 === 0
  const reseat = fail
    ? Math.min(1, Math.max(0, (ms - (S02.resumeAt - S02.reseatMs)) / S02.reseatMs))
    : 1
  const beat = done
    ? 'idle'
    : fail && ms >= stallAt && ms < arrive('acct')
      ? 'syncfail'
      : fail && ms >= arrive('acct')
        ? 'synced'
        : 'running'
  return {
    loop,
    ms,
    done,
    lead,
    copy: { est: at('est'), pm: at('pm'), acct: at('acct') },
    lamp: { est: lamp('est'), pm: lamp('pm'), acct: lamp('acct') },
    failed,
    flash,
    reseat,
    beat,
  }
}
