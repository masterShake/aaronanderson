import { test, expect } from '@playwright/test'
import type { LayoutId } from '@/drawings/types'
import { HOME_BODY, HOME_CARRIES, homeFirmGraph as g } from '@/drawings/views/home'
import { inRev, nodeRect, routeGraph, segHitsRect, type Rect } from '@/drawings/lib/route'

/**
 * Home B's layout of the example firm (W4b A2, A3): the tools fill the frame
 * in both families, with no empty band above the first row or under the last,
 * and As found every person walks beside the hand-off line they carry paper
 * along: their body clear of every line and every box.
 */

const FAMILIES: readonly LayoutId[] = ['wide', 'tall']
const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

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

  test(`${family}: As found, each person walks beside their line, clear of lines and boxes`, () => {
    const found = routeGraph(g, 'asFound', family, { bend: 0 })
    const rects = g.nodes.filter((n) => inRev(n, 'asFound')).map((n) => nodeRect(n, family))
    const people = g.people ?? []
    expect(people.length).toBeGreaterThan(0)
    const bodies: Rect[] = []
    for (const p of people) {
      const pose = p.poses.asFound!
      const at = family === 'tall' ? (pose.atTall ?? pose.at) : pose.at
      // the body, less the feet that may touch the line they walk on
      const body: Rect = {
        x: at[0] + HOME_BODY.x,
        y: at[1] + HOME_BODY.y,
        w: HOME_BODY.w,
        h: HOME_BODY.h - 2,
      }
      for (const r of rects) expect(hit(body, r), `${p.id} on a box`).toBe(false)
      for (const r of found.values())
        for (let i = 1; i < r.pts.length; i++)
          expect(segHitsRect(r.pts[i - 1]!, r.pts[i]!, body), `${p.id} on ${r.id}`).toBe(false)
      for (const b of bodies) expect(hit(body, b), `${p.id} on another person`).toBe(false)
      bodies.push(body)
      // and beside their own line: within a body's width of it
      const own = found.get(HOME_CARRIES[p.id]!)!
      const near = own.pts.slice(1).some((b, i) => {
        const a = own.pts[i]!
        const pad: Rect = {
          x: body.x - HOME_BODY.w,
          y: body.y,
          w: body.w + HOME_BODY.w * 2,
          h: body.h + 6,
        }
        return segHitsRect(a, b, pad)
      })
      expect(near, `${p.id} beside ${own.id}`).toBe(true)
    }
  })
}
