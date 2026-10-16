import type { Prim, Pt } from '@/drawings/types'

/**
 * Small equipment glyphs for the How It Works and Contact figures (owner:
 * howcontact). Pure geometry, isomorphic, no strings. Every glyph returns
 * `{ outline, detail }`, so the drawing can ink them with the outline and
 * detail pens (finish standard B2). `c` is the glyph's centre; `s` is its
 * nominal size (width for most), in user units.
 */

export interface Glyph {
  outline: Prim[]
  detail: Prim[]
}

const r = (n: number) => Math.round(n * 100) / 100
const P = (x: number, y: number): Pt => [r(x), r(y)]
export const rectP = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: P(x, y),
  size: [r(w), r(h)],
})
export const lineP = (a: Pt, b: Pt): Prim => ({ t: 'line', a: P(a[0], a[1]), b: P(b[0], b[1]) })
const poly = (pts: readonly Pt[], closed = false): Prim => ({
  t: 'poly',
  pts: pts.map((p) => P(p[0], p[1])),
  closed,
})

/** An envelope: the body and its flap. */
export function envelope(c: Pt, s: number): Glyph {
  const w = s
  const h = s * 0.64
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  return {
    outline: [rectP(x, y, w, h)],
    detail: [
      poly([
        [x, y],
        [c[0], y + h * 0.58],
        [x + w, y],
      ]),
    ],
  }
}

/** A phone: the body, the screen and the button. */
export function phone(c: Pt, s: number): Glyph {
  const w = s * 0.56
  const h = s
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  return {
    outline: [rectP(x, y, w, h)],
    detail: [
      rectP(x + w * 0.14, y + h * 0.12, w * 0.72, h * 0.66),
      { t: 'circle', c: P(c[0], y + h * 0.89), r: r(s * 0.045) },
    ],
  }
}

/** A sheet with a folded corner and ruled lines. */
export function sheet(c: Pt, s: number, rows = 4): Glyph {
  const w = s * 0.78
  const h = s
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const f = w * 0.26
  const detail: Prim[] = [
    poly([
      [x + w - f, y],
      [x + w - f, y + f],
      [x + w, y + f],
    ]),
  ]
  for (let i = 0; i < rows; i++) {
    const yy = y + h * 0.36 + i * ((h * 0.5) / Math.max(1, rows - 1))
    detail.push(lineP([x + w * 0.16, yy], [x + w * (i === rows - 1 ? 0.56 : 0.84), yy]))
  }
  return {
    outline: [
      poly(
        [
          [x, y],
          [x + w - f, y],
          [x + w, y + f],
          [x + w, y + h],
          [x, y + h],
        ],
        true,
      ),
    ],
    detail,
  }
}

/** A chart sheet: a sheet with a small bar chart and a rising line (the owner's or job-cost report). */
export function chartSheet(c: Pt, s: number): Glyph {
  const g = sheet(c, s, 0)
  const w = s * 0.78
  const h = s
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const base = y + h * 0.84
  const bars = [0.3, 0.46, 0.38, 0.6]
  bars.forEach((b, i) => {
    const bx = x + w * (0.16 + i * 0.18)
    g.detail.push(rectP(bx, base - h * b, w * 0.11, h * b))
  })
  g.detail.push(lineP([x + w * 0.12, base], [x + w * 0.88, base]))
  return g
}

/** A spreadsheet: a sheet with a grid. */
export function gridSheet(c: Pt, s: number): Glyph {
  const w = s
  const h = s * 0.76
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const detail: Prim[] = []
  for (let i = 1; i < 4; i++) detail.push(lineP([x, y + (h * i) / 4], [x + w, y + (h * i) / 4]))
  for (let i = 1; i < 3; i++) detail.push(lineP([x + (w * i) / 3, y], [x + (w * i) / 3, y + h]))
  return { outline: [rectP(x, y, w, h)], detail }
}

/** A ledger: a bound book with a spine band and ruled lines. */
export function ledger(c: Pt, s: number): Glyph {
  const w = s * 0.8
  const h = s
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const detail: Prim[] = [lineP([x + w * 0.2, y], [x + w * 0.2, y + h])]
  for (let i = 0; i < 4; i++) {
    const yy = y + h * (0.28 + i * 0.16)
    detail.push(lineP([x + w * 0.34, yy], [x + w * 0.84, yy]))
  }
  return { outline: [rectP(x, y, w, h)], detail }
}

/** A card file: a box with tabbed cards standing in it (purchase orders, CRM). */
export function cardFile(c: Pt, s: number): Glyph {
  const w = s
  const h = s * 0.7
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const top = y + h * 0.38
  const detail: Prim[] = []
  for (let i = 0; i < 3; i++) {
    const cx = x + w * (0.12 + i * 0.1)
    const cy = y + i * h * 0.1
    detail.push(
      poly([
        [cx, top],
        [cx, cy + h * 0.12],
        [cx + w * 0.2, cy + h * 0.12],
        [cx + w * 0.24, cy],
        [cx + w * 0.4, cy],
        [cx + w * 0.44, cy + h * 0.12],
        [cx + w * 0.72, cy + h * 0.12],
        [cx + w * 0.72, top],
      ]),
    )
  }
  return {
    outline: [rectP(x, top, w, h - (top - y))],
    detail: [...detail, lineP([c[0] - w * 0.14, y + h * 0.72], [c[0] + w * 0.14, y + h * 0.72])],
  }
}

/** A printer: the body, the paper tray and a sheet coming out. */
export function printer(c: Pt, s: number): Glyph {
  const w = s
  const h = s * 0.46
  const x = c[0] - w / 2
  const y = c[1] - h / 2 + s * 0.08
  return {
    outline: [rectP(x, y, w, h)],
    detail: [
      poly([
        [x + w * 0.22, y],
        [x + w * 0.22, y - s * 0.24],
        [x + w * 0.78, y - s * 0.24],
        [x + w * 0.78, y],
      ]),
      rectP(x + w * 0.18, y + h * 0.62, w * 0.64, h * 0.18),
      { t: 'circle', c: P(x + w * 0.86, y + h * 0.3), r: r(s * 0.035) },
    ],
  }
}

/** A month calendar: the page, the header band, the rings and a few day cells. */
export function calendar(c: Pt, s: number): Glyph {
  const w = s
  const h = s * 0.86
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const detail: Prim[] = [
    lineP([x, y + h * 0.24], [x + w, y + h * 0.24]),
    lineP([x + w * 0.28, y - s * 0.08], [x + w * 0.28, y + h * 0.1]),
    lineP([x + w * 0.72, y - s * 0.08], [x + w * 0.72, y + h * 0.1]),
  ]
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++)
      detail.push(
        rectP(x + w * (0.1 + col * 0.21), y + h * (0.38 + row * 0.28), w * 0.14, h * 0.16),
      )
  return { outline: [rectP(x, y, w, h)], detail }
}

/** A desk phone handset with two sound arcs (the call). */
export function handset(c: Pt, s: number): Glyph {
  const k = s / 40
  const pt = (x: number, y: number): Pt => [c[0] + x * k, c[1] + y * k]
  return {
    outline: [
      poly(
        [
          pt(-16, -10),
          pt(-8, -16),
          pt(-2, -8),
          pt(-7, -3),
          pt(3, 7),
          pt(8, 2),
          pt(16, 8),
          pt(10, 16),
          pt(2, 14),
          pt(-14, -2),
        ],
        true,
      ),
    ],
    detail: [
      { t: 'arc', c: pt(4, -4), r: r(9 * k), from: 290, to: 340 },
      { t: 'arc', c: pt(4, -4), r: r(15 * k), from: 285, to: 345 },
    ],
  }
}

/** A short written page with a signature line and a signature (the written next step). */
export function signedSheet(c: Pt, s: number): Glyph {
  const g = sheet(c, s, 3)
  const w = s * 0.78
  const h = s
  const x = c[0] - w / 2
  const y = c[1] - h / 2
  const sy = y + h * 0.86
  g.detail.push(lineP([x + w * 0.4, sy], [x + w * 0.86, sy]))
  g.detail.push({
    t: 'cubic',
    a: P(x + w * 0.42, sy - h * 0.03),
    c1: P(x + w * 0.52, sy - h * 0.16),
    c2: P(x + w * 0.62, sy + h * 0.02),
    b: P(x + w * 0.8, sy - h * 0.09),
  })
  return g
}

/** A filing cabinet: the carcass, the drawers with handles and label slots. */
export function cabinet(x: number, y: number, w: number, h: number, drawers = 3): Glyph {
  const detail: Prim[] = []
  const pad = w * 0.08
  const dh = (h - pad * (drawers + 1)) / drawers
  for (let i = 0; i < drawers; i++) {
    const dy = y + pad + i * (dh + pad)
    detail.push(rectP(x + pad, dy, w - pad * 2, dh))
    detail.push(rectP(x + w / 2 - w * 0.14, dy + dh * 0.56, w * 0.28, dh * 0.12))
    detail.push(rectP(x + w / 2 - w * 0.09, dy + dh * 0.2, w * 0.18, dh * 0.18))
  }
  return { outline: [rectP(x, y, w, h)], detail }
}

type Box = { x: number; y: number; w: number; h: number }

/** The ticket figure: the glyph that names each tool, bottom right in its box (null: none). */
export function nodeGlyph(id: string, r: Box, family: 'wide' | 'tall'): Glyph | null {
  const s = family === 'wide' ? Math.min(34, r.h * 0.56) : Math.min(24, r.h * 0.5)
  const c: Pt = [r.x + r.w - s / 2 - (family === 'wide' ? 12 : 8), r.y + r.h - s / 2 - 6]
  switch (id) {
    case 'field':
    case 'pm':
      return phone(c, s)
    case 'inbox':
      return envelope(c, s)
    case 'office':
      return printer(c, s)
    case 'po':
      return cardFile(c, s)
    case 'match':
      return gridSheet(c, s)
    case 'accounting':
    case 'acct':
      return ledger(c, s)
    case 'jobCost':
    case 'job':
      return chartSheet(c, s)
    default:
      return null
  }
}

/** The ticket figure: the width a node's label may use (its box less padding and glyph). */
export function labelRoom(id: string, r: Box, family: 'wide' | 'tall'): number {
  const pad = family === 'wide' ? 10 : 7
  // the truck's name stays on its body, clear of the cab
  if (id === 'truck') return r.w - (family === 'wide' ? 66 : 42) - pad - 6
  return nodeGlyph(id, r, family) ? r.w - pad * 2 - (family === 'wide' ? 40 : 28) : r.w - pad * 2
}

/** Two flange plates across a pipe at c (dir: the pipe's direction). */
export function flange(c: Pt, dir: 'h' | 'v', half: number, gap = 3): Prim[] {
  if (dir === 'h')
    return [
      lineP([c[0] - gap, c[1] - half], [c[0] - gap, c[1] + half]),
      lineP([c[0] + gap, c[1] - half], [c[0] + gap, c[1] + half]),
    ]
  return [
    lineP([c[0] - half, c[1] - gap], [c[0] + half, c[1] - gap]),
    lineP([c[0] - half, c[1] + gap], [c[0] + half, c[1] + gap]),
  ]
}

/** A small truck in elevation: box body, cab with window, two wheels. */
export function truck(x: number, y: number, w: number, h: number): Glyph {
  const wr = h * 0.17
  const cabW = w * 0.3
  const bodyW = w - cabW - w * 0.03
  const base = y + h - wr
  return {
    outline: [
      rectP(x, y, bodyW, base - y),
      poly(
        [
          [x + bodyW + w * 0.03, base],
          [x + bodyW + w * 0.03, y + h * 0.3],
          [x + w - cabW * 0.35, y + h * 0.3],
          [x + w, y + h * 0.52],
          [x + w, base],
        ],
        true,
      ),
      { t: 'circle', c: P(x + bodyW * 0.24, base), r: r(wr) },
      { t: 'circle', c: P(x + w - cabW * 0.45, base), r: r(wr) },
    ],
    detail: [
      poly(
        [
          [x + w - cabW * 0.82, y + h * 0.37],
          [x + w - cabW * 0.36, y + h * 0.37],
          [x + w - cabW * 0.12, y + h * 0.5],
          [x + w - cabW * 0.82, y + h * 0.5],
        ],
        true,
      ),
      { t: 'circle', c: P(x + bodyW * 0.24, base), r: r(wr * 0.4) },
      { t: 'circle', c: P(x + w - cabW * 0.45, base), r: r(wr * 0.4) },
    ],
  }
}
