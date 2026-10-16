import type { ModelPart, ModelSpec, Pt } from '@/drawings/types'

/** A part's plan centre: a rect's, a circle's, or (the valve) its bow-tie's shared tip. */
export function centre(p: ModelPart): Pt {
  const q = p.prims[0]!
  return q.t === 'rect'
    ? [q.at[0] + q.size[0] / 2, q.at[1] + q.size[1] / 2]
    : q.t === 'circle'
      ? q.c
      : q.t === 'poly'
        ? q.pts[1]!
        : [0, 0]
}

/**
 * Hero-only detail on each tool enclosure (W4 finish standard B1): an identifying glyph at the
 * left of the box (envelope, sheet grid, phone, ledger, chart sheet, card file, Gantt bars), a
 * divider between the glyph and the name plate, and four corner screws. Plan coordinates, drawn
 * identically by the CAD SVG (doc.server.ts), the 3D plan decal and top faces (scenes/hero.ts)
 * and the iso print, so the hand-off stays seamless. Isomorphic and tiny; it lives in the kit
 * (the runtime group), so scene chunks stay small. Not part of the ModelSpec (S-06 builds on it).
 */

/** Decor lines as Line2 segment positions (6 numbers a segment) at height y. */
export function segs(ls: readonly DecorLine[], y: number): number[] {
  const out: number[] = []
  for (const l of ls) {
    const P = l.closed ? [...l.pts, l.pts[0]!] : l.pts
    for (let i = 1; i < P.length; i++)
      out.push(P[i - 1]![0], y, P[i - 1]![1], P[i]![0], y, P[i]![1])
  }
  return out
}

/**
 * A valve's bonnet stem and handwheel in world space (x, y up, z): the stem from the body top t
 * up by h, a 16-sided wheel of radius R and its two spokes.
 */
export function wheel(cx: number, cz: number, t: number, h: number, R: number): number[] {
  const y = t + h
  const out = [cx, t, cz, cx, y, cz, cx - R, y, cz, cx + R, y, cz, cx, y, cz - R, cx, y, cz + R]
  for (let j = 0; j < 16; j++) {
    const a = (j * Math.PI) / 8
    const b = a + Math.PI / 8
    out.push(
      cx + R * Math.cos(a),
      y,
      cz + R * Math.sin(a),
      cx + R * Math.cos(b),
      y,
      cz + R * Math.sin(b),
    )
  }
  return out
}

export interface DecorLine {
  pts: readonly Pt[]
  closed: boolean
}

/** Glyphs on a 24 × 24 artboard: [closed, x0, y0, x1, y1, …] per line. */
const G: Readonly<Record<string, readonly (readonly number[])[]>> = {
  // envelope: the body and its flap
  inbox: [
    [1, 0, 4, 24, 4, 24, 20, 0, 20],
    [0, 0, 4, 12, 13, 24, 4],
  ],
  // spreadsheet: a sheet ruled into a grid
  estimate: [
    [1, 2, 0, 22, 0, 22, 24, 2, 24],
    [0, 2, 6, 22, 6],
    [0, 2, 12, 22, 12],
    [0, 2, 18, 22, 18],
    [0, 9, 0, 9, 24],
  ],
  // phone: body, earpiece and button
  field: [
    [1, 6, 0, 18, 0, 18, 24, 6, 24],
    [0, 10, 3, 14, 3],
    [0, 6, 19, 18, 19],
    [0, 6, 4, 18, 4],
  ],
  // ledger: a bound book with ruled lines
  accounting: [
    [1, 2, 0, 22, 0, 22, 24, 2, 24],
    [0, 6, 0, 6, 24],
    [0, 10, 7, 19, 7],
    [0, 10, 12, 19, 12],
    [0, 10, 17, 19, 17],
  ],
  // chart sheet: a page with a rising line
  report: [
    [1, 3, 0, 16, 0, 21, 5, 21, 24, 3, 24],
    [0, 16, 0, 16, 5, 21, 5],
    [0, 6, 20, 10, 14, 13, 16, 18, 9],
  ],
  // card file: two index cards, the front one with its tab
  crm: [
    [0, 3, 8, 3, 3, 24, 3, 24, 16],
    [1, 0, 8, 6, 8, 8, 5, 13, 5, 15, 8, 21, 8, 21, 22, 0, 22],
    [0, 4, 13, 17, 13],
    [0, 4, 17, 13, 17],
  ],
  // Gantt: a frame and three staggered bars
  pm: [
    [1, 0, 1, 24, 1, 24, 23, 0, 23],
    [1, 3, 5, 12, 5, 12, 9, 3, 9],
    [1, 8, 10, 18, 10, 18, 14, 8, 14],
    [1, 14, 15, 22, 15, 22, 19, 14, 19],
  ],
}

const r = (n: number) => Math.round(n * 2) / 2

/** Where a tool's glyph zone ends and its name plate starts, as a fraction of box height. */
export const PLATE_AT = 0.7

/** The decor of one tool box: [x, y, w, h] in plan units. */
export function decor(id: string, box: readonly [number, number, number, number]): DecorLine[] {
  const [x, y, w, h] = box
  const s = h * 0.46
  const gx = x + h * 0.35 - s / 2
  const gy = y + h / 2 - s / 2
  const k = s / 24
  const out: DecorLine[] = (G[id] ?? []).map(([c, ...q]) => ({
    closed: c === 1,
    pts: Array.from(
      { length: q.length / 2 },
      (_, i) => [r(gx + q[2 * i]! * k), r(gy + q[2 * i + 1]! * k)] as Pt,
    ),
  }))
  const d = r(x + h * PLATE_AT)
  out.push({
    closed: false,
    pts: [
      [d, r(y + h * 0.2)],
      [d, r(y + h * 0.8)],
    ],
  })
  // four screw heads (small squares: at 1.25 px pens they read as dots), inset from the corners
  const i = r(h * 0.11)
  const s2 = 1.5
  for (const [cx, cy] of [
    [x + i, y + i],
    [x + w - i, y + i],
    [x + w - i, y + h - i],
    [x + i, y + h - i],
  ] as const)
    out.push({
      closed: true,
      pts: [
        [cx - s2, cy - s2],
        [cx + s2, cy - s2],
        [cx + s2, cy + s2],
        [cx - s2, cy + s2],
      ],
    })
  return out
}

const ring = (c: Pt, rr: number, n: number): Pt[] =>
  Array.from({ length: n }, (_, j) => [
    r(c[0] + rr * Math.cos((2 * j * Math.PI) / n)),
    r(c[1] + rr * Math.sin((2 * j * Math.PI) / n)),
  ])

/** Sight glass beside the tank: [x, y, w, h] in plan units, per family (clear of every route). */
export function sightGlass(c: Pt, rr: number, wide: boolean): [number, number, number, number] {
  return wide ? [r(c[0] - rr - 18), r(c[1] - 32), 12, 64] : [r(c[0] + rr + 6), r(c[1] + 6), 9, 36]
}

/**
 * The instruments' detail (B1): the AI reader's lens and glint, the valve's bonnet, stem and
 * handwheel (above the body), and the tank's sight glass with its two stubs.
 */
export function instrumentDecor(
  ai: { c: Pt; r: number },
  valve: { c: Pt; h: number },
  tank: { c: Pt; r: number },
  wide: boolean,
): DecorLine[] {
  const out: DecorLine[] = []
  const [ax, ay] = ai.c
  out.push({ closed: true, pts: ring(ai.c, ai.r * 0.55, 12) })
  out.push({
    closed: false,
    pts: [200, 225, 250].map((a) => {
      const t = (a * Math.PI) / 180
      return [r(ax + ai.r * 0.78 * Math.cos(t)), r(ay + ai.r * 0.78 * Math.sin(t))] as Pt
    }),
  })
  const [vx, vy] = valve.c
  const u = valve.h / 18
  const top = vy - valve.h / 2
  out.push({
    closed: true,
    pts: [
      [r(vx - 4 * u), r(top)],
      [r(vx - 4 * u), r(top - 6 * u)],
      [r(vx + 4 * u), r(top - 6 * u)],
      [r(vx + 4 * u), r(top)],
    ],
  })
  out.push({
    closed: false,
    pts: [
      [r(vx), r(top - 6 * u)],
      [r(vx), r(top - 15 * u)],
    ],
  })
  out.push({ closed: true, pts: ring([vx, top - 20 * u], 6 * u, 12) })
  out.push({
    closed: false,
    pts: [
      [r(vx - 6 * u), r(top - 20 * u)],
      [r(vx + 6 * u), r(top - 20 * u)],
    ],
  })
  const [gx, gy, gw, gh] = sightGlass(tank.c, tank.r, wide)
  out.push({
    closed: true,
    pts: [
      [gx, gy],
      [gx + gw, gy],
      [gx + gw, gy + gh],
      [gx, gy + gh],
    ],
  })
  const [tx, ty] = tank.c
  for (const sy of wide ? [gy + 8, gy + gh - 8] : [gy + gh / 2]) {
    const dx = Math.sqrt(Math.max(0, tank.r * tank.r - (sy - ty) * (sy - ty)))
    const near = wide ? gx + gw : gx
    out.push({
      closed: false,
      pts: [
        [near, sy],
        [r(wide ? tx - dx : tx + dx), sy],
      ],
    })
  }
  return out
}

/** Every decor line of the hero model: per tool box (keyed by part id), and the instruments. */
export function modelDecor(spec: ModelSpec): {
  tools: Record<string, DecorLine[]>
  instruments: DecorLine[]
} {
  const tools: Record<string, DecorLine[]> = {}
  let ai = { c: [0, 0] as Pt, r: 1 }
  let tank = ai
  let valve = { c: [0, 0] as Pt, h: 18 }
  for (const p of spec.parts) {
    const q = p.prims[0]
    if (p.kind === 'box' && q?.t === 'rect')
      tools[p.id] = decor(p.id, [q.at[0], q.at[1], q.size[0], q.size[1]])
    else if (p.id === 'ai' && q?.t === 'circle') ai = { c: q.c, r: q.r }
    else if (p.kind === 'tank' && q?.t === 'circle') tank = { c: q.c, r: q.r }
    else if (p.kind === 'valve' && q?.t === 'poly')
      valve = { c: q.pts[1]!, h: q.pts[2]![1] - q.pts[0]![1] }
  }
  return { tools, instruments: instrumentDecor(ai, valve, tank, spec.layout === 'wide') }
}

/** The name plate's centre and width (plan units): the label sits here. */
export function plate(box: readonly [number, number, number, number]): { c: Pt; w: number } {
  const [x, y, w, h] = box
  const a = x + h * PLATE_AT
  return { c: [(a + x + w) / 2, y + h / 2], w: x + w - a }
}

/**
 * A plan line on a 2D context (the plan decal), as lib/geometry's polyD draws it: fillets of
 * radius r clamped to half a leg.
 */
export function trace(
  g: CanvasRenderingContext2D,
  l: { pts: readonly Pt[]; closed: boolean; r?: number },
): void {
  const P = l.pts
  g.moveTo(P[0]![0], P[0]![1])
  for (let i = 1; i < P.length; i++) {
    const b = P[i]!
    const c = P[i + 1]
    if (l.r && c) {
      const a = P[i - 1]!
      const rr = Math.min(
        l.r,
        Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
        Math.hypot(c[0] - b[0], c[1] - b[1]) / 2,
      )
      g.arcTo(b[0], b[1], c[0], c[1], rr)
    } else g.lineTo(b[0], b[1])
  }
  if (l.closed) g.closePath()
}
