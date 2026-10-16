import type { Part, Prim, Pt, SymbolDef, SymbolId, ToolKind } from '../types'
import type { Rect } from '../lib/route'
import { cloudPrim, deltaTag } from './clouds'

/**
 * The symbol library (pages-drawings §5.1; _finish B1). Geometry only, in
 * local units with an anchor 'c' (the placement point). Every symbol has a
 * clean variant (CAD paths) and a pencil variant (the same primitives through
 * roughjs); the renderer picks. Labels are never part of a symbol: they are
 * HTML. Each function keeps the extents it always had (W4 changed how the
 * things look, never where they sit), so compositions built on them stay valid.
 */

const P = (
  id: string,
  prims: readonly Prim[],
  o: Partial<Pick<Part, 'pen' | 'ink' | 'fill' | 'dash' | 'layer'>> = {},
): Part => ({
  id,
  layer: o.layer ?? 'cad',
  prims,
  pen: o.pen ?? '050',
  ink: o.ink ?? 'cyan',
  ...(o.fill ? { fill: o.fill } : {}),
  ...(o.dash ? { dash: o.dash } : {}),
})

const def = (
  id: SymbolId,
  viewBox: SymbolDef['viewBox'],
  parts: readonly Part[],
  anchors: Record<string, Pt> = {},
): SymbolDef => ({
  id,
  viewBox,
  parts,
  anchors: { c: [viewBox[0] + viewBox[2] / 2, viewBox[1] + viewBox[3] / 2], ...anchors },
})

const r2 = (n: number) => Math.round(n * 100) / 100
const R = (p: Pt): Pt => [r2(p[0]), r2(p[1])]
const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a: R(a), b: R(b) })
const rect = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: R([x, y]),
  size: [r2(w), r2(h)],
})
const poly = (pts: readonly Pt[], closed = false): Prim => ({ t: 'poly', pts: pts.map(R), closed })
const rad = (d: number) => (d * Math.PI) / 180
const polar = (c: Pt, r: number, deg: number): Pt => [
  c[0] + Math.cos(rad(deg)) * r,
  c[1] + Math.sin(rad(deg)) * r,
]

/** The open arrowhead (8 u) at b, pointing along a → b. */
export function arrowhead(a: Pt, b: Pt, size = 8): Prim {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const ux = dx / l
  const uy = dy / l
  const w = size * 0.45
  return {
    t: 'poly',
    pts: [
      [b[0] - ux * size + -uy * w, b[1] - uy * size + ux * w],
      b,
      [b[0] - ux * size - -uy * w, b[1] - uy * size - ux * w],
    ],
  }
}

/** The paper glyph (10 × 12, folded corner) centred at c. */
export function paperGlyph(c: Pt): Prim[] {
  const [x, y] = [c[0] - 5, c[1] - 6]
  return [
    {
      t: 'poly',
      pts: [
        [x, y],
        [x + 7, y],
        [x + 10, y + 3],
        [x + 10, y + 12],
        [x, y + 12],
      ],
      closed: true,
    },
    {
      t: 'poly',
      pts: [
        [x + 7, y],
        [x + 7, y + 3],
        [x + 10, y + 3],
      ],
    },
  ]
}

/**
 * A pipe flange at `at` on a run heading along unit `d`: two short plates
 * across the pipe, `gap` apart, `half` either side of the centre line.
 */
export function flangePrims(at: Pt, d: Pt, half = 5, gap = 2.4): Prim[] {
  const n: Pt = [-d[1], d[0]]
  const plate = (o: number): Prim => {
    const c: Pt = [at[0] + d[0] * o, at[1] + d[1] * o]
    return line([c[0] + n[0] * half, c[1] + n[1] * half], [c[0] - n[0] * half, c[1] - n[1] * half])
  }
  return [plate(-gap / 2), plate(gap / 2)]
}

/**
 * Gate valve centred at c (24 × 32 box, as before): a bow-tie body with end
 * flanges, a bonnet on top, the stem, and a spoked handwheel (r = 6).
 */
export function valvePrims(c: Pt): { body: Prim[]; wheel: Prim[] } {
  const [x, y] = c
  return {
    body: [
      poly(
        [
          [x - 10, y - 6],
          [x, y],
          [x - 10, y + 6],
        ],
        true,
      ),
      poly(
        [
          [x + 10, y - 6],
          [x, y],
          [x + 10, y + 6],
        ],
        true,
      ),
      // end flanges
      line([x - 11.5, y - 7.5], [x - 11.5, y + 7.5]),
      line([x + 11.5, y - 7.5], [x + 11.5, y + 7.5]),
      // bonnet and stem
      poly(
        [
          [x - 3, y - 2.2],
          [x + 3, y - 2.2],
          [x + 2.2, y - 8],
          [x - 2.2, y - 8],
        ],
        true,
      ),
      line([x, y - 8], [x, y - 10]),
    ],
    wheel: [
      { t: 'circle', c: R([x, y - 16]), r: 6 },
      line([x - 6, y - 16], [x + 6, y - 16]),
      line([x, y - 22], [x, y - 10]),
      { t: 'circle', c: R([x, y - 16]), r: 1.2 },
    ],
  }
}

/**
 * AI reader: a reading instrument on the line (r = 14 housing) with a lens
 * (r = 7, a glint), four reticle ticks, and the orange 90° ring segment at
 * the top (r = 17).
 */
export function aiPrims(c: Pt): { body: Prim[]; ring: Prim[] } {
  const ticks = [0, 90, 180, 270].map((a) => line(polar(c, 9, a), polar(c, 12, a)))
  return {
    body: [
      { t: 'circle', c, r: 14 },
      { t: 'circle', c, r: 7 },
      { t: 'arc', c, r: 4.6, from: 200, to: 250 },
      ...ticks,
    ],
    ring: [{ t: 'arc', c, r: 17, from: 225, to: 315 }],
  }
}

/**
 * Data store: a 48 × 64 vessel with semicircular heads and head seams, a top
 * nozzle, and a sight glass 6 × 40 at right on two fittings, with its level.
 */
export function tankPrims(c: Pt, level = 1): { body: Prim[]; glass: Prim[]; fill: Prim[] } {
  const [x, y] = c
  const top = y - 32
  const bottom = y + 32
  const shell: Prim = {
    t: 'path',
    d: `M${r2(x - 24)} ${r2(top + 24)}A24 24 0 0 1 ${r2(x + 24)} ${r2(top + 24)}V${r2(bottom - 24)}A24 24 0 0 1 ${r2(x - 24)} ${r2(bottom - 24)}Z`,
    len: 2 * 16 + 2 * Math.PI * 24,
  }
  const gx = x + 12
  const gy = y - 20
  return {
    body: [
      shell,
      // head seams, stopping short of the sight glass
      line([x - 24, top + 24], [x + 10, top + 24]),
      line([x - 24, bottom - 24], [x + 10, bottom - 24]),
      rect(x - 4, top - 2, 8, 2.4),
    ],
    glass: [
      rect(gx, gy, 6, 40),
      line([gx + 3, gy - 3], [gx + 3, gy]),
      line([gx + 3, gy + 40], [gx + 3, gy + 43]),
    ],
    fill: [rect(gx, gy + 40 * (1 - level), 6, 40 * level)],
  }
}

/** Monitor gauge: a bezel (r = 14 and 11.5), five ticks, a needle on a hub. */
export function monitorPrims(c: Pt): Prim[] {
  const [x, y] = c
  const hub: Pt = [x, y + 4]
  const ticks = [200, 235, 270, 305, 340].map((a) => line(polar(hub, 7, a), polar(hub, 9, a)))
  return [
    { t: 'circle', c, r: 14 },
    { t: 'circle', c, r: 11.5 },
    ...ticks,
    line(hub, polar(hub, 7.5, 305)),
    { t: 'circle', c: hub, r: 1.2 },
  ]
}

/** Tolerance gauge: semicircle dial r = 16 in a bezel (r = 18), 7 ticks, IN RANGE band, needle 14. */
export function tolerancePrims(
  c: Pt,
  needleDeg = 280,
): { dial: Prim[]; band: Prim[]; needle: Prim[] } {
  const [x, y] = c
  const ticks: Prim[] = Array.from({ length: 7 }, (_, i) => {
    const a = ((180 + i * 30) * Math.PI) / 180
    return {
      t: 'line',
      a: [x + Math.cos(a) * 13, y + Math.sin(a) * 13],
      b: [x + Math.cos(a) * 16, y + Math.sin(a) * 16],
    }
  })
  const n = (needleDeg * Math.PI) / 180
  return {
    dial: [
      { t: 'arc', c, r: 18, from: 180, to: 360 },
      { t: 'arc', c, r: 16, from: 180, to: 360 },
      { t: 'line', a: [x - 18, y], b: [x + 18, y] },
      ...ticks,
      { t: 'circle', c, r: 1.4 },
    ],
    band: [{ t: 'arc', c, r: 11, from: 250, to: 300 }],
    needle: [{ t: 'line', a: c, b: [x + Math.cos(n) * 14, y + Math.sin(n) * 14] }],
  }
}

/** Packet: a capsule drawn as a 5-unit dash with round caps and stroke 5 (orange, deep panels only). */
export const packetPrim = (c: Pt): Prim => ({
  t: 'line',
  a: [c[0] - 2.5, c[1]],
  b: [c[0] + 2.5, c[1]],
})

/** Flow chevron (6 u) at c pointing along unit direction d. */
export function chevron(c: Pt, d: Pt, size = 6): Prim {
  const back: Pt = [c[0] - d[0] * size * 0.5, c[1] - d[1] * size * 0.5]
  const n: Pt = [-d[1], d[0]]
  return {
    t: 'poly',
    pts: [
      [back[0] + n[0] * size * 0.5, back[1] + n[1] * size * 0.5],
      [c[0] + d[0] * size * 0.5, c[1] + d[1] * size * 0.5],
      [back[0] - n[0] * size * 0.5, back[1] - n[1] * size * 0.5],
    ],
  }
}

// ── Tool glyphs ─────────────────────────────────────────────────────────────

export type { ToolKind }

export const TOOL_KINDS: readonly ToolKind[] = [
  'inbox',
  'sheet',
  'phone',
  'ledger',
  'chart',
  'cards',
  'gantt',
  'folder',
  'timesheet',
  'payroll',
]

/** Keywords in a node id or label key → the tool kind they name (first match wins). */
const KIND_WORDS: readonly [RegExp, ToolKind][] = [
  [/inbox|e-?mail|mail/i, 'inbox'],
  [/estimate|xlsx|spreadsheet|sheet\b/i, 'sheet'],
  [/timesheet/i, 'timesheet'],
  [/payroll|pay\b/i, 'payroll'],
  [/field|phone|mobile/i, 'phone'],
  [/accounting|ledger|books|^acct/i, 'ledger'],
  [/report|jobcost|job-cost|dashboard/i, 'chart'],
  [/crm|contacts|clients/i, 'cards'],
  [/\bpm\b|^pm$|project|schedule/i, 'gantt'],
  [/drive|folder|files|shared/i, 'folder'],
]

/** The tool kind a node id or label key suggests, or 'plain'. */
export function toolKindOf(...keys: readonly (string | undefined)[]): ToolKind {
  for (const k of keys) {
    if (!k) continue
    const last = k.split('.').pop()!
    for (const [re, kind] of KIND_WORDS) if (re.test(last) || re.test(k)) return kind
  }
  return 'plain'
}

/** Where a glyph sits in its box: 'right' (beside a left-aligned label), 'center', or 'corner'. */
export type GlyphPlace = 'right' | 'center' | 'corner'

/** The glyph's square (side g, top-left x, y) inside a tool box. */
export function glyphBox(
  r: Rect,
  place: GlyphPlace = 'right',
): { x: number; y: number; g: number } {
  const g = Math.min(r.h * (place === 'center' ? 0.56 : 0.46), r.w * 0.3, 36)
  const inset = Math.max(4, r.h * 0.14)
  if (place === 'center') return { x: r.x + (r.w - g) / 2, y: r.y + (r.h - g) / 2, g }
  if (place === 'corner') return { x: r.x + r.w - g - inset, y: r.y + r.h - g - inset, g }
  return { x: r.x + r.w - g - inset * 1.2, y: r.y + (r.h - g) / 2, g }
}

/**
 * A tool's identifying glyph, in a g × g square at (x, y): the outline prims
 * (detail pen) and the fine rules (hatch pen). Never solid: bars and tiles
 * are drawn as outlines with rules, so they read as a drawn mini-chart.
 */
export function toolGlyph(
  kind: ToolKind,
  at: { x: number; y: number; g: number },
): { outline: Prim[]; rules: Prim[] } {
  const { x, y, g } = at
  const u = g / 12
  const X = (v: number) => x + v * u
  const Y = (v: number) => y + v * u
  switch (kind) {
    case 'plain':
      return { outline: [], rules: [] }
    case 'inbox':
      return {
        outline: [
          rect(X(0.5), Y(2.5), 11 * u, 7.5 * u),
          poly([
            [X(0.5), Y(2.5)],
            [X(6), Y(6.8)],
            [X(11.5), Y(2.5)],
          ]),
        ],
        rules: [line([X(0.5), Y(10)], [X(4.6), Y(5.7)]), line([X(11.5), Y(10)], [X(7.4), Y(5.7)])],
      }
    case 'sheet':
      return {
        outline: [rect(X(0.5), Y(1), 11 * u, 10 * u)],
        rules: [
          line([X(0.5), Y(3.5)], [X(11.5), Y(3.5)]),
          line([X(0.5), Y(6)], [X(11.5), Y(6)]),
          line([X(0.5), Y(8.5)], [X(11.5), Y(8.5)]),
          line([X(3.5), Y(1)], [X(3.5), Y(11)]),
          line([X(7.5), Y(1)], [X(7.5), Y(11)]),
        ],
      }
    case 'phone':
      return {
        outline: [
          {
            t: 'poly',
            pts: (
              [
                [X(3), Y(0.5)],
                [X(9), Y(0.5)],
                [X(9), Y(11.5)],
                [X(3), Y(11.5)],
              ] as Pt[]
            ).map(R),
            closed: true,
            r: r2(1.2 * u),
          },
          rect(X(4), Y(2), 4 * u, 7 * u),
        ],
        rules: [line([X(5.2), Y(10.3)], [X(6.8), Y(10.3)])],
      }
    case 'ledger':
      return {
        outline: [rect(X(1), Y(0.5), 10 * u, 11 * u), line([X(2.6), Y(0.5)], [X(2.6), Y(11.5)])],
        rules: [
          line([X(4), Y(3.5)], [X(10), Y(3.5)]),
          line([X(4), Y(5.8)], [X(10), Y(5.8)]),
          line([X(4), Y(8.1)], [X(10), Y(8.1)]),
          line([X(7.6), Y(2.2)], [X(7.6), Y(9.6)]),
        ],
      }
    case 'chart':
      return {
        outline: [
          poly(
            [
              [X(1), Y(0.5)],
              [X(8.6), Y(0.5)],
              [X(11), Y(2.9)],
              [X(11), Y(11.5)],
              [X(1), Y(11.5)],
            ],
            true,
          ),
          rect(X(3), Y(6.5), 1.6 * u, 3.5 * u),
          rect(X(5.4), Y(4.2), 1.6 * u, 5.8 * u),
          rect(X(7.8), Y(5.4), 1.6 * u, 4.6 * u),
        ],
        rules: [line([X(2.4), Y(10)], [X(9.8), Y(10)])],
      }
    case 'cards':
      return {
        outline: [
          poly([
            [X(2.5), Y(3)],
            [X(2.5), Y(1)],
            [X(11.5), Y(1)],
            [X(11.5), Y(8)],
            [X(10), Y(8)],
          ]),
          rect(X(0.5), Y(3), 10 * u, 8.5 * u),
          rect(X(1.8), Y(4.4), 2.6 * u, 2.6 * u),
        ],
        rules: [
          line([X(5.4), Y(5)], [X(9.2), Y(5)]),
          line([X(5.4), Y(6.6)], [X(8.4), Y(6.6)]),
          line([X(1.8), Y(9)], [X(9.2), Y(9)]),
        ],
      }
    case 'gantt':
      return {
        outline: [
          rect(X(0.5), Y(1), 11 * u, 10 * u),
          rect(X(1.6), Y(3), 4.2 * u, 1.6 * u),
          rect(X(4.4), Y(5.4), 4.6 * u, 1.6 * u),
          rect(X(7.2), Y(7.8), 3.4 * u, 1.6 * u),
        ],
        rules: [line([X(6.6), Y(2)], [X(6.6), Y(10)])],
      }
    case 'folder':
      return {
        outline: [
          poly(
            [
              [X(0.5), Y(2)],
              [X(4.4), Y(2)],
              [X(5.6), Y(3.4)],
              [X(11.5), Y(3.4)],
              [X(11.5), Y(10.5)],
              [X(0.5), Y(10.5)],
            ],
            true,
          ),
        ],
        rules: [line([X(0.5), Y(5)], [X(11.5), Y(5)])],
      }
    case 'timesheet':
      return {
        outline: [{ t: 'circle', c: R([X(6), Y(6)]), r: r2(5.4 * u) }],
        rules: [
          line([X(6), Y(6)], [X(6), Y(2.6)]),
          line([X(6), Y(6)], [X(8.6), Y(7.4)]),
          ...[0, 90, 180, 270].map((a) =>
            line(polar([X(6), Y(6)], 4.4 * u, a), polar([X(6), Y(6)], 5.4 * u, a)),
          ),
        ],
      }
    case 'payroll':
      return {
        outline: [
          rect(X(0.5), Y(2.5), 11 * u, 7 * u),
          { t: 'circle', c: R([X(6), Y(6)]), r: r2(2 * u) },
        ],
        rules: [
          rect(X(1.5), Y(3.5), 9 * u, 5 * u),
          line([X(2.6), Y(6)], [X(3.4), Y(6)]),
          line([X(8.6), Y(6)], [X(9.4), Y(6)]),
        ],
      }
  }
}

/** A tool's enclosure plus glyph, for drawings that are not graphs. */
export function toolPrims(
  r: Rect,
  kind: ToolKind = 'plain',
  place: GlyphPlace = 'right',
): { box: Prim[]; outline: Prim[]; rules: Prim[] } {
  return { box: [rect(r.x, r.y, r.w, r.h)], ...toolGlyph(kind, glyphBox(r, place)) }
}

const toolDef = (kind: ToolKind): readonly Part[] => {
  const g = toolPrims({ x: 0, y: 0, w: 180, h: 64 }, kind)
  return [
    P('box', g.box, { fill: 'paper' }),
    ...(g.outline.length ? [P('glyph', g.outline, { pen: '035' })] : []),
    ...(g.rules.length ? [P('rules', g.rules, { pen: '018' })] : []),
  ]
}

/** The tool box with a glyph, as symbol parts (180 × 64, like sym.tool). */
export const toolParts = (kind: ToolKind): readonly Part[] => toolDef(kind)

export const SYMBOLS: Readonly<Partial<Record<SymbolId, SymbolDef>>> = {
  'sym.tool': def('sym.tool', [0, 0, 180, 64], toolDef('plain')),
  'sym.conduit': def(
    'sym.conduit',
    [0, 0, 96, 48],
    [
      P(
        'run',
        [
          {
            t: 'poly',
            pts: [
              [0, 8],
              [48, 8],
              [48, 40],
              [96, 40],
            ],
            r: 12,
          },
        ],
        { pen: '070' },
      ),
      P('flanges', [...flangePrims([8, 8], [1, 0]), ...flangePrims([88, 40], [1, 0])], {
        pen: '035',
      }),
    ],
  ),
  'sym.flange': def(
    'sym.flange',
    [-12, -8, 24, 16],
    [
      P('run', [line([-12, 0], [12, 0])], { pen: '070' }),
      P('flange', flangePrims([0, 0], [1, 0], 6, 3), { pen: '050' }),
    ],
  ),
  'sym.hand-carry': def(
    'sym.hand-carry',
    [0, 0, 96, 24],
    [
      P('line', [{ t: 'line', a: [0, 12], b: [96, 12] }, arrowhead([0, 12], [96, 12])], {
        layer: 'pencil',
        ink: 'pencil',
        pen: '035',
      }),
      P('paper', paperGlyph([48, 12]), {
        layer: 'pencil',
        ink: 'pencil',
        pen: '035',
        fill: 'paper',
      }),
    ],
  ),
  'sym.packet': def(
    'sym.packet',
    [0, 0, 10, 10],
    [P('pkt', [packetPrim([5, 5])], { layer: 'pkt', ink: 'orange', pen: '100' })],
  ),
  'sym.ai-bubble': def(
    'sym.ai-bubble',
    [-20, -20, 40, 40],
    [
      P('ai', aiPrims([0, 0]).body, { fill: 'paper' }),
      P('ring', aiPrims([0, 0]).ring, { ink: 'orange', pen: '070' }),
    ],
  ),
  'sym.hv-valve': def(
    'sym.hv-valve',
    [-12, -24, 24, 32],
    [
      P('body', valvePrims([0, 0]).body, { fill: 'paper' }),
      P('wheel', valvePrims([0, 0]).wheel, { ink: 'orange' }),
    ],
  ),
  'sym.tolerance': def(
    'sym.tolerance',
    [-18, -18, 36, 20],
    [
      P('dial', tolerancePrims([0, 0]).dial),
      P('band', tolerancePrims([0, 0]).band, { ink: 'cyan-dim', pen: '100' }),
      P('needle', tolerancePrims([0, 0]).needle, { ink: 'orange' }),
    ],
  ),
  'sym.data-tank': def(
    'sym.data-tank',
    [-26, -34, 52, 68],
    [
      P('vessel', tankPrims([0, 0]).body, { fill: 'paper' }),
      P('glass', tankPrims([0, 0]).glass, { pen: '035' }),
      P('level', tankPrims([0, 0], 0.6).fill, { pen: '018', fill: 'cyan' }),
    ],
  ),
  'sym.monitor': def(
    'sym.monitor',
    [-16, -16, 32, 32],
    [P('monitor', monitorPrims([0, 0]), { fill: 'paper' })],
  ),
  'mark.revision-cloud': def(
    'mark.revision-cloud',
    [-8, -8, 136, 96],
    [
      P('cloud', [cloudPrim({ x: 0, y: 0, w: 120, h: 80 }, { seed: 7 })], {
        ink: 'redline',
        layer: 'pencil',
      }),
      P('delta', [deltaTag([0, 0])], { ink: 'redline', layer: 'pencil', fill: 'paper' }),
    ],
  ),
  'mark.hold-cloud': def(
    'mark.hold-cloud',
    [-8, -8, 136, 96],
    [
      P('cloud', [cloudPrim({ x: 0, y: 0, w: 120, h: 80 }, { seed: 11 })], {
        ink: 'hold',
        layer: 'pencil',
        dash: 'hidden',
      }),
    ],
  ),
  'mark.delta-tag': def(
    'mark.delta-tag',
    [-9, -9, 18, 18],
    [P('delta', [deltaTag([0, 0])], { ink: 'redline' })],
  ),
  'mark.detail-bubble': def(
    'mark.detail-bubble',
    [-17, -17, 34, 34],
    [
      P('bubble', [
        { t: 'circle', c: [0, 0], r: 16 },
        { t: 'line', a: [-16, 0], b: [16, 0] },
      ]),
    ],
  ),
  'obj.hard-hat': def(
    'obj.hard-hat',
    [-6, -5, 12, 6],
    [
      P(
        'hat',
        [
          { t: 'arc', c: [0, 0], r: 4.4, from: 180, to: 360 },
          { t: 'line', a: [-5.5, 0], b: [5.5, 0] },
        ],
        { layer: 'pencil', ink: 'pencil', pen: '035' },
      ),
    ],
  ),
}
