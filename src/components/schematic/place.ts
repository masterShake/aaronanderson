/**
 * Label and bubble placement for the schematic (isomorphic, no DOM). Each item
 * tries spots around its anchor, ring by ring; a spot's cost is its overlap
 * with hard obstacles (boxes, instruments, people, items placed before it,
 * the area's edges) weighted heavily, its overlap with soft ones (route lines)
 * lightly, plus its distance from the anchor. The cheapest spot wins. The
 * server runs it in viewBox units with estimated text sizes (no-JS and first
 * paint); the controller runs it again in CSS px with measured sizes.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface PlaceItem {
  /** The point the item belongs to. */
  ax: number
  ay: number
  /** Clear distance from the anchor to the nearest edge of the item. */
  gap: number
  w: number
  h: number
}

export interface PlaceOptions {
  /** Clearance kept around hard obstacles and placed items. */
  pad: number
  /** Distance added per ring. */
  step: number
  /** How many rings to try. */
  rings: number
  /** Thickness of a soft line obstacle. */
  line?: number
}

const HARD = 100
const SOFT = 1
const EDGE = 400

/** Directions tried at each distance, as unit vectors. */
const DIRS: readonly (readonly [number, number])[] = Array.from({ length: 24 }, (_, i) => {
  // start straight up-right and alternate around, so near-vertical spots come early
  const order = [-60, 60, -120, 120, -90, 90, -30, 30, -150, 150, 0, 180]
  const d = i < order.length ? order[i]! : order[i - order.length]! + 15
  const r = (d * Math.PI) / 180
  return [Math.round(Math.cos(r) * 1000) / 1000, Math.round(Math.sin(r) * 1000) / 1000] as const
})

const overlap = (a: Box, b: Box, pad: number) => {
  const x = Math.min(a.x + a.w + pad, b.x + b.w) - Math.max(a.x - pad, b.x)
  const y = Math.min(a.y + a.h + pad, b.y + b.h) - Math.max(a.y - pad, b.y)
  return x > 0 && y > 0 ? x * y : 0
}

const outside = (a: Box, area: Box) =>
  Math.max(0, area.x - a.x) * a.h +
  Math.max(0, a.x + a.w - (area.x + area.w)) * a.h +
  Math.max(0, area.y - a.y) * a.w +
  Math.max(0, a.y + a.h - (area.y + area.h)) * a.w

/** Thin boxes along each segment of each polyline (flat [x0, y0, x1, y1, …] per line). */
export function lineBoxes(lines: readonly (readonly number[])[], t: number): Box[] {
  const out: Box[] = []
  for (const l of lines)
    for (let i = 0; i + 3 < l.length; i += 2) {
      const [x0, y0, x1, y1] = [l[i]!, l[i + 1]!, l[i + 2]!, l[i + 3]!]
      out.push({
        x: Math.min(x0, x1) - t / 2,
        y: Math.min(y0, y1) - t / 2,
        w: Math.abs(x1 - x0) + t,
        h: Math.abs(y1 - y0) + t,
      })
    }
  return out
}

/** Places every item in order; returns each item's box (top-left and size). */
export function placeAll(
  items: readonly PlaceItem[],
  hard: readonly Box[],
  area: Box,
  o: PlaceOptions,
  soft: readonly Box[] = [],
): Box[] {
  const taken: Box[] = [...hard]
  const out: Box[] = []
  for (const it of items) {
    let best: Box | null = null
    let bestCost = Infinity
    for (let k = 0; k <= o.rings; k++) {
      const d = it.gap + k * o.step
      const base = k * o.step
      if (base >= bestCost) break
      for (const [ux, uy] of DIRS) {
        const cx = it.ax + ux * (d + it.w / 2)
        const cy = it.ay + uy * (d + it.h / 2)
        const b: Box = { x: cx - it.w / 2, y: cy - it.h / 2, w: it.w, h: it.h }
        let cost = base + outside(b, area) * EDGE
        for (const t of taken) {
          if (cost >= bestCost) break
          cost += overlap(b, t, o.pad) * HARD
        }
        for (const t of soft) {
          if (cost >= bestCost) break
          cost += overlap(b, t, 0) * SOFT
        }
        if (cost < bestCost) {
          best = b
          bestCost = cost
        }
      }
    }
    const b = best ?? { x: it.ax, y: it.ay, w: it.w, h: it.h }
    // keep it inside the area even when nothing was free
    b.x = Math.min(Math.max(b.x, area.x), area.x + area.w - b.w)
    b.y = Math.min(Math.max(b.y, area.y), area.y + area.h - b.h)
    out.push(b)
    taken.push(b)
  }
  return out
}
