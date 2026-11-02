/**
 * Plan symbols as polylines in plan inches. Pure geometry: drawing.ts decides pens and beats.
 */
import type { Rect, Vec2 } from '@/lib/geom/rect'
import type { ResolvedOpening, ResolvedWall } from '@/lib/house/resolve'
import type { Door, Fixture } from '@/lib/house/types'
import type { Inch } from '@/lib/units'

export type Polyline = Vec2[]

/** Closed rectangle outline, counter-clockwise from (x0, y0). */
export const rectLine = (r: Rect): Polyline => [
  [r[0], r[1]],
  [r[2], r[1]],
  [r[2], r[3]],
  [r[0], r[3]],
  [r[0], r[1]],
]

/** Arc around `c` from angle a0 to a1 (radians), at most 3° per segment. */
export function arc(c: Vec2, radius: Inch, a0: number, a1: number): Polyline {
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / ((3 * Math.PI) / 180)))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / steps
    return [c[0] + radius * Math.cos(a), c[1] + radius * Math.sin(a)] as const
  })
}

export const circle = (c: Vec2, radius: Inch): Polyline => arc(c, radius, 0, Math.PI * 2)

export function ellipse(c: Vec2, rx: Inch, ry: Inch, steps = 48): Polyline {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (Math.PI * 2 * i) / steps
    return [c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)] as const
  })
}

/** Rectangle with rounded corners, closed. */
export function roundRect(r: Rect, radius: Inch): Polyline {
  const k = Math.min(radius, (r[2] - r[0]) / 2, (r[3] - r[1]) / 2)
  const pts: Vec2[] = [
    ...arc([r[2] - k, r[1] + k], k, -Math.PI / 2, 0),
    ...arc([r[2] - k, r[3] - k], k, 0, Math.PI / 2),
    ...arc([r[0] + k, r[3] - k], k, Math.PI / 2, Math.PI),
    ...arc([r[0] + k, r[1] + k], k, Math.PI, (Math.PI * 3) / 2),
  ]
  return [...pts, pts[0]]
}

/** Regular hexagon with flat top and bottom, `across` measured corner to corner. */
export function hexagon(c: Vec2, across: Inch): Polyline {
  const rad = across / 2
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)] as const
  })
  return [...pts, pts[0]]
}

/** Map a point from a wall's (s, t) frame to plan (x, y). */
export const wallPoint = (w: ResolvedWall, s: Inch, t: Inch): Vec2 => (w.axis === 'x' ? [s, t] : [t, s])

/** Window: frame lines on both faces across the RO, glass on the centreline. */
export function windowSymbol(w: ResolvedWall, o: ResolvedOpening): { frame: Polyline[]; glass: Polyline[] } {
  const tc = (w.t0 + w.t1) / 2
  return {
    frame: [
      [wallPoint(w, o.s0, w.t0), wallPoint(w, o.s1, w.t0)],
      [wallPoint(w, o.s0, w.t1), wallPoint(w, o.s1, w.t1)],
    ],
    glass: [[wallPoint(w, o.s0, tc), wallPoint(w, o.s1, tc)]],
  }
}

/** Swing door: leaf drawn open at 90°, and the swing arc from its tip back to the strike side. */
export function swingDoor(w: ResolvedWall, o: ResolvedOpening): { leaf: Polyline; arc: Polyline; hinge: Vec2 } {
  const door = o.spec as Door
  const leaf = door.w
  const hingeS = door.hinge === 'hi' ? o.s1 - 1 : o.s0 + 1
  const faceT = door.side === 'lo' ? w.t0 : w.t1
  const dirT = door.side === 'lo' ? -1 : 1
  const dirS = door.hinge === 'hi' ? -1 : 1
  const hinge = wallPoint(w, hingeS, faceT)
  // Plan-space angle of an (s, t) direction: the open leaf points along ±t, the closed one along ±s.
  const angle = (s: number, t: number) => (w.axis === 'x' ? Math.atan2(t, s) : Math.atan2(s, t))
  const a0 = angle(0, dirT)
  let a1 = angle(dirS, 0)
  // Sweep the short way round (a quarter turn).
  if (a1 - a0 > Math.PI) a1 -= Math.PI * 2
  if (a0 - a1 > Math.PI) a1 += Math.PI * 2
  return { leaf: [hinge, wallPoint(w, hingeS, faceT + dirT * leaf)], arc: arc(hinge, leaf, a0, a1), hinge }
}

/** Bypass or sliding doors: two panels inside the wall thickness, overlapping 2″ at the middle. */
export function slidingPanels(w: ResolvedWall, o: ResolvedOpening): Polyline[] {
  const tc = (w.t0 + w.t1) / 2
  const mid = (o.s0 + o.s1) / 2
  return [
    [wallPoint(w, o.s0, tc - 0.75), wallPoint(w, mid + 1, tc - 0.75)],
    [wallPoint(w, mid - 1, tc + 0.75), wallPoint(w, o.s1, tc + 0.75)],
  ]
}

const inset = (r: Rect, d: Inch): Rect => [r[0] + d, r[1] + d, r[2] - d, r[3] - d]

/** Split a fixture rect into its back (against the wall) and front, given its facing. */
function backFront(f: Fixture, back: Inch): { backRect: Rect; frontRect: Rect } {
  const r = f.rect
  switch (f.facing) {
    case 'N':
      return { backRect: [r[0], r[1], r[2], r[1] + back], frontRect: [r[0], r[1] + back, r[2], r[3]] }
    case 'S':
      return { backRect: [r[0], r[3] - back, r[2], r[3]], frontRect: [r[0], r[1], r[2], r[3] - back] }
    case 'E':
      return { backRect: [r[0], r[1], r[0] + back, r[3]], frontRect: [r[0] + back, r[1], r[2], r[3]] }
    case 'W':
      return { backRect: [r[2] - back, r[1], r[2], r[3]], frontRect: [r[0], r[1], r[2] - back, r[3]] }
  }
}

const mid = (r: Rect): Vec2 => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]

/** Fixture symbol lines. `outline` lines draw first, `detail` lines after. */
export function fixtureSymbol(f: Fixture): { outline: Polyline[]; detail: Polyline[] } {
  const r = f.rect
  switch (f.kind) {
    case 'counter':
    case 'island':
    case 'fridge':
    case 'wall-cab':
      return { outline: [rectLine(r)], detail: [] }
    case 'tall-cab':
      return {
        outline: [rectLine(r)],
        detail: [
          [
            [r[0], r[1]],
            [r[2], r[3]],
          ],
          [
            [r[0], r[3]],
            [r[2], r[1]],
          ],
        ],
      }
    case 'dw':
      return { outline: [], detail: [] }
    case 'sink-double': {
      const w = (r[2] - r[0] - 3) / 2
      const bowlA: Rect = [r[0] + 1, r[1] + 1.5, r[0] + 1 + w, r[3] - 1.5]
      const bowlB: Rect = [r[2] - 1 - w, r[1] + 1.5, r[2] - 1, r[3] - 1.5]
      return { outline: [rectLine(r)], detail: [roundRect(bowlA, 2.5), roundRect(bowlB, 2.5)] }
    }
    case 'range': {
      const [cx, cy] = mid(r)
      const dx = (r[2] - r[0]) / 4
      const dy = (r[3] - r[1]) / 4
      return {
        outline: [rectLine(r)],
        detail: [
          circle([cx - dx, cy - dy], 3.5),
          circle([cx + dx, cy - dy], 4.5),
          circle([cx - dx, cy + dy], 4.5),
          circle([cx + dx, cy + dy], 3.5),
        ],
      }
    }
    case 'wc': {
      const { backRect, frontRect } = backFront(f, 8)
      const tank = inset(backRect, 1)
      const [cx, cy] = mid(frontRect)
      const alongX = f.facing === 'E' || f.facing === 'W'
      const bowl = alongX
        ? ellipse([cx, cy], (frontRect[2] - frontRect[0]) / 2, 7.5)
        : ellipse([cx, cy], 7.5, (frontRect[3] - frontRect[1]) / 2)
      return { outline: [roundRect(tank, 1.5)], detail: [bowl] }
    }
    case 'vanity': {
      const { frontRect } = backFront(f, 4)
      const n = f.sinks ?? 1
      const alongX = f.facing === 'N' || f.facing === 'S'
      const bowls: Polyline[] = []
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n
        const c: Vec2 = alongX
          ? [r[0] + (r[2] - r[0]) * k, (frontRect[1] + frontRect[3]) / 2]
          : [(frontRect[0] + frontRect[2]) / 2, r[1] + (r[3] - r[1]) * k]
        bowls.push(alongX ? ellipse(c, 8, 6) : ellipse(c, 6, 8))
      }
      return { outline: [rectLine(r)], detail: bowls }
    }
    case 'tub': {
      const inner = inset(r, 3)
      const alongX = r[2] - r[0] >= r[3] - r[1]
      const drain: Vec2 = alongX ? [inner[0] + 6, (r[1] + r[3]) / 2] : [(r[0] + r[2]) / 2, inner[1] + 6]
      return { outline: [rectLine(r)], detail: [roundRect(inner, 6), circle(drain, 1.25)] }
    }
    case 'shower':
      return { outline: [rectLine(r)], detail: [circle(mid(r), 1.5)] }
    case 'washer':
      return { outline: [rectLine(r)], detail: [circle(mid(r), Math.min(r[2] - r[0], r[3] - r[1]) / 2 - 3)] }
    case 'dryer':
    case 'water-heater':
      return { outline: [rectLine(r)], detail: [] }
    case 'shelf-rod': {
      // Rod along the long axis at the middle of the hanging zone.
      const alongX = r[2] - r[0] >= r[3] - r[1]
      const [cx, cy] = mid(r)
      return {
        outline: [],
        detail: [
          alongX
            ? [
                [r[0], cy],
                [r[2], cy],
              ]
            : [
                [cx, r[1]],
                [cx, r[3]],
              ],
        ],
      }
    }
  }
}

/** Smoke alarm: 12″ circle with a centre dot. */
export const smokeAlarm = (c: Vec2): Polyline[] => [circle(c, 6), circle(c, 1.25)]

/** North arrow: a circle and a triangle pointing to +y (plan north). */
export function northArrow(c: Vec2, radius: Inch): { ring: Polyline; triangle: Vec2[] } {
  return {
    ring: circle(c, radius),
    triangle: [
      [c[0] - radius * 0.45, c[1] - radius * 0.35],
      [c[0] + radius * 0.45, c[1] - radius * 0.35],
      [c[0], c[1] + radius],
    ],
  }
}
