import { test, expect } from '../fixtures'
import { ORG_REVS } from '../../src/drawings/views/org-chart'

/**
 * The org chart (About, DETAIL 2 / G-02): served drawing files for both
 * states, layers that load near the viewport, one set of labels per state,
 * all inside the box, and no text inside the SVG.
 */

test('org-chart files are served: layers and a still per family and state', async ({ request }) => {
  for (const fam of ['wide', 'tall']) {
    const json = await request.get(`/drawings/org-chart.${fam}.json`)
    expect(json.status()).toBe(200)
    const b = await json.json()
    expect(b.v).toBe(1)
    for (const m of Object.values(b.layers as Record<string, string>))
      expect(m).not.toContain('<text')
    for (const rev of ORG_REVS) {
      const still = await request.get(`/drawings/org-chart.${fam}.${rev}.still.svg`)
      expect(still.status()).toBe(200)
      expect(still.headers()['content-type']).toContain('image/svg+xml')
    }
  }
})

for (const width of [390, 1280]) {
  test(`both states draw, and their labels sit inside the box @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/about?tier=svg')
    const fig = page.locator('#fig-org-chart')
    await fig.scrollIntoViewIfNeeded()
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    expect(await fig.locator('.drawing svg text').count()).toBe(0)
    for (const rev of ORG_REVS) {
      await fig.locator(`[role="group"] > button`).nth(ORG_REVS.indexOf(rev)).click()
      await expect(fig).toHaveAttribute('data-toggle', rev)
      // a change is a scan (W4c): wait for its edge and every label it passes to settle
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (a) =>
                    a.playState === 'running' &&
                    (a instanceof CSSTransition ||
                      /org-(scan|sheet|edge)/.test((a as CSSAnimation).animationName ?? '')),
                ).length,
          ),
        )
        .toBe(0)
      expect(await fig.locator(`.drawing g[data-rev="${rev}"] path`).count()).toBeGreaterThan(0)
      const out = await fig.evaluate((el) => {
        const box = el.querySelector('.box')!.getBoundingClientRect()
        const bad: string[] = []
        let shown = 0
        for (const l of el.querySelectorAll<HTMLElement>('.labels > *')) {
          // the other state's labels stay in place, hidden (visibility), so a scan can change them
          if (!l.checkVisibility({ visibilityProperty: true })) continue
          shown++
          const r = l.getBoundingClientRect()
          if (
            r.left < box.left - 1 ||
            r.right > box.right + 1 ||
            r.top < box.top - 1 ||
            r.bottom > box.bottom + 1
          )
            bad.push(l.textContent ?? '')
        }
        return { shown, bad }
      })
      expect(out.shown).toBeGreaterThan(1)
      expect(out.bad, `${rev} @${width}`).toEqual([])
      // every card is a person, not just a title
      expect(
        await fig.locator(`.drawing g[data-rev="${rev}"] g.person path`).count(),
      ).toBeGreaterThan(0)
      // titles, the dimension and the hand note never touch each other
      const hits = await fig.evaluate((el) =>
        [...el.querySelectorAll<HTMLElement>('.labels > *')]
          .filter((l) => l.checkVisibility({ visibilityProperty: true }))
          .map((l) => {
            const r = l.getBoundingClientRect()
            return { what: l.textContent ?? '', at: [r.left, r.top, r.right, r.bottom] }
          }),
      )
      const overlaps: string[] = []
      for (let i = 0; i < hits.length; i++)
        for (let j = i + 1; j < hits.length; j++) {
          const [a, b] = [hits[i]!.at, hits[j]!.at]
          const x = Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)
          const y = Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!)
          if (x > 0.5 && y > 0.5) overlaps.push(`${hits[i]!.what} × ${hits[j]!.what}`)
        }
      expect(overlaps, `${rev} @${width}: overlapping`).toEqual([])
    }
  })
}
