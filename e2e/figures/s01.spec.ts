import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { S01_TOOLS } from '../../src/drawings/views/s01'

/**
 * S-01 THE SURVEY (SVG only): its files are served, its layers load, --p
 * drives the beats (pinned with ?p= on /kit/fig), the still tier shows the
 * final still with the finished labels, the sheet scrubs it at 1280 with a
 * fine pointer, and a phone plays it on entry to the end.
 */

const pOf = (fig: import('@playwright/test').Locator) =>
  fig.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--p')))

test('drawing files are served', async ({ request }) => {
  for (const f of ['wide', 'tall']) {
    const json = await request.get(`/drawings/s01.${f}.json`)
    expect(json.status()).toBe(200)
    const b = await json.json()
    expect(b.v).toBe(1)
    expect(Object.keys(b.layers)).toEqual(expect.arrayContaining(['panel', 'pencil', 'cad', 'pkt']))
    const still = await request.get(`/drawings/s01.${f}.surveyed.still.svg`)
    expect(still.headers()['content-type']).toContain('image/svg+xml')
    const svg = await still.text()
    expect(svg).not.toContain('<text')
    expect(svg).not.toContain('vector-effect')
  }
})

test('layers load and --p drives the beats', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s01?p=0', 'svg')
  const fig = page.locator('#fig-s01')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  expect(await fig.locator('svg.l-pencil path').count()).toBeGreaterThan(20)
  expect(await fig.locator('svg.l-cad path').count()).toBeGreaterThan(10)
  await expect(fig.locator('.labels > span').filter({ hasNotText: /^$/ })).not.toHaveCount(0)
  // p = 0: the blank survey sheet is there (W4c: no empty column), its rows not yet written
  const listOpacity = () =>
    fig.locator('.labels > div').evaluate((el) => Number(getComputedStyle(el).opacity))
  const written = () =>
    fig
      .locator('.labels > div li > :not(:first-child)')
      .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)))
  expect(await listOpacity()).toBe(1)
  expect(await written()).toHaveLength(6)
  for (const o of await written()) expect(o).toBe(0)
  await gotoTier(page, '/kit/fig/s01?p=1', 'svg')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  expect(await listOpacity()).toBe(1)
  for (const o of await written()) expect(o).toBe(1)
  // the long description has its counts filled in
  const desc = await page.locator('#fig-s01-desc').innerText()
  expect(desc).not.toMatch(/[{}]/)
  expect(desc.toLowerCase()).toContain('eight tools')
  expect(guard.errors).toEqual([])
})

/** Opacities of the starting sketch: boxes, lines and glyphs (paths) and the tool names. */
const sketch = (fig: import('@playwright/test').Locator) =>
  fig.evaluate((el) =>
    // (the paper backings under the hand-off lines are 0.8 by design)
    [...el.querySelectorAll('svg path.sk:not(.f-paper), svg path.gl, svg path.sv, .labels > span')]
      .filter((n) => n.matches('path') || /tool/.test(n.className))
      .map((n) => Number(getComputedStyle(n).opacity)),
  )

test('p = 0 opens on the whole sketch, never an empty panel (W4b)', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s01?p=0', 'svg')
  const fig = page.locator('#fig-s01')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  const o = await sketch(fig)
  expect(o.length).toBeGreaterThan(S01_TOOLS.length * 2)
  for (const v of o) expect(v).toBeGreaterThanOrEqual(0.99)
})

test('on the sheet the sketch draws on as the figure scrolls in (lead-in)', async ({ page }) => {
  await gotoTier(page, '/services', 'svg')
  const fig = page.locator('#fig-s01')
  // the figure's own top, measured before it sticks
  await page.evaluate(() => scrollTo(0, 0))
  const top = await fig.evaluate((el) => el.getBoundingClientRect().top + scrollY)
  const at = (k: number) => page.evaluate(([y, k]) => scrollTo(0, y - innerHeight * k), [top, k])
  const pre = () => fig.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--pre')))
  // its top half a viewport below the fold: nothing drawn yet
  await at(1.5)
  await expect.poll(pre).toBe(0)
  // its top at half the viewport: the sketch is whole
  await at(0.5)
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect.poll(pre).toBe(1)
  for (const v of await sketch(fig)) expect(v).toBeGreaterThanOrEqual(0.99)
})

test('tool labels and survey tags cover every tool', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s01?p=1', 'svg')
  const n = await page.locator('#fig-s01 .labels > span').count()
  // a name and a tag per tool, and three Δ tags; no hand notes (W4 finish standard A4)
  expect(n).toBe(S01_TOOLS.length * 2 + 3)
  await expect(page.locator('#fig-s01 .labels .note')).toHaveCount(0)
})

test('at p = 1 the survey marks are gone and the list is whole', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s01?p=1', 'svg')
  const fig = page.locator('#fig-s01')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  const opacities = (sel: string) =>
    fig.locator(sel).evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)))
  // no crosshairs, survey tags, Δ tags or fan left over the finished map
  for (const o of await opacities('svg.l-pkt path.xh')) expect(o).toBe(0)
  for (const o of await opacities('svg.l-pkt .s01-fan')) expect(o).toBe(0)
  for (const o of await opacities('.labels > span:not(:first-child)')) expect([0, 1]).toContain(o)
  const items = fig.locator('.labels > div li')
  await expect(items).toHaveCount(3)
  for (const o of await opacities('.labels > div li')) expect(o).toBe(1)
  for (const o of await opacities('.labels > div li > *')) expect(o).toBe(1)
})

test('still tier shows the final still and the finished labels', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s01', 'still')
  const fig = page.locator('#fig-s01')
  await expect(fig).toHaveAttribute('data-phase', 'still')
  const img = fig.locator('img.still-img').filter({ visible: true }).first()
  await expect(img).toBeVisible()
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true)
  expect(await pOf(fig)).toBe(1)
})

test('the sheet scrubs it at 1280 with a fine pointer', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'scrub is desktop only')
  await gotoTier(page, '/services', 'svg')
  const fig = page.locator('#fig-s01')
  const track = page.locator('section#s-01 [data-scrub-track]')
  const box = await track.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top + scrollY, h: r.height }
  })
  // scroll well above, so the driver starts from an unfinished drawing
  await page.evaluate((y) => scrollTo(0, y), Math.max(0, box.top - 1600))
  await page.waitForTimeout(300)
  await page.evaluate((y) => scrollTo(0, y), box.top - 88 + box.h * 0.3)
  await expect.poll(() => pOf(fig)).toBeGreaterThan(0.05)
  const mid = await pOf(fig)
  expect(mid).toBeLessThan(0.95)
  await page.evaluate((y) => scrollTo(0, y), box.top + box.h)
  await expect.poll(() => pOf(fig)).toBe(1)
})

test('a phone plays it on entry, to the end', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'play mode on the phone')
  await gotoTier(page, '/services', 'svg')
  const fig = page.locator('#fig-s01')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 10_000 })
  expect(await pOf(fig)).toBe(1)
  await fig.locator('[data-action="replay"]').click()
  await expect.poll(() => pOf(fig)).toBeLessThan(1)
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 10_000 })
})
