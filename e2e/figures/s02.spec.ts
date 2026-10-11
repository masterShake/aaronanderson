import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { axe, describe } from '../helpers/axe'

/**
 * S-02 (owner: scenes-a), on the /kit/fig harness until the services page hosts it.
 *   FIGURES=s02,s04 npm run test:figures
 */

test.skip(
  !!process.env.FIGURES && !process.env.FIGURES.split(',').includes('s02'),
  'FIGURES leaves s02 out',
)

const FIG = '#fig-s02'
const desktopOnly = (name: string) =>
  test.skip(test.info().project.name !== 'desktop', `${name}: desktop project only`)

async function ready(page: Page) {
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  return fig
}

test('s02 draws its layers, with no <text> and no vector-effect', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s02', 'svg')
  const fig = await ready(page)
  expect(await fig.locator('svg.l-cad path').count()).toBeGreaterThan(0)
  expect(await fig.locator('svg.l-pkt [data-part^="pk."]').count()).toBe(4)
  expect(await fig.locator('text').count()).toBe(0)
  const vectorEffect = await fig.evaluate((el) =>
    [...el.querySelectorAll('svg *')].some(
      (n) =>
        n.hasAttribute('vector-effect') ||
        getComputedStyle(n).getPropertyValue('vector-effect') === 'non-scaling-stroke',
    ),
  )
  expect(vectorEffect).toBe(false)
  expect(guard.errors).toEqual([])
})

for (const [family, width] of [
  ['wide', 440],
  ['tall', 360],
] as const) {
  test(`s02 labels are at least 104 × 36 px at ${width} px (${family})`, async ({ page }) => {
    desktopOnly('label sizes')
    await gotoTier(page, '/kit/fig/s02?p=0.44', 'svg')
    const fig = await ready(page)
    // The container is the figure's content box (1 px border each side).
    await fig.evaluate((el, w) => {
      el.style.width = `${w + 2}px`
    }, width)
    await expect(fig).toHaveAttribute('data-family', family)
    const boxes = await fig
      .locator('.labels > [data-anchor^="tool."]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
    expect(boxes.length).toBe(4)
    for (const b of boxes) {
      expect(b.width).toBeGreaterThanOrEqual(104)
      expect(b.height).toBeGreaterThanOrEqual(36)
    }
  })
}

test('s02 pins --p from ?p= on the harness', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s02?p=0.3', 'svg')
  const fig = await ready(page)
  await page.waitForTimeout(400)
  expect(await fig.evaluate((el) => el.style.getPropertyValue('--p'))).toBe('0.3000')
})

test('s02 fans the lead out to three places, fails a sync on loop 3 only', async ({ page }) => {
  desktopOnly('loop timing')
  test.setTimeout(60_000)
  await gotoTier(page, '/kit/fig/s02', 'svg')
  await ready(page)
  // Sample the figure every animation frame until it idles.
  const log = await page.evaluate(
    (sel) =>
      new Promise<{ t: number; loop: string; sync: boolean; flash: boolean; copies: number }[]>(
        (resolve) => {
          const el = document.querySelector<HTMLElement>(sel)!
          const out: { t: number; loop: string; sync: boolean; flash: boolean; copies: number }[] =
            []
          const tick = (t: number) => {
            const copies = ['est', 'pm', 'acct'].filter(
              (d) =>
                el.querySelector<SVGPathElement>(`svg.l-pkt [data-part="pk.${d}"]`)?.style
                  .opacity === '1',
            ).length
            out.push({
              t,
              loop: el.dataset.loop ?? '',
              sync: 'sync' in el.dataset,
              flash: 'flash' in el.dataset,
              copies,
            })
            if (el.dataset.phase === 'done' || out.length > 60 * 40) resolve(out)
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        },
      ),
    FIG,
  )
  expect(log.at(-1)).toBeTruthy()
  await expect(page.locator(FIG)).toHaveAttribute('data-phase', 'done')
  await expect(page.locator(`${FIG} [data-action="run-again"]`)).toBeVisible()
  // NEW LEAD visibly fans out: all three copies on screen together for at least 600 ms.
  let run = 0
  let best = 0
  for (let i = 1; i < log.length; i++) {
    run = log[i]!.copies === 3 ? run + (log[i]!.t - log[i - 1]!.t) : 0
    best = Math.max(best, run)
  }
  expect(best).toBeGreaterThanOrEqual(600)
  // SYNC FAILED → ALERT SENT on loop 3 only.
  const syncLoops = new Set(log.filter((s) => s.sync).map((s) => s.loop))
  expect([...syncLoops]).toEqual(['3'])
  // At most 2 flashes in any one second.
  const onsets = log.filter((s, i) => s.flash && !log[i - 1]?.flash).map((s) => s.t)
  expect(onsets.length).toBeGreaterThan(0)
  for (const t of onsets)
    expect(onsets.filter((u) => u >= t && u < t + 1000).length).toBeLessThanOrEqual(2)
})

test('s02 below 1024 px plays on entry with Replay and requests no 3D', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'mobile project only')
  await page.goto('/kit/fig/s02')
  const fig = await ready(page)
  await expect(fig.locator('[data-action="replay"]')).toBeVisible()
  await expect
    .poll(async () => Number(await fig.evaluate((el) => el.style.getPropertyValue('--p'))))
    .toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  await expect(fig).toHaveAttribute('data-medium', 'svg')
  expect(await page.evaluate(() => document.documentElement.dataset.stageRuntime)).toBeUndefined()
})

test('s02 still tier shows the print and fetches no layers and no 3D', async ({ page, guard }) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (q.url().includes('/drawings/') && q.url().endsWith('.json')) fetched.push(q.url())
  })
  await gotoTier(page, '/kit/fig/s02', 'still')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await expect(fig.locator('img.still-img').filter({ visible: true })).toHaveCount(1)
  expect(fetched).toEqual([])
  expect(await page.evaluate(() => document.documentElement.dataset.stageRuntime)).toBeUndefined()
  expect(guard.errors).toEqual([])
})

// The /kit/fig harness is outside the a11y matrix (e2e/routes.ts), so the figure runs axe
// itself: no findings of any impact (W2), in the still tier, the svg tier mid-scan, at the
// hand-off frame and at idle.
for (const [tier, query] of [
  ['still', ''],
  ['svg', '?p=0.28'],
  ['svg', '?p=0.44'],
  ['svg', ''],
] as const) {
  test(`s02 has no axe findings (${tier}${query})`, async ({ page }) => {
    test.setTimeout(60_000)
    await gotoTier(page, `/kit/fig/s02${query}`, tier)
    const fig = page.locator(FIG)
    await fig.scrollIntoViewIfNeeded()
    if (tier === 'svg') await expect(fig).toHaveAttribute('data-layers', 'ready')
    if (tier === 'svg' && !query)
      await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 30_000 })
    const found = await axe(page)
    expect(describe(found)).toEqual([])
  })
}
