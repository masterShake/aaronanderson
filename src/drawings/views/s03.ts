import type { LayoutId, Prim, Pt } from '../types'
import { G, S03_DESIGN, S03_FAMILY, dialC, personPolys } from '@/scenes/s03/section'

/**
 * S-03 layout (owner: scenes-b): the pencil side elevation, the section line,
 * the demo batch, and where each HTML label sits in each family. The section
 * itself (the hand-off frame) lives in src/scenes/s03/section.ts, shared with
 * the scene. Design units are 800 × 600; S03_FAMILY places them per family.
 */

/**
 * The demo batch: documents in order; `ok` documents read within tolerance. `label` is the
 * content key of the document's name (the hopper label's second line while it runs).
 */
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

/**
 * Phones (tall) only: a feed magazine standing on the hopper lip, holding the documents
 * still to come under a weight plate. Its walls are cut like the body's. Design units.
 */
export const MAGAZINE = { x0: 168, x1: 292, top: -56, t: 8, plateY: 30 } as const

/** The magazine's parts (design units): wall outlines, the waiting sheets, the plate. */
export function magazine(): { walls: Pt[][]; sheets: Prim[]; plate: Prim[] } {
  const { x0, x1, top, t, plateY } = MAGAZINE
  const lip = G.hopper[0]![1] - 5
  const wall = (x: number): Pt[] => [
    [x, top],
    [x + t, top],
    [x + t, lip],
    [x, lip],
  ]
  const sheets: Prim[] = Array.from({ length: 8 }, (_, i) => {
    const y = plateY + 10 + i * 8
    const tip = i % 2 ? -1 : 1
    return {
      t: 'poly',
      pts: [
        [x0 + t + 5, y + tip],
        [x1 - t - 5, y - tip],
        [x1 - t - 5, y - tip + 2.5],
        [x0 + t + 5, y + tip + 2.5],
      ],
      closed: true,
    }
  })
  const cx = (x0 + x1) / 2
  return {
    walls: [wall(x0), wall(x1 - t)],
    sheets,
    plate: [
      { t: 'rect', at: [x0 + t + 2, plateY], size: [x1 - x0 - 2 * t - 4, 6] },
      {
        t: 'poly',
        pts: [
          [cx - 12, plateY],
          [cx - 12, plateY - 12],
          [cx + 12, plateY - 12],
          [cx + 12, plateY],
        ],
      },
    ],
  }
}

/** The pencil side elevation (design units): what the visitor sees before the cut. */
export function sketchPrims(f: LayoutId): { id: string; prims: Prim[] }[] {
  const { x0, y0, x1, y1 } = G.body
  const floor = S03_DESIGN.floor
  const c = dialC(f)
  const M = MAGAZINE
  const lip = G.hopper[0]![1] - 5
  return [
    { id: 'floor', prims: [{ t: 'line', a: [134, floor], b: [736, floor] }] },
    { id: 'hopper', prims: [{ t: 'poly', pts: [...G.hopper], closed: true }] },
    ...(f === 'tall'
      ? [
          {
            id: 'magazine',
            prims: [
              { t: 'rect', at: [M.x0, M.top], size: [M.x1 - M.x0, lip - M.top] },
              {
                t: 'rect',
                at: [M.x0 + M.t + 4, M.plateY + 8],
                size: [M.x1 - M.x0 - 2 * M.t - 8, 64],
              },
            ] as Prim[],
          },
        ]
      : []),
    { id: 'body', prims: [{ t: 'rect', at: [x0, y0], size: [x1 - x0, y1 - y0] }] },
    { id: 'window', prims: [{ t: 'rect', at: [300, 250], size: [150, 70] }] },
    {
      id: 'dial',
      prims: [
        { t: 'circle', c, r: G.dial.r },
        { t: 'line', a: [c[0], c[1] + G.dial.r], b: [c[0], y0] },
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

/** Which labels share a spot (only one shows at a time). None: each object has one label. */
export const S03_LABEL_GROUPS: readonly (readonly S03LabelKey[])[] = []

/**
 * Leader lines from a label to the object it names, in viewBox units per family: [from,
 * to], with a dot at `to`. Only labels that sit away from their object have one. The data
 * card readout's leader runs up under its (opaque) card from the card stack.
 */
export const S03_LEADERS: Readonly<
  Record<LayoutId, Partial<Record<S03LabelKey, readonly [Pt, Pt]>>>
> = {
  wide: {
    card: [
      [697, 150],
      [697, 318],
    ],
    tray: [
      [650, 612],
      [650, 518],
    ],
  },
  tall: {
    tray: [
      [290, 436],
      [290, 384],
    ],
  },
}

/** A finishing detail: SVG-only linework (the WebGL scene does not ship for S-03). */
export interface S03Detail {
  id: string
  prims: Prim[]
  pen: '025' | '035' | '050' | '070'
  ink: 'cyan' | 'cyan-dim'
  fill?: 'deep' | 'cyan' | 'cyan-dim'
  /** Draw-on step (detail stagger units after detailFromP). */
  step: number
}

const ring = (c: Pt, r: number): Prim => ({ t: 'circle', c, r })
const tick = (c: Pt, r0: number, r1: number, deg: number): Prim => {
  const a = ((deg - 90) * Math.PI) / 180
  return {
    t: 'line',
    a: [c[0] + r0 * Math.cos(a), c[1] + r0 * Math.sin(a)],
    b: [c[0] + r1 * Math.cos(a), c[1] + r1 * Math.sin(a)],
  }
}

/**
 * The finishing details of section A–A, in design units: the gauge's bezel, ticks and
 * hub; the reader's lens housing and eye; roller hubs; leg base plates; the hopper lip;
 * the output tray's bracket.
 */
export function finishDetails(f: LayoutId): S03Detail[] {
  const { r } = G.dial
  const c = dialC(f)
  const ticks = Array.from({ length: 9 }, (_, k) => tick(c, r - 3, r - 11, -120 + 30 * k))
  const hx = G.head[0] + G.head[2] / 2
  const ly = G.lens[1] + G.lens[3]
  const legs = G.legs.slice(0, 2)
  return [
    {
      id: 'base',
      step: 4,
      pen: '050',
      ink: 'cyan',
      fill: 'deep',
      prims: legs.map(([x, , w]) => ({
        t: 'rect',
        at: [x - 6, S03_DESIGN.floor - 5],
        size: [w + 12, 5],
      })),
    },
    {
      id: 'lip',
      step: 0,
      pen: '050',
      ink: 'cyan',
      prims: [
        {
          t: 'rect',
          at: [G.hopper[0]![0] - 4, G.hopper[0]![1] - 5],
          size: [G.hopper[1]![0] - G.hopper[0]![0] + 8, 5],
        },
      ],
    },
    {
      id: 'hub',
      step: 0,
      pen: '035',
      ink: 'cyan',
      fill: 'cyan',
      prims: G.rollers.map((q) => ring(q, 3)),
    },
    {
      id: 'lens-housing',
      step: 1,
      pen: '050',
      ink: 'cyan',
      prims: [
        {
          t: 'poly',
          pts: [
            [G.lens[0] - 2, ly],
            [G.lens[0] + G.lens[2] + 2, ly],
            [G.lens[0] + G.lens[2] - 8, ly + 8],
            [G.lens[0] + 8, ly + 8],
          ],
          closed: true,
        },
      ],
    },
    {
      id: 'eye',
      step: 1,
      pen: '035',
      ink: 'cyan',
      prims: [ring([hx, G.head[1] + G.head[3] / 2], 6), ring([hx, G.head[1] + G.head[3] / 2], 2)],
    },
    { id: 'bezel', step: 2, pen: '070', ink: 'cyan', prims: [ring(c, r + 5)] },
    // the tall mast stands in a foot bolted to the top wall
    ...(f === 'tall'
      ? [
          {
            id: 'mast-foot',
            step: 2,
            pen: '050',
            ink: 'cyan',
            fill: 'deep',
            prims: [{ t: 'rect', at: [c[0] - 10, G.body.y0 - 6], size: [20, 6] }],
          } satisfies S03Detail,
        ]
      : []),
    { id: 'ticks', step: 2, pen: '025', ink: 'cyan', prims: ticks },
    {
      id: 'bracket',
      step: 5,
      pen: '035',
      ink: 'cyan',
      prims: [
        { t: 'line', a: [G.body.x1, G.tray[1] + 40], b: [G.body.x1 + 44, G.tray[1] + G.tray[3]] },
      ],
    },
  ]
}

/** The hub drawn over the needle (after the moving parts). */
export const dialHub = (f: LayoutId): Prim => ring(dialC(f), 3.5)

/**
 * The batch waiting in the hopper: three sheets, top first (stack.0 feeds first), each a
 * paper sheet like the moving documents, resting on the hopper's sloped walls.
 */
export function stackSheets(): Prim[] {
  const [a, b, c, d] = G.hopper as readonly [Pt, Pt, Pt, Pt]
  const leftAt = (y: number) => a[0] + ((y - a[1]) / (d[1] - a[1])) * (d[0] - a[0])
  const rightAt = (y: number) => b[0] + ((y - b[1]) / (c[1] - b[1])) * (c[0] - b[0])
  // loose sheets, edge on like the moving documents, each tipped a little
  return [178, 186, 194].map((y, i) => {
    const x0 = leftAt(y + 2) + 6
    const x1 = rightAt(y + 2) - 6
    const tip = i === 1 ? -2 : 2
    return {
      t: 'poly',
      pts: [
        [x0, y + tip],
        [x1, y - tip],
        [x1, y - tip + 2.5],
        [x0, y + tip + 2.5],
      ],
      closed: true,
    }
  })
}

/** Percent (0–100) of the viewBox, for --lx/--ly and --lxt/--lyt. */
export const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100
