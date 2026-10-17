import { test, expect } from '@playwright/test'
import type { LayoutId } from '@/drawings/types'
import {
  HOME_BODY,
  HOME_CARRIES,
  HOME_DESKS,
  HOME_LEVEL_GAP,
  HOME_WIDE_ONLY,
  homeBodyOf,
  homeFirmGraph as g,
} from '@/drawings/views/home'
import { inRev, nodeRect, routeGraph, segHitsRect, type Rect } from '@/drawings/lib/route'

/**
 * Home B's layout of the example firm (W4b A2, A3; W4d A1, A2): the tools fill the frame
 * in both families, with no empty band above the first row or under the last, and As found
 * every person stands clear of every line, arrow and box: the walkers beside the hand-off
 * line they carry paper along, the desk workers in the wide grid's two empty cells.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const grow = (r: Rect, d: number): Rect => ({
  x: r.x - d,
  y: r.y - d,
  w: r.w + d * 2,
  h: r.h + d * 2,
})

for (const family of FAMILIES) {
  test(`${family}: the tools fill the frame top to bottom, As found`, () => {
    const [, , , vh] = g.viewBox[family]
    const rects = g.nodes.filter((n) => inRev(n, 'asFound')).map((n) => nodeRect(n, family))
    const top = Math.min(...rects.map((r) => r.y))
    const bottom = Math.max(...rects.map((r) => r.y + r.h))
    // margins under 8% of the height above, and under 15% below (the hand note's line)
    expect(top / vh, 'top band').toBeLessThan(0.08)
    expect((vh - bottom) / vh, 'bottom band').toBeLessThan(0.15)
  })

  test(`${family}: As found, each person stands clear of lines, arrows and boxes`, () => {
    const found = routeGraph(g, 'asFound', family, { bend: 0 })
    const rects = g.nodes.filter((n) => inRev(n, 'asFound')).map((n) => nodeRect(n, family))
    const [, , vw, vh] = g.viewBox[family]
    const people = (g.people ?? []).filter(
      (p) => p.poses.asFound && !(family === 'tall' && HOME_WIDE_ONLY.includes(p.id)),
    )
    expect(people.length).toBeGreaterThan(0)
    if (family === 'wide')
      for (const id of Object.keys(HOME_DESKS))
        expect(
          people.some((p) => p.id === id),
          `${id} at a desk`,
        ).toBe(true)
    const bodies: Rect[] = []
    for (const p of people) {
      const pose = p.poses.asFound!
      const at = family === 'tall' ? (pose.atTall ?? pose.at) : pose.at
      const b = homeBodyOf(p.id)
      // the whole body, feet included (and a desk worker's desk): nobody stands on a line or an
      // arrow (W4c A2, W4d A2), with a little air around them
      const body: Rect = { x: at[0] + b.x, y: at[1] + b.y, w: b.w, h: b.h }
      expect(
        body.x >= 0 && body.y >= 0 && body.x + body.w <= vw && body.y + body.h <= vh,
        `${p.id} inside the frame`,
      ).toBe(true)
      for (const r of rects) expect(hit(body, r), `${p.id} on a box`).toBe(false)
      for (const r of found.values())
        for (let i = 1; i < r.pts.length; i++)
          expect(segHitsRect(r.pts[i - 1]!, r.pts[i]!, grow(body, 2)), `${p.id} on ${r.id}`).toBe(
            false,
          )
      for (const o of bodies) expect(hit(body, o), `${p.id} on another person`).toBe(false)
      bodies.push(body)
      // a walker is beside their own line: within a body's width of it, or a step under the feet
      const carries = HOME_CARRIES[p.id]
      if (!carries) continue
      const own = found.get(carries)!
      const near = own.pts.slice(1).some((q, i) => {
        const a = own.pts[i]!
        const pad: Rect = {
          x: body.x - HOME_BODY.w,
          y: body.y,
          w: body.w + HOME_BODY.w * 2,
          h: body.h + HOME_LEVEL_GAP + 6,
        }
        return segHitsRect(a, q, pad)
      })
      expect(near, `${p.id} beside ${own.id}`).toBe(true)
    }
  })
}
