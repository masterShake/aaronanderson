import { test, expect } from '../fixtures'
import { isProductionBuild } from '../helpers/budgets'
import { about } from '../../src/content/pages/about'
import { people } from '../../src/content/people'

/**
 * About (G-02; owner: home-about): one H1, the sections in order with the CTA
 * band last, crew cards as title-block cells with their tags, general notes,
 * the org-chart toggle, and nothing sticky below 1024 px. In a production
 * build: no HOLD markers, and each card's heading falls back to the role.
 */

const SECTIONS = [
  about.crew.id,
  about.strata.id,
  about.notes.id,
  about.beliefs.id,
  about.orgChart.id,
  about.closing.id,
]

test('one H1; the sections in order; the CTA band last', async ({ page, guard }) => {
  await page.goto('/about')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText(about.h1)
  const ids = await page
    .locator('main section[id]')
    .evaluateAll((els) => els.map((e) => e.id).filter(Boolean))
  expect(ids.filter((id) => SECTIONS.includes(id))).toEqual(SECTIONS)
  expect(ids[ids.length - 1]).toBe(about.closing.id)
  expect(guard.errors).toEqual([])
})

test('crew cards: one per person, with the tags that apply', async ({ page }) => {
  await page.goto('/about')
  const cards = page.locator(`#${about.crew.id} li[data-person]`)
  await expect(cards).toHaveCount(people.people.length)
  for (let i = 0; i < people.people.length; i++) {
    const p = people.people[i]!
    for (const t of p.tags) await expect(cards.nth(i)).toContainText(about.crew.tags[t])
    await expect(cards.nth(i).locator('h3')).toHaveCount(1)
  }
})

test('the org chart toggle flips between the usual chain and ours', async ({ page }) => {
  await page.goto('/about')
  const fig = page.locator('#fig-org-chart')
  await fig.scrollIntoViewIfNeeded()
  const group = fig.locator('[role="group"]:has(> [aria-pressed])')
  await expect(group).toHaveCount(1)
  const usual = group.getByRole('button', { name: about.orgChart.toggle.usual })
  const ours = group.getByRole('button', { name: about.orgChart.toggle.ours })
  await usual.click()
  await expect(usual).toHaveAttribute('aria-pressed', 'true')
  await expect(fig).toHaveAttribute('data-toggle', 'chain')
  await ours.click()
  await expect(ours).toHaveAttribute('aria-pressed', 'true')
  await expect(fig).toHaveAttribute('data-toggle', 'ours')
})

test('without JS the org chart shows ours and the toggle is server-rendered', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/about')
  const fig = page.locator('#fig-org-chart')
  await expect(fig).toHaveAttribute('data-toggle', 'ours')
  await expect(fig.locator('[role="group"] > [aria-pressed="true"]')).toHaveText(
    about.orgChart.toggle.ours,
  )
  await ctx.close()
})

for (const width of [360, 390, 768, 1023]) {
  test(`nothing on About is sticky inside main @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/about')
    const sticky = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => getComputedStyle(el).position === 'sticky')
        .map((el) => el.tagName),
    )
    expect(sticky).toEqual([])
  })
}

test('production: no HOLD markers; card headings fall back to the role', async ({ page }) => {
  await page.goto('/about')
  test.skip(!(await isProductionBuild(page)), 'needs a VERCEL_ENV=production build')
  await expect(page.locator('main [data-hold]')).toHaveCount(0)
  const headings = page.locator(`#${about.crew.id} li[data-person] h3`)
  for (let i = 0; i < people.people.length; i++) {
    const role = people.people[i]!.role
    const expected = typeof role === 'string' ? role : role.prodFallback
    if (expected) await expect(headings.nth(i)).toHaveText(expected)
  }
  // rows with nothing to show are left out
  await expect(page.getByText(about.crew.askLabel)).toHaveCount(0)
})
