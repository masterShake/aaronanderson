import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'

/**
 * S-06 Run & Improve on the /kit/fig/s06 harness (until the services page carries it): the
 * plan at the hand-off progress, the print and the months by --p, the inspection loops, the
 * health card (labels only), and the still tier (the print image, no layer bundles).
 */

const FIG = '#fig-s06'

test('the plan draws to the hand-off; the print and three months by p = 1', async ({
  page,
  guard,
}) => {
  await gotoTier(page, '/kit/fig/s06?p=0.15', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  expect(await fig.locator('.drawing svg.l-cad path').count()).toBeGreaterThan(20)
  await expect(fig.locator('.drawing svg.l-iso').first()).toHaveCSS('opacity', '0')
  await gotoTier(page, '/kit/fig/s06?p=1', 'svg')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect(fig).toHaveAttribute('data-mech', '')
  const iso = fig.locator('.drawing svg.l-iso:visible')
  await expect(iso).toHaveCSS('opacity', '1')
  for (const m of ['m1', 'm2', 'm3'])
    await expect(iso.locator(`[data-part="${m}"]`).first()).toHaveCSS('opacity', '1')
  expect(guard.errors).toEqual([])
})

test('months are reversible: at p = 0.6 only the first is bolted on', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s06?p=0.6', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  const iso = fig.locator('.drawing svg.l-iso:visible')
  await expect(iso.locator('[data-part="m1"]').first()).toHaveCSS('opacity', '1')
  await expect(iso.locator('[data-part="m2"]').first()).toHaveCSS('opacity', '0')
  await expect(iso.locator('[data-part="m3"]').first()).toHaveCSS('opacity', '0')
})

test('the health card shows labels only, never numbers', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s06?p=1', 'svg')
  const text = await page.locator(`${FIG} .ui`).first().innerText()
  const card = text.split('MONTHS')[0] ?? ''
  expect(card).not.toMatch(/\d/)
})

test('the still tier shows the print image and fetches no layer bundles', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (r) => {
    if (/\/drawings\/s06\..+\.json$/.test(r.url())) fetched.push(r.url())
  })
  await gotoTier(page, '/kit/fig/s06', 'still')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig.locator('.still-wrap img.still-img:visible')).toHaveCount(1)
  await page.waitForTimeout(300)
  expect(fetched).toEqual([])
})

test('drawing files are served', async ({ request }) => {
  for (const f of ['wide.json', 'tall.json', 'wide.print.still.svg', 'tall.plan.still.svg']) {
    const r = await request.get(`/drawings/s06.${f}`)
    expect(r.status(), f).toBe(200)
  }
})
