import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { ROUTES } from './routes'
import { cspViolations, watchCsp } from './helpers/console'
import { isProductionBuild, isReviewBuild } from './helpers/budgets'

/** Every sheet renders statically with one H1, one main, a skip link, Book a call and no errors. */

test.beforeEach(async ({ page }) => {
  await watchCsp(page)
})

for (const r of ROUTES) {
  test(`smoke ${r.path}`, async ({ page, guard }) => {
    const res = await page.goto(r.path)
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.h1)
    await expect(page.getByRole('main')).toHaveCount(1)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Book a call' })).toBeVisible()
    await expect(page.locator('main a[href*="/contact"][href$="#book"]').last()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
    expect(await cspViolations(page)).toEqual([])
    expect(guard.errors).toEqual([])
    expect(guard.blocked).toEqual([])
  })
}

// Review tags (HOLD clouds and chips, CONFIRM marks) only on a SHOW_HOLDS=1 build; every other
// build is the production look. /punch-list stays the owner's review list outside production.
test('review tags follow the build; /punch-list answers outside production', async ({ page }) => {
  const review = await isReviewBuild(page)
  let tags = 0
  for (const r of ROUTES) {
    await page.goto(r.path)
    const n = await page.locator('main [data-hold], main [data-confirm]').count()
    if (!review) expect(n, `review tags on ${r.path}`).toBe(0)
    tags += n
  }
  if (review) expect(tags).toBeGreaterThan(0)
  if (!(await isProductionBuild(page))) {
    const res = await page.goto('/punch-list')
    expect(res?.status()).toBe(200)
    expect(await page.locator('main table tbody tr').count()).toBeGreaterThan(0)
  }
})

test('motion switch persists and pauses before hydration', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[data-motion-switch]').filter({ visible: true }).first().check()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused')
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  await expect(
    page.locator('input[data-motion-switch]').filter({ visible: true }).first(),
  ).toBeChecked()
})

test('turning motion back on brings a page loaded paused back to the svg tier', async ({
  page,
}) => {
  await page.goto('/')
  const sw = page.locator('input[data-motion-switch]').filter({ visible: true }).first()
  await sw.check()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  await page.locator('input[data-motion-switch]').filter({ visible: true }).first().uncheck()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'run')
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'svg')
})

test('a forced still tier caps the tier at svg', async ({ page }) => {
  await page.goto('/?tier=still')
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  await expect(page.locator('html')).toHaveAttribute('data-tier-max', 'svg')
})

test('svg tier never loads three', async ({ page }) => {
  await page.goto('/?tier=svg')
  await page.waitForTimeout(3000)
  await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
})

test('reflow at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  for (const r of ROUTES) {
    await page.goto(r.path)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  }
})

test('five pages and the 404 are static', () => {
  const m = JSON.parse(readFileSync(join(__dirname, '../.next/prerender-manifest.json'), 'utf8'))
  for (const r of [...ROUTES.map((x) => x.path), '/_not-found'])
    expect(Object.keys(m.routes)).toContain(r)
})

test('unknown sheet gets the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-sheet')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/sheet not found/i)
})
