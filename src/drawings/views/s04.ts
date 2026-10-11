import type { LayoutId, Pt, ViewBox } from '../types'

/**
 * S-04 Data & Dashboards (owner: scenes-a): one layout per family, shared by the 2D
 * drawing (drawing.server.ts), the label overlay and the controller. Isomorphic data;
 * no roughjs, no three, no DOM, no strings.
 *
 * An instrument panel of 3 × 2 cells over one data store. Five pencil tiles (the reports
 * each system exports today) lock into the first five cells; the top row becomes three
 * dials, the bottom row the report printer, the question slot and the nameplate. Tiles
 * are at least 104 × 36 CSS px at the 440 px (wide) and 360 px (tall) minimums.
 */

export type Rect = readonly [x: number, y: number, w: number, h: number]
export type S04Tile = 'accounting' | 'pm' | 'timesheets' | 'estimate' | 'payroll'
export type S04Dial = 'cost' | 'schedule' | 'hours'
export type S04Reading = 'low' | 'in' | 'check'

export const S04_TILES: readonly S04Tile[] = [
  'accounting',
  'pm',
  'timesheets',
  'estimate',
  'payroll',
]
export const S04_DIALS: readonly S04Dial[] = ['cost', 'schedule', 'hours']
export const S04_READINGS: readonly S04Reading[] = ['low', 'in', 'check']
/** Needle angle (degrees from straight up) for each reading; the bands run −120° to +120°. */
export const S04_NEEDLE: Readonly<Record<S04Reading, number>> = { low: -80, in: 0, check: 80 }
/** The bands: LOW −120…−40, IN RANGE −40…+40, CHECK +40…+120 (degrees from straight up). */
export const S04_BANDS: Readonly<Record<S04Reading, readonly [number, number]>> = {
  low: [-120, -40],
  in: [-40, 40],
  check: [40, 120],
}

/** Each question chip moves one dial to one reading (scripted sample answers). */
export const S04_QUESTIONS = {
  project: { dial: 'schedule', reading: 'in' },
  budget: { dial: 'cost', reading: 'check' },
  hours: { dial: 'hours', reading: 'low' },
} as const satisfies Readonly<Record<string, { dial: S04Dial; reading: S04Reading }>>
export type S04Question = keyof typeof S04_QUESTIONS

export interface S04Layout {
  viewBox: ViewBox
  panel: Rect
  /** Cells, row by row: 0–2 dials, 3 printer, 4 question slot, 5 nameplate. */
  cells: readonly Rect[]
  /** Where each tile lands (inside cells 0–4) and where it starts, rotated (degrees). */
  tiles: Readonly<Record<S04Tile, { at: Rect; from: Pt; rot: number }>>
  dials: Readonly<Record<S04Dial, { c: Pt; r: number }>>
  /** The dial name band at the top of each dial cell. */
  names: Readonly<Record<S04Dial, Rect>>
  readings: Readonly<Record<S04Dial, Rect>>
  printer: Rect
  slot: Rect
  nameplate: Rect
  /** The report card fully out, below the printer slot (it is revealed top down). */
  card: Rect
  cardOut: number
  /** The data store (a capsule in plan) and its risers to the panel's bottom edge. */
  tank: Rect
  risers: readonly (readonly [Pt, Pt])[]
}

function grid(panel: Rect): Rect[] {
  const [x, y, w, h] = panel
  const cw = w / 3
  const ch = h / 2
  return [0, 1].flatMap((r) => [0, 1, 2].map((c) => [x + c * cw, y + r * ch, cw, ch] as Rect))
}

function build(
  viewBox: ViewBox,
  panel: Rect,
  inset: readonly [number, number],
  scatter: readonly (readonly [number, number, number])[],
  dial: { r: number; nameH: number; readH: number },
  tank: Rect,
  cardOut: number,
): S04Layout {
  const cells = grid(panel)
  const tiles = {} as Record<S04Tile, { at: Rect; from: Pt; rot: number }>
  S04_TILES.forEach((t, i) => {
    const [x, y, w, h] = cells[i]!
    const [fx, fy, rot] = scatter[i]!
    tiles[t] = {
      at: [x + inset[0], y + inset[1], w - 2 * inset[0], h - 2 * inset[1]],
      from: [fx, fy],
      rot,
    }
  })
  const dials = {} as Record<S04Dial, { c: Pt; r: number }>
  const names = {} as Record<S04Dial, Rect>
  const readings = {} as Record<S04Dial, Rect>
  S04_DIALS.forEach((d, i) => {
    const [x, y, w, h] = cells[i]!
    names[d] = [x, y, w, dial.nameH]
    const free = h - dial.nameH - dial.readH
    dials[d] = { c: [x + w / 2, y + dial.nameH + free / 2 + dial.r * 0.15], r: dial.r }
    readings[d] = [x, y + h - dial.readH, w, dial.readH]
  })
  const slotRect = (c: Rect): Rect => {
    const [x, y, w, h] = c
    return [x + w * 0.12, y + h * 0.42, w * 0.76, Math.max(10, h * 0.08)]
  }
  const printer = slotRect(cells[3]!)
  const [cx, cy, cw, ch] = cells[5]!
  const nameplate: Rect = [cx + cw * 0.14, cy + ch * 0.3, cw * 0.72, ch * 0.34]
  const card: Rect = [
    printer[0] + printer[2] * 0.1,
    printer[1] + printer[3],
    printer[2] * 0.8,
    cardOut,
  ]
  const [tx, ty, tw] = tank
  const bottom = panel[1] + panel[3]
  const risers = [0.25, 0.5, 0.75].map(
    (k) => [[tx + tw * k, ty] as Pt, [tx + tw * k, bottom] as Pt] as const,
  )
  return {
    viewBox,
    panel,
    cells,
    tiles,
    dials,
    names,
    readings,
    printer,
    slot: slotRect(cells[4]!),
    nameplate,
    card,
    cardOut,
    tank,
    risers,
  }
}

export const S04_LAYOUT: Readonly<Record<LayoutId, S04Layout>> = {
  wide: build(
    [0, 0, 960, 720],
    [120, 48, 720, 384],
    [6, 18],
    [
      [24, 40, -9],
      [420, 506, 7],
      [712, 120, -6],
      [60, 450, 11],
      [660, 470, -12],
    ],
    { r: 58, nameH: 44, readH: 30 },
    [300, 540, 360, 110],
    72,
  ),
  tall: build(
    [0, 0, 400, 500],
    [20, 28, 360, 300],
    [2, 10],
    [
      [12, 320, -9],
      [140, 352, 7],
      [262, 318, -6],
      [30, 170, 11],
      [254, 160, -12],
    ],
    { r: 30, nameH: 42, readH: 22 },
    [70, 400, 260, 72],
    56,
  ),
}

export interface S04MechState {
  loop: number
  done: boolean
  /** Arc length on each riser (0 at the tank), or −1. */
  rise: readonly number[]
  /** Needles have settled into IN RANGE this run. */
  settled: boolean
  /** The report card's slide, 0 (in the printer) to 1 (out). */
  card: number
}

/** The loop at mechanism time t (ms since the loops started). */
export function s04Mech(
  t: number,
  riser: number,
  T: {
    loop: number
    loops: number
    riseSpeed: number
    packetEvery: number
    packetsTo: number
    settleAt: number
    cardA: number
    cardB: number
  },
): S04MechState {
  const done = t >= T.loop * T.loops
  const loop = done ? T.loops : Math.floor(t / T.loop)
  const ms = done ? T.loop : t - loop * T.loop
  const v = T.riseSpeed / 1000
  const rise = [0, 1, 2].map((i) => {
    if (done) return -1
    for (let t0 = i * T.packetEvery; t0 < T.packetsTo; t0 += 3 * T.packetEvery) {
      const s = (ms - t0) * v
      if (s >= 0 && s <= riser) return s
    }
    return -1
  })
  const card = Math.min(1, Math.max(0, (ms - T.cardA) / (T.cardB - T.cardA)))
  return { loop, done, rise, settled: done || loop > 0 || ms >= T.settleAt, card: done ? 1 : card }
}
