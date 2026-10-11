import type { Part, Prim, Pt, SymbolDef, SymbolId } from '../types'
import { cloudPrim, deltaTag } from './clouds'

/**
 * The symbol library (pages-drawings §5.1). Geometry only, in local units with
 * an anchor 'c' (the placement point). Every symbol has a clean variant (CAD
 * paths) and a pencil variant (the same primitives through roughjs); the
 * renderer picks. Labels are never part of a symbol: they are HTML.
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

/** Gate valve: two triangles tip to tip (20 × 12), stem 10, handwheel r = 6. Centre at c. */
export function valvePrims(c: Pt): { body: Prim[]; wheel: Prim[] } {
  const [x, y] = c
  return {
    body: [
      {
        t: 'poly',
        pts: [
          [x - 10, y - 6],
          [x, y],
          [x - 10, y + 6],
        ],
        closed: true,
      },
      {
        t: 'poly',
        pts: [
          [x + 10, y - 6],
          [x, y],
          [x + 10, y + 6],
        ],
        closed: true,
      },
      { t: 'line', a: [x, y], b: [x, y - 10] },
    ],
    wheel: [
      { t: 'circle', c: [x, y - 16], r: 6 },
      { t: 'line', a: [x - 6, y - 16], b: [x + 6, y - 16] },
    ],
  }
}

/** AI reader: circle r = 14 on the line, with a 90° orange ring segment at the top. */
export function aiPrims(c: Pt): { body: Prim[]; ring: Prim[] } {
  return {
    body: [{ t: 'circle', c, r: 14 }],
    ring: [{ t: 'arc', c, r: 17, from: 225, to: 315 }],
  }
}

/** Data store: a 48 × 64 vessel with semicircular heads, a sight glass 6 × 40 at right. */
export function tankPrims(c: Pt, level = 1): { body: Prim[]; glass: Prim[]; fill: Prim[] } {
  const [x, y] = c
  const top = y - 32
  const bottom = y + 32
  const body: Prim = {
    t: 'path',
    d: `M${x - 24} ${top + 24}A24 24 0 0 1 ${x + 24} ${top + 24}V${bottom - 24}A24 24 0 0 1 ${x - 24} ${bottom - 24}Z`,
    len: 2 * 16 + 2 * Math.PI * 24,
  }
  const gx = x + 12
  const gy = y - 20
  return {
    body: [body],
    glass: [{ t: 'rect', at: [gx, gy], size: [6, 40] }],
    fill: [{ t: 'rect', at: [gx, gy + 40 * (1 - level)], size: [6, 40 * level] }],
  }
}

/** Monitor: circle r = 14 holding a dial glyph (arc plus needle). */
export function monitorPrims(c: Pt): Prim[] {
  const [x, y] = c
  return [
    { t: 'circle', c, r: 14 },
    { t: 'arc', c: [x, y + 4], r: 8, from: 200, to: 340 },
    { t: 'line', a: [x, y + 4], b: [x + 5, y - 3] },
  ]
}

/** Tolerance gauge: semicircle dial r = 16, 7 ticks, IN RANGE band, needle 14. */
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
      { t: 'arc', c, r: 16, from: 180, to: 360 },
      { t: 'line', a: [x - 16, y], b: [x + 16, y] },
      ...ticks,
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

export const SYMBOLS: Readonly<Partial<Record<SymbolId, SymbolDef>>> = {
  'sym.tool': def(
    'sym.tool',
    [0, 0, 180, 64],
    [P('box', [{ t: 'rect', at: [0, 0], size: [180, 64] }], { fill: 'paper' })],
  ),
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
