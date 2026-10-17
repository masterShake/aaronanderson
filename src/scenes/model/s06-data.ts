import type { ModelPart, Pt } from '@/drawings/types'

/**
 * Each tool's identifying glyph (finish standard B1), drawn in a 10 × 10 cell as polylines of
 * x, y pairs: an envelope (inbox), a spreadsheet grid (estimate), a phone (field), a ledger
 * (accounting), a chart sheet (owner's report), a card file (CRM) and Gantt bars (projects).
 */
const GLYPH: Readonly<Record<string, readonly (readonly number[])[]>> = {
  inbox: [
    [0, 2, 10, 2, 10, 9, 0, 9, 0, 2],
    [0, 2, 5, 6, 10, 2],
  ],
  estimate: [
    [0, 0, 10, 0, 10, 10, 0, 10, 0, 0],
    [0, 4, 10, 4],
    [0, 7, 10, 7],
    [4, 0, 4, 10],
    [7, 0, 7, 10],
  ],
  field: [
    [3, 0, 7, 0, 7, 10, 3, 10, 3, 0],
    [4, 8, 6, 8],
  ],
  accounting: [
    [0, 1, 10, 1, 10, 9, 0, 9, 0, 1],
    [5, 1, 5, 9],
    [1, 4, 4, 4],
    [6, 4, 9, 4],
    [1, 6, 4, 6],
    [6, 6, 9, 6],
  ],
  report: [
    [0, 0, 0, 10, 10, 10],
    [3, 10, 3, 6],
    [6, 10, 6, 3],
    [9, 10, 9, 1],
  ],
  crm: [
    [0, 3, 10, 3, 10, 10, 0, 10, 0, 3],
    [1, 3, 1, 1, 9, 1, 9, 3],
    [2, 6, 6, 6],
    [2, 8, 8, 8],
  ],
  pm: [
    [0, 2, 5, 2],
    [3, 5, 8, 5],
    [5, 8, 10, 8],
  ],
}

/**
 * The glyphs of the model's tool boxes, in plan units, in each box's top-left corner (a quarter
 * of the box's short side, clear of its centred name). The CAD plan, the WebGL decal and model,
 * and the iso print all draw these. `i` is the box's order among the tools.
 */
export function s06Glyphs(parts: readonly ModelPart[]): { id: string; i: number; pts: Pt[] }[] {
  const out: { id: string; i: number; pts: Pt[] }[] = []
  let i = 0
  for (const p of parts) {
    const g = GLYPH[p.anchor?.startsWith('tool.') ? p.anchor.slice(5) : '']
    const q = p.prims[0]
    if (!g || q?.t !== 'rect') continue
    const s = (Math.min(q.size[0], q.size[1]) * 0.25) / 10
    const [x, y] = [q.at[0] + s * 4.5, q.at[1] + s * 4.5]
    for (const l of g) {
      const pts: Pt[] = []
      for (let j = 0; j < l.length; j += 2) pts.push([x + l[j]! * s, y + l[j + 1]! * s])
      out.push({ id: `glyph.${p.id}`, i, pts })
    }
    i++
  }
  return out
}

/**
 * What S-06 adds to the hero's wide model (views/s06.ts buildS06Model('wide')), precomputed
 * for the s06 scene: the flange the FIXED stall happens at, the monitor gauge, and the three
 * month instruments (stub and enclosure). data.unit.spec.ts asserts it equals the live build.
 */
export const S06_EXTRA = [
  {
    id: 'flange',
    kind: 'flange',
    prims: [{ t: 'circle', c: [480, 362], r: 11 }],
    depth: 22,
    z: 3,
    material: 'aluminum',
    anchor: 'fixed',
  },
  {
    id: 'gauge',
    kind: 'cyl',
    prims: [{ t: 'circle', c: [566, 376], r: 22 }],
    depth: 60,
    material: 'aluminum',
    anchor: 'gauge',
  },
  {
    id: 'm1.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [130, 432],
          [84, 432],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m1'],
  },
  {
    id: 'm1',
    kind: 'box',
    prims: [{ t: 'rect', at: [69, 420], size: [30, 24] }],
    depth: 22,
    material: 'aluminum',
    anchor: 'add.report',
    revs: ['m1'],
  },
  {
    id: 'm2.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [655, 96],
          [655, 142],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m2'],
  },
  {
    id: 'm2',
    kind: 'box',
    prims: [{ t: 'rect', at: [640, 130], size: [30, 24] }],
    depth: 22,
    material: 'aluminum',
    anchor: 'add.alert',
    revs: ['m2'],
  },
  {
    id: 'm3.stub',
    kind: 'pipe',
    prims: [
      {
        t: 'poly',
        pts: [
          [305, 96],
          [305, 50],
        ],
      },
    ],
    depth: 7,
    z: 10,
    material: 'aluminum',
    revs: ['m3'],
  },
  {
    id: 'm3',
    kind: 'box',
    prims: [{ t: 'rect', at: [290, 38], size: [30, 24] }],
    depth: 22,
    material: 'aluminum',
    anchor: 'add.automation',
    revs: ['m3'],
  },
] as unknown as readonly ModelPart[]
