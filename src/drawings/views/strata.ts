import type { LayoutId, Pen, Prim, Pt, SvgDoc, SvgNode, ViewBox } from '../types'
import { mulberry32, primD } from '../lib/geometry'
import { primLength } from '../lib/length'

/**
 * The strata on About (DETAIL 1 / G-02; pages-drawings §6.11; owner:
 * home-about): a section cut A–A through three bands, code on top, office in
 * the middle, field at the bottom. FIELD is earth hatch (45° lines and dots),
 * OFFICE concrete (stipple and small triangles), CODE a fine square grid.
 * Static: one state, no draw-on (Appendix B §B12 item 7). No strings: the
 * labels are HTML, keyed into src/content/figures/strata.ts.
 */

export type StrataBand = 'code' | 'office' | 'field'
export const STRATA_REV = 'section'

interface Layout {
  viewBox: ViewBox
  /** Left and right edges of the bands. */
  x: readonly [number, number]
  /** The cut line's height. */
  cut: number
  /** Band tops and the bottom, top to bottom: code, office, field, bottom. */
  ys: readonly [number, number, number, number]
}

export const STRATA_LAYOUT: Readonly<Record<LayoutId, Layout>> = {
  wide: { viewBox: [0, 0, 960, 480], x: [40, 920], cut: 44, ys: [96, 206, 326, 452] },
  tall: { viewBox: [0, 0, 400, 520], x: [20, 380], cut: 40, ys: [92, 214, 350, 500] },
}

/** Where each band's HTML label sits (its top-left, viewBox units). */
export function strataLabelAt(family: LayoutId, band: StrataBand | 'section'): Pt {
  const l = STRATA_LAYOUT[family]
  if (band === 'section') return [l.x[0], l.cut - 34]
  const i = band === 'code' ? 0 : band === 'office' ? 1 : 2
  return [l.x[0] + 12, l.ys[i]! + 10]
}

const path = (prims: readonly Prim[], part: string, pen: Pen, ink: string, i: number): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  // the drawing vocabulary (src/drawings/lib/svg-string.ts): pen and ink, no draw-on
  cls: `p-${pen} i-${ink}`,
})

/** 45° lines clipped to a rect, every `step` units. */
function diagonals(x0: number, y0: number, x1: number, y1: number, step: number): Prim[] {
  const out: Prim[] = []
  const h = y1 - y0
  for (let c = x0 - h + step / 2; c < x1; c += step) {
    // the line x = c + (y1 - y), from the bottom edge up and to the right
    const a: Pt = [Math.max(x0, c), y1 - (Math.max(x0, c) - c)]
    const bx = Math.min(x1, c + h)
    const b: Pt = [bx, y1 - (bx - c)]
    if (b[0] - a[0] > 1) out.push({ t: 'line', a, b })
  }
  return out
}

function grid(x0: number, y0: number, x1: number, y1: number, step: number): Prim[] {
  const out: Prim[] = []
  for (let x = x0 + step; x < x1 - 1; x += step) out.push({ t: 'line', a: [x, y0], b: [x, y1] })
  for (let y = y0 + step; y < y1 - 1; y += step) out.push({ t: 'line', a: [x0, y], b: [x1, y] })
  return out
}

/** Seeded dots and small triangles (stipple), kept a margin inside the rect. */
function stipple(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  n: number,
  seed: number,
  tri: number,
): { dots: Prim[]; tris: Prim[] } {
  const rnd = mulberry32(seed)
  const dots: Prim[] = []
  const tris: Prim[] = []
  const m = 8
  for (let i = 0; i < n; i++) {
    const x = Math.round((x0 + m + rnd() * (x1 - x0 - 2 * m)) * 10) / 10
    const y = Math.round((y0 + m + rnd() * (y1 - y0 - 2 * m)) * 10) / 10
    if (i % tri === 0) {
      const s = 5
      tris.push({
        t: 'poly',
        pts: [
          [x, y - s],
          [x + s, y + s * 0.7],
          [x - s, y + s * 0.7],
        ],
        closed: true,
      })
    } else dots.push({ t: 'circle', c: [x, y], r: 1 })
  }
  return { dots, tris }
}

/** The strata as one SvgDoc for a family. */
export function strataDoc(family: LayoutId): SvgDoc {
  const l = STRATA_LAYOUT[family]
  const [x0, x1] = l.x
  const [yc, yo, yf, yb] = l.ys
  const area = (x1 - x0) / 960
  const kids: SvgNode[] = []
  // the bands, top to bottom
  kids.push(
    path(grid(x0, yc, x1, yo, 16), 'code', '018', 'graphite', 0),
    path([{ t: 'rect', at: [x0, yc], size: [x1 - x0, yo - yc] }], 'code', '050', 'asphalt', 0),
  )
  const st = stipple(x0, yo, x1, yf, Math.round(260 * area), 4096, 7)
  kids.push(
    path(st.dots, 'office', '025', 'graphite', 1),
    path(st.tris, 'office', '018', 'graphite', 1),
    path([{ t: 'rect', at: [x0, yo], size: [x1 - x0, yf - yo] }], 'office', '050', 'asphalt', 1),
  )
  const dots = stipple(x0, yf, x1, yb, Math.round(120 * area), 1931, 1e9).dots
  kids.push(
    path(diagonals(x0, yf, x1, yb, 18), 'field', '018', 'graphite', 2),
    path(dots, 'field', '025', 'graphite', 2),
    path([{ t: 'rect', at: [x0, yf], size: [x1 - x0, yb - yf] }], 'field', '050', 'asphalt', 2),
  )
  // the section cut A–A: a chain line across the top with arrows at both ends pointing down
  const arrow = (x: number): Prim[] => [
    { t: 'line', a: [x, l.cut - 14], b: [x, l.cut + 18] },
    {
      t: 'poly',
      pts: [
        [x - 6, l.cut + 8],
        [x, l.cut + 18],
        [x + 6, l.cut + 8],
      ],
    },
  ]
  kids.push(
    path([{ t: 'line', a: [x0 - 8, l.cut], b: [x1 + 8, l.cut] }], 'cut', '025', 'asphalt', 3),
    path([...arrow(x0 + 4), ...arrow(x1 - 4)], 'cut', '050', 'asphalt', 3),
  )
  return {
    viewBox: l.viewBox,
    groups: [{ layer: 'cad', rev: STRATA_REV, children: kids }],
  }
}
