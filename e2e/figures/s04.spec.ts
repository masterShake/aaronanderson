import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { axe, describe } from '../helpers/axe'

/**
 * S-04 (owner: scenes-a), on the /kit/fig harness until the services page hosts it.
 *   FIGURES=s02,s04 npm run test:figures
 */

test.skip(
  !!process.env.FIGURES && !process.env.FIGURES.split(',').includes('s04'),
  'FIGURES leaves s04 out',
)

const FIG = '#fig-s04'
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'desktop project only')

async function ready(page: Page) {
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  return fig
}

test('s04 draws its layers, with no <text> and no vector-effect', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s04', 'svg')
  const fig = await ready(page)
  expect(await fig.locator('svg.l-cad path').count()).toBeGreaterThan(0)
  expect(await fig.locator('svg.l-ghost g.tile').count()).toBe(5)
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

test('s04 dials read words only: no digits in the drawing, labels or answers', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s04', 'svg')
  const fig = await ready(page)
  // every text node in the box (labels, ui) and the answer card, outside <noscript>
  const text = await fig.evaluate((el) =>
    [...el.querySelectorAll('.box, [data-answers]')]
      .flatMap((root) => {
        const out: string[] = []
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let n = walk.nextNode(); n; n = walk.nextNode())
          if (!n.parentElement?.closest('noscript')) out.push(n.textContent ?? '')
        return out
      })
      .join(' '),
  )
  expect(text).not.toMatch(/\d/)
  const words = await fig.locator('.labels [data-dial] [data-v]').allTextContents()
  expect(new Set(words)).toEqual(new Set(['LOW', 'IN RANGE', 'CHECK']))
})

test('s04 chips answer at once in a polite live region, stamped SAMPLE', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s04', 'svg')
  const fig = await ready(page)
  const region = fig.locator('[data-answers]')
  await expect(region).toHaveAttribute('aria-live', 'polite')
  await expect(region.locator('[data-a]').filter({ visible: true })).toHaveCount(0)
  const chips = fig.locator('button[data-q]')
  await expect(chips).toHaveCount(3)
  await chips.nth(1).click()
  // instantly: no typewriter, the whole answer is there on the next check
  const shown = region.locator('[data-a]').filter({ visible: true })
  await expect(shown).toHaveCount(1, { timeout: 500 })
  await expect(shown).toContainText('SAMPLE')
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(fig).toHaveAttribute('data-cost', 'check')
  await expect(fig.locator('.labels [data-dial="cost"] [data-v="check"]')).toBeVisible()
})

for (const [family, width] of [
  ['wide', 440],
  ['tall', 360],
] as const) {
  test(`s04 tile labels are at least 104 × 36 px at ${width} px (${family})`, async ({ page }) => {
    desktopOnly()
    await gotoTier(page, '/kit/fig/s04?p=0.44', 'svg')
    const fig = await ready(page)
    await fig.evaluate((el, w) => {
      el.style.width = `${w + 2}px`
    }, width)
    await expect(fig).toHaveAttribute('data-family', family)
    const boxes = await fig
      .locator('.labels > [data-anchor^="tile."]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
    expect(boxes.length).toBe(5)
    for (const b of boxes) {
      expect(b.width).toBeGreaterThanOrEqual(104)
      expect(b.height).toBeGreaterThanOrEqual(36)
    }
  })
}

test('s04 runs three loops, settles the needles, then idles with Run again', async ({ page }) => {
  desktopOnly()
  test.setTimeout(60_000)
  await gotoTier(page, '/kit/fig/s04', 'svg')
  const fig = await ready(page)
  await expect(fig).toHaveAttribute('data-loop', '1', { timeout: 8000 })
  await expect(fig).toHaveAttribute('data-schedule', 'in', { timeout: 4000 })
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 25_000 })
  await expect(fig.locator('[data-action="run-again"]')).toBeVisible()
})

test('s04 below 1024 px plays on entry with Replay and requests no 3D', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'mobile project only')
  await page.goto('/kit/fig/s04')
  const fig = await ready(page)
  await expect(fig.locator('[data-action="replay"]')).toBeVisible()
  await expect
    .poll(async () => Number(await fig.evaluate((el) => el.style.getPropertyValue('--p'))))
    .toBeGreaterThan(0)
  await page.waitForTimeout(1000)
  await expect(fig).toHaveAttribute('data-medium', 'svg')
  expect(await page.evaluate(() => document.documentElement.dataset.stageRuntime)).toBeUndefined()
})

test('s04 still tier shows the still and the first answer, fetching no layers', async ({
  page,
  guard,
}) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (q.url().includes('/drawings/') && q.url().endsWith('.json')) fetched.push(q.url())
  })
  await gotoTier(page, '/kit/fig/s04', 'still')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await expect(fig.locator('img.still-img').filter({ visible: true })).toHaveCount(1)
  await expect(fig.locator('[data-answers] [data-a]').filter({ visible: true })).toHaveCount(1)
  expect(fetched).toEqual([])
  expect(await page.evaluate(() => document.documentElement.dataset.stageRuntime)).toBeUndefined()
  expect(guard.errors).toEqual([])
})

// The /kit/fig harness is outside the a11y matrix (e2e/routes.ts), so the figure runs axe
// itself: no findings of any impact (W2), still and svg tiers, with a chip pressed.
for (const [tier, query] of [
  ['still', ''],
  ['svg', '?p=0.33'],
  ['svg', '?p=0.5'],
] as const) {
  test(`s04 has no axe findings (${tier}${query})`, async ({ page }) => {
    await gotoTier(page, `/kit/fig/s04${query}`, tier)
    const fig = page.locator(FIG)
    await fig.scrollIntoViewIfNeeded()
    if (tier === 'svg') await expect(fig).toHaveAttribute('data-layers', 'ready')
    expect(describe(await axe(page))).toEqual([])
    await fig.locator('button[data-q]').first().click()
    await page.waitForTimeout(300)
    expect(describe(await axe(page))).toEqual([])
  })
}
