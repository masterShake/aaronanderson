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
  /**
   * How far upstream of each place's inlet its flange sits. The inlets are on the west
   * faces, which the south-east iso camera cannot see; upstream, the flange (and the loop-3
   * stall) stays in view above the pipe.
   */
  flangeIn: number
  /** The hand-carry line (pencil) and the carrier's walk along its middle leg. */
  carry: readonly Pt[]
  walkFrom: Pt
  walkTo: Pt
  /** The carrier's scale (the scale figure is 64 units tall at 1). */
  carrierK: number
  /** How far before the flange the stalled copy waits (loop 3). */
  stallBack: number
}

/*
 * Wide: the CRM on the left, the three places stacked on the right, the junction between.
 * The boxes fill the frame (40 to 50 units of margin); each box's top half carries its
 * label and its bottom half the tool's glyph. The carrier walks the line the estimating
 * conduit later takes.
 */
const WIDE: S02Layout = {
  viewBox: [0, 0, 960, 720],
  boxes: {
    crm: [40, 256, 290, 208],
    est: [616, 44, 304, 168],
    pm: [616, 276, 304, 168],
    acct: [616, 508, 304, 168],
  },
  heights: { crm: 84, est: 64, pm: 64, acct: 64 },
  // the junction sits nearer the CRM, so the shortest branch (pm) is long enough for all
  // three copies to be on screen together for more than half a second
  tee: [432, 360],
  routes: {
    lead: [
      [330, 360],
      [432, 360],
    ],
    est: [
      [432, 360],
      [432, 128],
      [616, 128],
    ],
    pm: [
      [432, 360],
      [616, 360],
    ],
    acct: [
      [432, 360],
      [432, 592],
      [616, 592],
    ],
  },
  fillet: 14,
  pipeR: 6.4,
  pipeY: 24,
  flangeHalf: 13,
  flangeR: 12,
  flangeIn: 50,
  carry: [
    [185, 256],
    [185, 128],
    [616, 128],
  ],
  walkFrom: [214, 128],
  walkTo: [560, 128],
  carrierK: 1.1,
  stallBack: 64,
}

/* Tall: the same plan, narrower; the places fill the right-hand column top to bottom. */
const TALL: S02Layout = {
  viewBox: [0, 0, 400, 500],
  boxes: {
    crm: [12, 186, 134, 128],
    est: [232, 24, 156, 120],
    pm: [232, 190, 156, 120],
    acct: [232, 356, 156, 120],
  },
  heights: { crm: 46, est: 36, pm: 36, acct: 36 },
  tee: [184, 250],
  routes: {
    lead: [
      [146, 250],
      [184, 250],
    ],
    est: [
      [184, 250],
      [184, 84],
      [232, 84],
    ],
    pm: [
      [184, 250],
      [232, 250],
    ],
    acct: [
      [184, 250],
      [184, 416],
      [232, 416],
    ],
  },
  fillet: 10,
  pipeR: 3.4,
  pipeY: 13,
  flangeHalf: 8,
  flangeR: 7,
  flangeIn: 22,
  carry: [
    [79, 186],
    [79, 84],
    [232, 84],
  ],
  walkFrom: [96, 84],
  walkTo: [206, 84],
  carrierK: 0.62,
  stallBack: 30,
}

/** Which glyph names each tool (S-01 uses the same set). */
export type GlyphKind =
  'cards' | 'grid' | 'gantt' | 'ledger' | 'envelope' | 'folder' | 'phone' | 'timecard' | 'paycheck'
export const S02_GLYPH: Readonly<Record<S02Tool, GlyphKind>> = {
  crm: 'cards',
  est: 'grid',
  pm: 'gantt',
  acct: 'ledger',
}

const g2 = (n: number) => Math.round(n * 100) / 100

/**
 * A tool's identifying glyph as open polylines (closed shapes repeat their first point, so
 * planFrame gives them no fill): a card file, a spreadsheet grid, Gantt bars, a ledger, an
 * envelope, a folder, a phone, a time card or a paycheck. Centred on c, s units tall and
 * about 1.5 s wide.
 */
export function glyphLines(kind: GlyphKind, c: Pt, s: number): Pt[][] {
  const w = s * 1.5
  const h = s
  const x0 = c[0] - w / 2
  const y0 = c[1] - h / 2
  const X = (f: number) => x0 + w * f
  const Y = (f: number) => y0 + h * f
  const P = (pts: [number, number][]): Pt[] => pts.map(([x, y]) => [g2(X(x)), g2(Y(y))] as Pt)
  const box = (a: number, b: number, c2: number, d: number) =>
    P([
      [a, b],
      [c2, b],
      [c2, d],
      [a, d],
      [a, b],
    ])
  const ln = (a: number, b: number, c2: number, d: number) =>
    P([
      [a, b],
      [c2, d],
    ])
  switch (kind) {
    case 'grid':
      return [
        box(0, 0, 1, 1),
        ln(0, 0.25, 1, 0.25),
        ln(0, 0.5, 1, 0.5),
        ln(0, 0.75, 1, 0.75),
        ln(0.34, 0, 0.34, 1),
        ln(0.56, 0, 0.56, 1),
        ln(0.78, 0, 0.78, 1),
      ]
    case 'gantt':
      return [
        P([
          [0, 0],
          [0, 1],
          [1, 1],
        ]),
        box(0.08, 0.1, 0.46, 0.3),
        box(0.32, 0.4, 0.72, 0.6),
        box(0.6, 0.7, 0.96, 0.9),
        P([
          [0.46, 0.2],
          [0.52, 0.2],
          [0.52, 0.4],
        ]),
        P([
          [0.72, 0.5],
          [0.78, 0.5],
          [0.78, 0.7],
        ]),
      ]
    case 'ledger':
      return [
        P([
          [0.5, 0.1],
          [0.04, 0],
          [0.04, 0.9],
          [0.5, 1],
          [0.96, 0.9],
          [0.96, 0],
          [0.5, 0.1],
          [0.5, 1],
        ]),
        ln(0.12, 0.3, 0.42, 0.36),
        ln(0.12, 0.5, 0.42, 0.56),
        ln(0.12, 0.7, 0.42, 0.76),
        ln(0.58, 0.36, 0.88, 0.3),
        ln(0.58, 0.56, 0.88, 0.5),
        ln(0.58, 0.76, 0.88, 0.7),
      ]
    case 'cards': {
      const out: Pt[][] = [
        P([
          [0, 0.46],
          [0, 1],
          [1, 1],
          [1, 0.46],
        ]),
        box(0.4, 0.66, 0.6, 0.8),
      ]
      for (let i = 0; i < 3; i++) {
        const t = 0.08 + i * 0.13
        const a = 0.12 + i * 0.26
        out.push(
          P([
            [0.08, 0.46],
            [0.08, t],
            [a, t],
            [a, t - 0.08],
            [a + 0.2, t - 0.08],
            [a + 0.2, t],
            [0.92, t],
            [0.92, 0.46],
          ]),
        )
      }
      return out
    }
    case 'envelope':
      return [
        box(0.08, 0.05, 0.92, 0.95),
        P([
          [0.08, 0.05],
          [0.5, 0.55],
          [0.92, 0.05],
        ]),
      ]
    case 'folder':
      return [
        P([
          [0.06, 1],
          [0.06, 0],
          [0.38, 0],
          [0.46, 0.14],
          [0.94, 0.14],
          [0.94, 1],
          [0.06, 1],
        ]),
        ln(0.06, 0.3, 0.94, 0.3),
      ]
    case 'phone':
      return [box(0.34, 0, 0.66, 1), box(0.38, 0.1, 0.62, 0.78), box(0.47, 0.85, 0.53, 0.92)]
    case 'timecard': {
      const r = 0.17
      const ring: Pt[] = Array.from({ length: 13 }, (_, i) => {
        const a = (2 * Math.PI * i) / 12
        return [g2(c[0] + Math.cos(a) * r * h), g2(Y(0.3) + Math.sin(a) * r * h)] as Pt
      })
      return [
        box(0.22, 0, 0.78, 1),
        ring,
        P([
          [0.5, 0.18],
          [0.5, 0.3],
          [0.58, 0.3],
        ]),
        ln(0.3, 0.62, 0.7, 0.62),
        ln(0.3, 0.74, 0.7, 0.74),
        ln(0.3, 0.86, 0.7, 0.86),
      ]
    }
    case 'paycheck':
      return [
        box(0, 0.16, 1, 0.84),
        box(0.66, 0.28, 0.92, 0.44),
        ln(0.08, 0.36, 0.56, 0.36),
        ln(0.08, 0.54, 0.92, 0.54),
        P([
          [0.56, 0.74],
          [0.64, 0.66],
          [0.7, 0.74],
          [0.78, 0.66],
          [0.86, 0.72],
        ]),
      ]
  }
}

/** Where a box's glyph sits (its bottom half) and how big: the label owns the top half. */
export function glyphPlace([x, y, w, h]: Rect): { c: Pt; s: number } {
  const s = Math.min(h * 0.42, (w * 0.8) / 1.5)
  return { c: [g2(x + w / 2), g2(y + h * 0.69)], s: g2(s) }
}

/** Each place's arrival lamp (plan units): its enclosure's top right corner. */
export function s02Lamp(l: S02Layout, d: S02Dest): Pt {
  const [x, y, w] = l.boxes[d]
  const inset = l.flangeR * 1.8
  return [x + w - inset, y + inset]
}

/**
 * Where a tool's label hangs from on its enclosure's top (plan units). 'plan': at the
 * hand-off pose a label hung above this point lands where the plan label is, so nothing
 * jumps. 'iso' (the turned model and the print): forward and left of centre, just behind
 * the glyph, so the label stays on its own top and clear of the enclosure behind.
 */
export function s02LabelAt(l: S02Layout, t: S02Tool, pose: 'plan' | 'iso' = 'iso'): Pt {
  const [x, y, w, h] = l.boxes[t]
  return pose === 'plan' ? [x + w * 0.5, y + h * 0.31] : [x + w * 0.44, y + h * 0.46]
}

/** The glyph of one S-02 tool, in plan units. */
export const s02Glyph = (l: S02Layout, t: S02Tool): Pt[][] => {
  const { c, s } = glyphPlace(l.boxes[t])
  return glyphLines(S02_GLYPH[t], c, s)
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
    // The tool's glyph: detail lines on the enclosure's top (open polylines, so no fill).
    parts.push({
      id: `glyph.${t}`,
      kind: 'card',
      prims: s02Glyph(l, t).map((pts) => ({ t: 'poly' as const, pts })),
      depth: 0,
      z: l.heights[t],
      material: 'aluminum',
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
    const x = at[0] + dir[0] * (k === 'crm' ? 4 : -l.flangeIn)
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
