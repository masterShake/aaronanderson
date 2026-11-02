import { describe, expect, it } from 'vitest'
import { outline, pieceLength } from '@/lib/geom/outline'
import { containsOpen, type Rect } from '@/lib/geom/rect'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'

describe('outline', () => {
  it('traces a single rectangle counter-clockwise', () => {
    const pieces = outline([[0, 0, 10, 4]])
    expect(pieces).toHaveLength(4)
    const perimeter = pieces.reduce((s, q) => s + pieceLength(q), 0)
    expect(perimeter).toBe(28)
    // Region on the left: the bottom edge runs +x.
    const bottom = pieces.find((q) => q.a[1] === 0 && q.b[1] === 0)
    expect(bottom?.b[0]).toBeGreaterThan(bottom?.a[0] ?? 0)
  })

  it('merges two touching rectangles into one boundary and splits ownership', () => {
    const pieces = outline([
      [0, 0, 10, 4],
      [10, 0, 20, 4],
    ])
    // No piece on the shared edge x = 10.
    expect(pieces.some((q) => q.a[0] === 10 && q.b[0] === 10)).toBe(false)
    const total = pieces.reduce((s, q) => s + pieceLength(q), 0)
    expect(total).toBe(48)
    expect(new Set(pieces.map((q) => q.owner))).toEqual(new Set([0, 1]))
  })

  it('cuts openings out of a wall, leaving jamb pieces', () => {
    const pieces = outline([[0, 0, 100, 6]], [[40, 0, 60, 6]])
    // Two rectangles' worth of boundary: 2 × (40 + 6) × 2.
    expect(pieces.reduce((s, q) => s + pieceLength(q), 0)).toBe(184)
    expect(pieces.filter((q) => q.a[0] === 40 && q.b[0] === 40)).toHaveLength(1)
  })

  it('matches a brute-force raster of the House No. 1 walls', () => {
    const house = resolveHouse(HOUSE_NO_1)
    const solids = house.walls.map((w) => w.spec.rect)
    const cuts = house.walls.flatMap((w) => w.openings.map((o) => o.cut))
    const inside = (x: number, y: number) =>
      solids.some((r) => containsOpen(r, [x, y])) && !cuts.some((c) => containsOpen(c, [x, y]))
    // Every outline piece separates inside from outside along its whole length.
    for (const q of house.outline) {
      const horizontal = q.a[1] === q.b[1]
      const [lo, hi] = horizontal ? [Math.min(q.a[0], q.b[0]), Math.max(q.a[0], q.b[0])] : [Math.min(q.a[1], q.b[1]), Math.max(q.a[1], q.b[1])]
      for (let s = lo + 0.125; s < hi; s += 0.25) {
        const [x, y] = horizontal ? [s, q.a[1]] : [q.a[0], s]
        const e = 1 / 64
        const sides = horizontal ? [inside(x, y + e), inside(x, y - e)] : [inside(x - e, y), inside(x + e, y)]
        expect(sides[0]).not.toBe(sides[1])
      }
    }
    // Conversely, every boundary crossing on a ¼″ raster lies on some outline piece.
    const onOutline = (x: number, y: number) =>
      house.outline.some((q) =>
        q.a[1] === q.b[1]
          ? q.a[1] === y && x > Math.min(q.a[0], q.b[0]) && x < Math.max(q.a[0], q.b[0])
          : q.a[0] === x && y > Math.min(q.a[1], q.b[1]) && y < Math.max(q.a[1], q.b[1]),
      )
    const ys = new Set(solids.flatMap((r: Rect) => [r[1], r[3]]).concat(cuts.flatMap((r) => [r[1], r[3]])))
    for (const y of ys)
      for (let x = 0.125; x < 576; x += 0.25)
        if (inside(x, y + 1 / 64) !== inside(x, y - 1 / 64)) expect(onOutline(x, y)).toBe(true)
  })
})
