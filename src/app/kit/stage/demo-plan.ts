import type { Pen, Pt, ViewBox } from '@/drawings/types'

/**
 * The /kit/stage demo's plan: one description both renderers draw, so the
 * hand-off frame is the same in the SVG and in WebGL (the demo's stand-in for
 * src/drawings/lib/frame.ts planFrame until the drawings lane merges it).
 * Isomorphic: no three, no DOM. Lines sit on whole user units with a 2-unit
 * pen, so at 1× and 2× both renderers fill whole device pixels.
 */

export type Rect = readonly [x: number, y: number, w: number, h: number]

export const DEMO_VIEWBOX: ViewBox = [0, 0, 960, 600]
/** The demo's art box is drawn at one CSS px per unit. */
export const DEMO_CSS_WIDTH = 960
export const DEMO_PEN: Pen = '070'

export interface DemoBox {
  id: string
  rect: Rect
  /** Extruded height, user units. */
  height: number
  material: 'aluminum' | 'orange'
}

export const DEMO_BOXES: readonly DemoBox[] = [
  { id: 'a', rect: [120, 220, 160, 120], height: 70, material: 'aluminum' },
  { id: 'b', rect: [400, 140, 160, 120], height: 110, material: 'orange' },
  { id: 'c', rect: [680, 300, 160, 140], height: 60, material: 'aluminum' },
]

/** Conduits between the boxes, right-angle polylines (source to sink). */
export const DEMO_ROUTES: readonly (readonly Pt[])[] = [
  [
    [280, 280],
    [340, 280],
    [340, 200],
    [400, 200],
  ],
  [
    [560, 200],
    [620, 200],
    [620, 370],
    [680, 370],
  ],
]

/** The gauge sits on box c. */
export const DEMO_GAUGE = { at: [760, 370] as Pt, r: 40 }

/** Every plan segment as [x1, y1, x2, y2]: box outlines then conduits. */
export function demoSegments(): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  for (const {
    rect: [x, y, w, h],
  } of DEMO_BOXES) {
    out.push([x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y])
  }
  for (const r of DEMO_ROUTES)
    for (let i = 1; i < r.length; i++) out.push([r[i - 1]![0], r[i - 1]![1], r[i]![0], r[i]![1]])
  return out
}

/** Probe points for the seam test: segment midpoints (line centres) and open panel. */
export function demoProbes(): { lines: Pt[]; panel: Pt[] } {
  const segs = demoSegments()
  const lines = [0.5, 0.25, 0.75]
    .flatMap((k) => segs.map(([a, b, c, d]) => [a + (c - a) * k, b + (d - b) * k] as Pt))
    .slice(0, 24)
  const panel: Pt[] = []
  for (let i = 0; panel.length < 24; i++) {
    const p: Pt = [40 + ((i * 97) % 880), 30 + ((i * 61) % 540)]
    const near = demoSegments().some(([a, b, c, d]) => {
      const x0 = Math.min(a, c) - 8
      const x1 = Math.max(a, c) + 8
      const y0 = Math.min(b, d) - 8
      const y1 = Math.max(b, d) + 8
      return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1
    })
    if (!near) panel.push(p)
  }
  return { lines, panel }
}
