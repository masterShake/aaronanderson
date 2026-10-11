import type { Frame, FrameFill, FrameLine } from '@/drawings/lib/frame'
import type { LayoutId, ModelSpec, Pen, Pt, ViewBox } from '@/drawings/types'

/**
 * S-03 section A–A: the one description of the reading machine that both
 * renderers draw. The SVG (src/figures/s03/drawing.server.ts) renders
 * `{ ...frontFrame(S03_SPEC), lines: [...lines, ...extras] }` through frameNodes();
 * the scene (src/scenes/s03.ts) draws sectionFrame() as Line2 at the front
 * pose. sectionFrame() is frontFrame() for the rectangular parts plus the
 * section details frontFrame cannot draw (cut walls with hatch, hopper, rollers,
 * dial, needle, gate, chute, person), so the hand-off frame is identical in both.
 * A unit test checks that the rect parts match frontFrame() exactly.
 *
 * Geometry is authored once in design units (800 × 600, floor at y 520) and
 * placed per family by a uniform scale and offset. Isomorphic and small: type
 * imports only, so the scene chunk stays light. No strings.
 */

export const S03_DESIGN = { w: 800, h: 600, floor: 520, depth: 200 } as const

export interface S03Family {
  vb: ViewBox
  /** Design unit → viewBox unit. */
  s: number
  tx: number
  ty: number
}

export const S03_FAMILY: Readonly<Record<LayoutId, S03Family>> = {
  wide: { vb: [0, 0, 960, 720], s: 1.2, tx: 0, ty: 0 },
  tall: { vb: [0, 0, 400, 500], s: 0.5, tx: -30, ty: 120 },
}

/** A design point in a family's viewBox units. */
export const place = (f: LayoutId, [x, y]: Pt): Pt => {
  const F = S03_FAMILY[f]
  return [r2(x * F.s + F.tx), r2(y * F.s + F.ty)]
}
const r2 = (n: number) => Math.round(n * 100) / 100

type Rect = readonly [x: number, y: number, w: number, h: number]

/** Design geometry. Body walls are 16 thick with three openings: throat, outfeed and chute. */
export const G = {
  body: { x0: 180, y0: 200, x1: 520, y1: 440, t: 16 },
  throat: [218, 282] as const,
  outfeed: [284, 316] as const,
  chute: [452, 500] as const,
  /** Documents ride on this line (their underside). */
  pathY: 300,
  rollers: [
    [250, 315],
    [300, 315],
  ] as readonly Pt[],
  rollerR: 14,
  head: [336, 252, 84, 26] as Rect,
  lens: [352, 278, 52, 4] as Rect,
  dial: { c: [440, 150] as Pt, r: 28 },
  /** The flap turns `deg` (clockwise in the SVG) to divert a document down the chute. */
  gate: { pivot: [452, 300] as Pt, len: 48, deg: 18 },
  lamp: { c: [488, 200] as Pt, r: 10 },
  hopper: [
    [150, 110],
    [310, 110],
    [282, 200],
    [218, 200],
  ] as readonly Pt[],
  /** Output tray: data cards stack on it. */
  tray: [520, 312, 160, 6] as Rect,
  desk: [540, 480, 108, 6] as Rect,
  /** The sign-off tray on the desk. */
  signTray: [548, 470, 60, 10] as Rect,
  legs: [
    [196, 440, 10, 80],
    [404, 440, 10, 80],
    [546, 486, 6, 34],
    [636, 486, 6, 34],
  ] as readonly Rect[],
  person: { feet: [694, 520] as Pt, k: 1.45 },
  /** Document sheets: 48 × 4, starting under the throat. */
  doc: [226, 296, 48, 4] as Rect,
  /** Where a held document comes to rest on the sign-off tray, relative to `doc`. */
  heldAt: [328, 178] as Pt,
  /** Data cards on the tray, bottom first. */
  card: [588, 303, 56, 8] as Rect,
} as const

/** How far a document (from `doc`) and a card (into `card`) travel, design units. */
export const TRAVEL = {
  /** In the hopper, above the feed line. */
  drop: G.hopper[2]![1] - 4 - G.doc[1],
  /** Under the read head. */
  read: G.head[0] + G.head[2] / 2 - (G.doc[0] + G.doc[2] / 2),
  /** On the sorting gate. */
  gate: G.gate.pivot[0] - G.doc[0],
  /** Through the outfeed. */
  out: G.body.x1 + 6 - G.doc[0],
  heldX: G.heldAt[0],
  heldY: G.heldAt[1],
  /** A card slides in from the outfeed. */
  card: -60,
  /** The stamp drops onto the held document. */
  stamp: -12,
} as const

/** Rect parts: frontFrame() draws exactly these (x extent; z from the floor of the viewBox). */
const RECT_PARTS: readonly { id: string; rect: Rect; anchor?: string }[] = [
  { id: 'head', rect: G.head, anchor: 'reader' },
  { id: 'tray', rect: G.tray, anchor: 'output' },
  { id: 'desk', rect: G.desk },
  { id: 'sign-tray', rect: G.signTray, anchor: 'tray' },
  ...G.legs.map((rect, i) => ({ id: `leg.${i}`, rect })),
]

/** The ModelSpec of the rect parts for one family (frontFrame input). */
export function s03Spec(f: LayoutId): ModelSpec {
  const F = S03_FAMILY[f]
  const base = F.vb[1] + F.vb[3]
  return {
    id: 's03',
    layout: f,
    viewBox: F.vb,
    start: 'front',
    parts: RECT_PARTS.map(({ id, rect, anchor }) => {
      const [x, y] = place(f, [rect[0], rect[1]])
      const [x2, y2] = place(f, [rect[0] + rect[2], rect[1] + rect[3]])
      return {
        id,
        kind: 'box' as const,
        prims: [{ t: 'rect' as const, at: [x, 0] as Pt, size: [r2(x2 - x), 10] as const }],
        z: r2(base - y2),
        depth: r2(y2 - y),
        material: 'aluminum' as const,
        ...(anchor ? { anchor } : {}),
      }
    }),
  }
}

/** frontFrame() for the rect parts, without importing it (keeps the scene chunk small). */
function rectFrame(f: LayoutId): Frame {
  const spec = s03Spec(f)
  const base = spec.viewBox[1] + spec.viewBox[3]
  const fills: FrameFill[] = []
  const lines: FrameLine[] = []
  const anchors: Record<string, Pt> = {}
  for (const p of spec.parts) {
    const prim = p.prims[0]!
    if (prim.t !== 'rect') continue
    const x = prim.at[0]
    // as frontFrame's bounds() measures it, so the anchors match to the last bit
    const w = x + prim.size[0] - x
    const z0 = p.z ?? 0
    const top = base - (z0 + p.depth)
    const bottom = base - z0
    const pts: Pt[] = [
      [x, top],
      [x + w, top],
      [x + w, bottom],
      [x, bottom],
    ]
    fills.push({ id: p.id, pts, ink: 'deep', opacity: 1 })
    lines.push({ id: p.id, pts, closed: true, pen: '050', ink: 'cyan', opacity: 1 })
    if (p.anchor) anchors[p.anchor] = [x + w / 2, (top + bottom) / 2]
  }
  return { pose: 'front', viewBox: spec.viewBox, fills, lines, anchors }
}

const rectPts = ([x, y, w, h]: Rect): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]
const circlePts = (c: Pt, r: number, n = 32): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Pt
  })
/** An arc of the dial, degrees clockwise from straight up. */
const arcPts = (c: Pt, r: number, from: number, to: number, n = 12): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n - 90) * Math.PI) / 180
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Pt
  })

/** The three cut-wall pieces (the openings split the ring), clockwise outlines. */
export function wallPieces(): Pt[][] {
  const { x0, y0, x1, y1, t } = G.body
  const [ta, tb] = G.throat
  const [oa, ob] = G.outfeed
  const [ca, cb] = G.chute
  return [
    [
      [ta, y0],
      [x0, y0],
      [x0, y1],
      [ca, y1],
      [ca, y1 - t],
      [x0 + t, y1 - t],
      [x0 + t, y0 + t],
      [ta, y0 + t],
    ],
    [
      [tb, y0],
      [x1, y0],
      [x1, oa],
      [x1 - t, oa],
      [x1 - t, y0 + t],
      [tb, y0 + t],
    ],
    [
      [x1, ob],
      [x1, y1],
      [cb, y1],
      [cb, y1 - t],
      [x1 - t, y1 - t],
      [x1 - t, ob],
    ],
  ]
}

/** 45° hatch (down to the right) clipped to a closed polygon, even-odd. */
export function hatch(poly: readonly Pt[], step: number): [Pt, Pt][] {
  let lo = Infinity
  let hi = -Infinity
  for (const [x, y] of poly) {
    lo = Math.min(lo, x - y)
    hi = Math.max(hi, x - y)
  }
  const out: [Pt, Pt][] = []
  for (let c = Math.ceil(lo / step) * step; c <= hi; c += step) {
    // the line x − y = c, parametrised by y
    const ys: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const fa = a[0] - a[1] - c
      const fb = b[0] - b[1] - c
      if ((fa < 0 && fb >= 0) || (fb < 0 && fa >= 0)) {
        const t = fa / (fa - fb)
        ys.push(a[1] + (b[1] - a[1]) * t)
      }
    }
    ys.sort((p, q) => p - q)
    for (let i = 0; i + 1 < ys.length; i += 2) {
      const y0 = ys[i]!
      const y1 = ys[i + 1]!
      if (y1 - y0 < 1.5) continue
      out.push([
        [c + y0, y0],
        [c + y1, y1],
      ])
    }
  }
  return out
}

/** The seated person at the desk (fig.desk-stamp, mirrored to face the machine), feet at 0,0. */
const PERSON: readonly { c: boolean; p: readonly number[] }[] = [
  { c: true, p: [5, -41.6, -0.7, -32.2, -2.7, -31.7, -3.3, -33.7, 2, -43.4, 4.1, -43.5] },
  { c: true, p: [-2, -31.5, -13, -31.7, -14.2, -33, -13, -34.2, -2, -34.5, -1, -33] },
  { c: true, p: [2.4, -21.5, -13.4, -19.2, -15.7, -20.9, -14.1, -23.2, 1.6, -26.5, 3.6, -24.3] },
  { c: true, p: [-11.8, -21.2, -12.3, -6.2, -13.8, -4.7, -15.3, -6.2, -15.8, -21.2, -13.8, -22.5] },
  { c: true, p: [-12.3, -7.7, -15.3, -7.7, -18.8, -5.2, -12.3, -5.2] },
  { c: true, p: [7, -44, -7, -44, -5, -26, -6, -23, 6, -23, 5, -26] },
  { c: true, p: [-1.9, -21.5, -17.9, -21.4, -20, -23.4, -18.1, -25.4, -2.1, -26.5, -0.3, -24.1] },
  { c: true, p: [-16, -23.4, -16.5, -8.4, -18, -6.9, -19.5, -8.4, -20, -23.4, -18, -24.8] },
  { c: true, p: [-16.5, -9.9, -19.5, -9.9, -23, -7.4, -16.5, -7.4] },
  {
    c: true,
    p: [
      -3.6, -51, -3.2, -49, -2.2, -47.4, -0.8, -46.5, 0.8, -46.5, 2.2, -47.4, 3.2, -49, 3.6, -51,
      3.2, -53, 2.2, -54.6, 0.8, -55.5, -0.8, -55.5, -2.2, -54.6, -3.2, -53,
    ],
  },
  { c: true, p: [-5, -41.6, -10.3, -51.3, -9.7, -53.3, -7.7, -52.8, -2, -43.4, -2.9, -41.5] },
  { c: true, p: [-10.5, -52.3, -8.3, -63.1, -6.9, -64.1, -5.9, -62.6, -7.5, -51.8, -9.2, -51] },
  { c: true, p: [-5.1, -63.9, -9.1, -63.9, -9.1, -60.9, -5.1, -60.9] },
  { c: true, p: [-3.6, -60.9, -10.6, -60.9, -10.6, -59.4, -3.6, -59.4] },
  { c: false, p: [6, -22, -6, -22] },
  { c: false, p: [4, -22, 5, 0] },
  { c: false, p: [-4, -22, -5, 0] },
]

/** The person's outlines in design units. */
export function personPolys(): { pts: Pt[]; closed: boolean }[] {
  const { feet, k } = G.person
  return PERSON.map(({ c, p }) => {
    const pts: Pt[] = []
    for (let i = 0; i < p.length; i += 2) pts.push([feet[0] + p[i]! * k, feet[1] + p[i + 1]! * k])
    return { pts, closed: c }
  })
}

/** Dial bands: in tolerance from −120° to +40°, CHECK from +40° to +120°. */
export const DIAL = { tolFrom: -120, tolTo: 40, checkTo: 120, okDeg: -35, checkDeg: 80 } as const

/** Ids of frame lines the mechanism moves (the scene swaps them for live parts). */
export const MOVING = ['needle', 'gate', 'spoke.0', 'spoke.1'] as const

/** Design-space lines and fills of the section details (everything frontFrame cannot draw). */
function details(): { lines: Omit<FrameLine, 'opacity'>[]; fills: Omit<FrameFill, 'opacity'>[] } {
  const lines: Omit<FrameLine, 'opacity'>[] = []
  const fills: Omit<FrameFill, 'opacity'>[] = []
  const L = (id: string, pts: Pt[], closed: boolean, pen: Pen, ink: FrameLine['ink'] = 'cyan') =>
    lines.push({ id, pts, closed, pen, ink })
  const F = (id: string, pts: Pt[], ink = 'deep') => fills.push({ id, pts, ink })
  const { x0, y1 } = G.body
  // floor and feed line
  L(
    'floor',
    [
      [100, S03_DESIGN.floor],
      [780, S03_DESIGN.floor],
    ],
    false,
    '035',
    'cyan-dim',
  )
  L(
    'path',
    [
      [x0 + G.body.t, G.pathY],
      [G.gate.pivot[0], G.pathY],
    ],
    false,
    '025',
    'cyan-dim',
  )
  // cut walls, hatched
  wallPieces().forEach((w, i) => {
    F(`wall.${i}`, w)
    hatch(w, 10).forEach(([a, b], j) => L(`hatch.${i}.${j}`, [a, b], false, '025', 'cyan-dim'))
    L(`wall.${i}`, w, true, '070')
  })
  // hopper
  F('hopper', [...G.hopper])
  L('hopper', [...G.hopper], true, '050')
  // rollers with a spoke each (the spoke turns while a document feeds)
  G.rollers.forEach((c, i) => {
    F(`roller.${i}`, circlePts(c, G.rollerR))
    L(`roller.${i}`, circlePts(c, G.rollerR), true, '050')
    L(
      `spoke.${i}`,
      [
        [c[0] - G.rollerR + 3, c[1]],
        [c[0] + G.rollerR - 3, c[1]],
      ],
      false,
      '035',
    )
  })
  // read head mount and lens
  const hx = G.head[0] + G.head[2] / 2
  L(
    'head-mount',
    [
      [hx, G.body.y0 + G.body.t],
      [hx, G.head[1]],
    ],
    false,
    '050',
  )
  F('lens', rectPts(G.lens), 'cyan')
  // tolerance dial on its stem
  const { c, r } = G.dial
  L(
    'dial-stem',
    [
      [c[0], c[1] + r],
      [c[0], G.body.y0],
    ],
    false,
    '050',
  )
  F('dial', circlePts(c, r, 40))
  L('dial', circlePts(c, r, 40), true, '050')
  L('band.tol', arcPts(c, r - 7, DIAL.tolFrom, DIAL.tolTo, 16), false, '070', 'cyan-dim')
  L('band.check', arcPts(c, r - 7, DIAL.tolTo, DIAL.checkTo, 8), false, '070', 'redline')
  L('needle', [c, [c[0], c[1] - r + 5]], false, '050', 'paper')
  // sorting gate flap
  const [gx, gy] = G.gate.pivot
  L(
    'gate',
    [
      [gx, gy],
      [gx + G.gate.len, gy],
    ],
    false,
    '070',
  )
  // lamp dome on the top wall
  const lamp: Pt[] = arcPts(G.lamp.c, G.lamp.r, -90, 90, 10)
  F('lamp', lamp)
  L('lamp', lamp, true, '050')
  // chute from the floor opening down to the sign-off tray
  L(
    'chute.0',
    [
      [G.chute[0], y1],
      [G.signTray[0], G.signTray[1] + 2],
    ],
    false,
    '050',
  )
  L(
    'chute.1',
    [
      [G.chute[1], y1],
      [G.signTray[0] + 18, G.signTray[1] - 4],
    ],
    false,
    '035',
    'cyan-dim',
  )
  // tray lip
  L(
    'tray-lip',
    [
      [G.tray[0] + G.tray[2], G.tray[1] - 10],
      [G.tray[0] + G.tray[2], G.tray[1]],
    ],
    false,
    '050',
  )
  // the person
  personPolys().forEach((p, i) => {
    if (p.closed) F(`person.${i}`, p.pts)
    L(`person.${i}`, p.pts, p.closed, '035')
  })
  return { lines, fills }
}

/** The section details placed in a family (the extras added to frontFrame's lines and fills). */
export function sectionExtras(f: LayoutId): { lines: FrameLine[]; fills: FrameFill[] } {
  const d = details()
  const pl = (pts: readonly Pt[]) => pts.map((p) => place(f, p))
  return {
    lines: d.lines.map((l) => ({ ...l, pts: pl(l.pts), opacity: 1 })),
    fills: d.fills.map((x) => ({ ...x, pts: pl(x.pts), opacity: 1 })),
  }
}

/** The whole hand-off frame: frontFrame(s03Spec) plus the section details. */
export function sectionFrame(f: LayoutId): Frame {
  const base = rectFrame(f)
  const x = sectionExtras(f)
  return { ...base, fills: [...x.fills, ...base.fills], lines: [...base.lines, ...x.lines] }
}

/** Model bounds (design units, with depth): the 3D fit and the frustum check. */
export const S03_BOUNDS = { x0: 100, x1: 780, y0: 110, y1: 520 } as const
