import { test, expect } from '../fixtures'
import { isProductionBuild } from '../helpers/budgets'

/**
 * DETAIL 1 / G-03, the after-contact figure: one frame per id, four node
 * boxes and three conduits once its layers load, four HTML labels inside the
 * box at both families, the still on the still tier with no layer fetch, and
 * the harness page /kit/fig/after-contact. FIGURES=after-contact narrows the
 * figure suites to this file's ids.
 */

const only = process.env.FIGURES
test.skip(Boolean(only) && !only!.split(',').includes('after-contact'), 'FIGURES excludes it')

for (const path of ['/contact', '/kit/fig/after-contact']) {
  test(`layers load and labels sit inside the box (${path})`, async ({ page, guard }) => {
    test.skip(path.startsWith('/kit') && (await isProductionBuild(page)), '/kit is preview only')
    await page.goto(`${path}${path.includes('?') ? '&' : '?'}tier=svg`)
    const fig = page.locator('#fig-after-contact')
    await expect(fig).toHaveCount(1)
    await fig.scrollIntoViewIfNeeded()
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    // four node boxes (path plus port rings) and three conduits in the CAD layer
    for (const id of ['you', 'reply', 'call', 'next'])
      await expect(fig.locator(`svg.l-cad g[data-part="${id}"]`)).toHaveCount(1)
    await expect(
      fig.locator(
        'svg.l-cad g[data-part$="-reply"], svg.l-cad g[data-part$="-call"], svg.l-cad g[data-part$="-next"]',
      ),
    ).toHaveCount(3)
    await expect(fig).toHaveAttribute('data-phase', 'done')
    const box = (await fig.locator('.box').boundingBox())!
    const labels = fig.locator('.labels > [data-anchor]')
    await expect(labels).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      const b = (await labels.nth(i).boundingBox())!
      expect(b.x).toBeGreaterThanOrEqual(box.x - 1)
      expect(b.y).toBeGreaterThanOrEqual(box.y - 1)
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1)
      expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1)
    }
    expect(guard.errors).toEqual([])
  })
}

/** craft-25: each step's name sits inside its own node, at both families. */
for (const width of [1280, 390]) {
  test(`each name sits inside its node @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/contact?tier=svg')
    const fig = page.locator('#fig-after-contact')
    await fig.scrollIntoViewIfNeeded()
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const out = await fig.evaluate((f) =>
      ['you', 'reply', 'call', 'next'].map((id) => {
        const svg = [...f.querySelectorAll('svg.l-cad')].find((v) => v.checkVisibility())!
        const n = svg.querySelector(`g[data-part="${id}"]`)!.getBoundingClientRect()
        const l = f.querySelector(`.labels > [data-anchor="${id}"]`)!.getBoundingClientRect()
        const inside =
          l.left >= n.left - 0.5 &&
          l.right <= n.right + 0.5 &&
          l.top >= n.top - 0.5 &&
          l.bottom <= n.bottom + 0.5
        return inside ? null : id
      }),
    )
    expect(out.filter(Boolean)).toEqual([])
  })
}

test('the still tier shows the baked still and fetches no layers', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (q.url().includes('/drawings/after-contact') && q.url().endsWith('.json'))
      fetched.push(q.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/contact?tier=still')
  const fig = page.locator('#fig-after-contact')
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await expect(fig.locator('.still-wrap img.still-img:visible')).toHaveCount(1)
  expect(fetched).toEqual([])
})
