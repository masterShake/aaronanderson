import { test, expect } from '../fixtures'
import { ROUTES } from '../routes'

/**
 * The figure DOM contract (src/figures/types.ts, Appendix B §B5) holds for
 * every figure on every sheet: ids, labelling, data-* state values, the slot,
 * the label layer and the live region. Lazy drawings load their layers when
 * scrolled near.
 */

const PHASES = ['still', 'waiting', 'playing', 'done']
const MEDIA = ['svg', 'webgl']
const STAGES = ['svg', 'handoff', 'webgl', 'handback']

for (const r of ROUTES) {
  test(`figure contract ${r.path}`, async ({ page, guard }) => {
    await page.goto(`${r.path}?tier=svg`)
    const figs = page.locator('figure[data-figure]')
    const n = await figs.count()
    for (let i = 0; i < n; i++) {
      const fig = figs.nth(i)
      const id = await fig.getAttribute('data-figure')
      expect(await fig.getAttribute('id')).toBe(`fig-${id}`)
      const title = await fig.getAttribute('aria-labelledby')
      const desc = await fig.getAttribute('aria-describedby')
      await expect(page.locator(`[id="${title}"]`)).toHaveCount(1)
      await expect(page.locator(`[id="${desc}"]`)).toHaveCount(1)
      expect(await page.locator(`[id="${desc}"]`).innerText()).not.toBe('')
      expect(PHASES).toContain(await fig.getAttribute('data-phase'))
      expect(MEDIA).toContain(await fig.getAttribute('data-medium'))
      expect(STAGES).toContain(await fig.getAttribute('data-stage'))
      expect(['wide', 'tall']).toContain(await fig.getAttribute('data-family'))
      await expect(fig.locator('.slot[data-stage-slot] > canvas.still')).toHaveCount(1)
      await expect(fig.locator('.labels[aria-hidden="true"]')).toHaveCount(1)
      await expect(fig.locator('[data-live][aria-live="polite"]')).toHaveCount(1)
      await expect(fig.locator('figcaption')).toHaveCount(1)
      if (id !== 'not-found')
        expect(await fig.locator('.drawing svg[class^="l-"]').count()).toBeGreaterThan(0)
    }
    expect(guard.errors).toEqual([])
  })
}

test('lazy drawings load their layers near the viewport', async ({ page }) => {
  await page.goto('/services?tier=svg')
  const fig = page.locator('#fig-s02')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  expect(await fig.locator('svg.l-cad path').count()).toBeGreaterThan(0)
})

test('still tier fetches no drawing layers', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (q.url().includes('/drawings/') && q.url().endsWith('.json')) fetched.push(q.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/services?tier=still')
  await page.locator('#fig-s02').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  expect(fetched).toEqual([])
})

test('drawing files are served as static files', async ({ request }) => {
  const json = await request.get('/drawings/_fixture.wide.json')
  expect(json.status()).toBe(200)
  expect((await json.json()).v).toBe(1)
  const svg = await request.get('/drawings/_fixture.wide.still.svg')
  expect(svg.headers()['content-type']).toContain('image/svg+xml')
  expect((await request.get('/drawings/nope.wide.json')).status()).toBe(404)
})
