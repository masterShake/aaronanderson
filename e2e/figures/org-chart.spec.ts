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
      expect(await fig.locator(`.drawing g[data-rev="${rev}"] path`).count()).toBeGreaterThan(0)
      const out = await fig.evaluate((el) => {
        const box = el.querySelector('.box')!.getBoundingClientRect()
        const bad: string[] = []
        let shown = 0
        for (const l of el.querySelectorAll<HTMLElement>('.labels > *')) {
          if (!l.checkVisibility()) continue
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
    }
  })
}
