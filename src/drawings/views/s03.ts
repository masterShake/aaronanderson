import type { LayoutId, Prim, Pt } from '../types'
import { G, S03_DESIGN, S03_FAMILY, personPolys } from '@/scenes/s03/section'

/**
 * S-03 layout (owner: scenes-b): the pencil side elevation, the section line,
 * the demo batch, and where each HTML label sits in each family. The section
 * itself (the hand-off frame) lives in src/scenes/s03/section.ts, shared with
 * the scene. Design units are 800 × 600; S03_FAMILY places them per family.
 */

/** The demo batch: documents in order; `ok` documents read within tolerance. */
export const S03_BATCH = [
  { label: 'doc.invoice', ok: true },
  { label: 'doc.ticket', ok: true },
  { label: 'doc.submittal', ok: false },
] as const

/** Counts for the live readouts, computed from the batch (never literals). */
export const S03_COUNTS = {
  entered: S03_BATCH.filter((d) => d.ok).length,
  held: S03_BATCH.filter((d) => !d.ok).length,
} as const

/** The pencil side elevation (design units): what the visitor sees before the cut. */
export function sketchPrims(): { id: string; prims: Prim[] }[] {
  const { x0, y0, x1, y1 } = G.body
  const floor = S03_DESIGN.floor
  return [
    { id: 'floor', prims: [{ t: 'line', a: [110, floor], b: [770, floor] }] },
    { id: 'hopper', prims: [{ t: 'poly', pts: [...G.hopper], closed: true }] },
    { id: 'body', prims: [{ t: 'rect', at: [x0, y0], size: [x1 - x0, y1 - y0] }] },
    { id: 'window', prims: [{ t: 'rect', at: [300, 250], size: [150, 70] }] },
    {
      id: 'dial',
      prims: [
        { t: 'circle', c: G.dial.c, r: G.dial.r },
        { t: 'line', a: [G.dial.c[0], G.dial.c[1] + G.dial.r], b: [G.dial.c[0], y0] },
      ],
    },
    {
      id: 'legs',
      prims: G.legs.map(([x, y, w, h]) => ({
        t: 'line',
        a: [x + w / 2, y],
        b: [x + w / 2, y + h],
      })),
    },
    {
      id: 'tray',
      prims: [{ t: 'line', a: [G.tray[0], G.tray[1]], b: [G.tray[0] + G.tray[2], G.tray[1]] }],
    },
    {
      id: 'desk',
      prims: [{ t: 'line', a: [G.desk[0], G.desk[1]], b: [G.desk[0] + G.desk[2], G.desk[1]] }],
    },
    {
      id: 'person',
      prims: personPolys().map((p) => ({ t: 'poly', pts: p.pts, closed: p.closed })),
    },
  ]
}

/** The section line A–A across the sketch (dash-dot), with its view arrows. */
export function sectionLine(): { line: Pt[]; arrows: Pt[][] } {
  const y = G.pathY + 14
  return {
    line: [
      [130, y],
      [570, y],
    ],
    arrows: [
      [
        [124, y - 22],
        [136, y - 22],
        [130, y - 8],
      ],
      [
        [564, y - 22],
        [576, y - 22],
        [570, y - 8],
      ],
    ],
  }
}

/** A prim in family units. */
export function placePrimS03(f: LayoutId, p: Prim): Prim {
  const F = S03_FAMILY[f]
  const T = (q: Pt): Pt => [q[0] * F.s + F.tx, q[1] * F.s + F.ty]
  switch (p.t) {
    case 'line':
      return { t: 'line', a: T(p.a), b: T(p.b) }
    case 'rect':
      return { t: 'rect', at: T(p.at), size: [p.size[0] * F.s, p.size[1] * F.s] }
    case 'poly':
      return { ...p, pts: p.pts.map(T) }
    case 'circle':
      return { t: 'circle', c: T(p.c), r: p.r * F.s }
    default:
      throw new Error(`s03: unsupported prim ${p.t}`)
  }
}

export { S03_LABELS, type S03LabelKey } from '@/scenes/s03/labels'
import type { S03LabelKey } from '@/scenes/s03/labels'

/** Which labels share a spot (only one shows at a time). */
export const S03_LABEL_GROUPS: readonly (readonly S03LabelKey[])[] = [
  ['doc.invoice', 'doc.ticket', 'doc.submittal'],
]

/** Percent (0–100) of the viewBox, for --lx/--ly and --lxt/--lyt. */
export const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
