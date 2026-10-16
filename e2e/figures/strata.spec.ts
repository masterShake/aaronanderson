import { test, expect } from '../fixtures'
import { STRATA_REV } from '../../src/drawings/views/strata'

/**
 * The strata (About, DETAIL 1 / G-02): static. Served files, layers that load
 * near the viewport with no draw-on and no controls, labels inside the box,
 * and the still standing in on the still tier.
 */

test('strata files are served and text-free', async ({ request }) => {
  for (const fam of ['wide', 'tall']) {
    const json = await request.get(`/drawings/strata.${fam}.json`)
    expect(json.status()).toBe(200)
    for (const m of Object.values((await json.json()).layers as Record<string, string>))
      expect(m).not.toContain('<text')
    const still = await request.get(`/drawings/strata.${fam}.${STRATA_REV}.still.svg`)
    expect(still.headers()['content-type']).toContain('image/svg+xml')
  }
})

for (const width of [390, 1280]) {
  test(`static: no draw-on, no controls, labels inside the box @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/about?tier=svg')
    const fig = page.locator('#fig-strata')
    await fig.scrollIntoViewIfNeeded()
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    expect(await fig.locator('.drawing path').count()).toBeGreaterThan(0)
    expect(await fig.locator('.drawing .draw').count()).toBe(0)
    // a finished section: outline with break lines, a dimension chain, the A–A cut
    for (const part of ['outline', 'dim', 'cut', 'code', 'office', 'field'])
      expect(await fig.locator(`.drawing path[data-part="${part}"]`).count(), part).toBeGreaterThan(
        0,
      )
    await expect(fig.locator('.controls button')).toHaveCount(0)
    const bad = await fig.evaluate((el) => {
      const box = el.querySelector('.box')!.getBoundingClientRect()
      return [...el.querySelectorAll<HTMLElement>('.labels > *')]
        .filter((l) => {
          const r = l.getBoundingClientRect()
          return r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1
        })
        .map((l) => l.textContent)
    })
    expect(bad).toEqual([])
  })
}

test('still tier: the still image shows and no layers are fetched', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (/\/drawings\/strata\..+\.json$/.test(q.url())) fetched.push(q.url())
  })
  await page.goto('/about?tier=still')
  const fig = page.locator('#fig-strata')
  await fig.scrollIntoViewIfNeeded()
  // one still per family; the one for this width shows
  await expect(fig.locator('.still-wrap img.still-img').filter({ visible: true })).toHaveCount(1)
  await page.waitForTimeout(300)
  expect(fetched).toEqual([])
})
