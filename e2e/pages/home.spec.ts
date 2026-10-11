import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { isProductionBuild } from '../helpers/budgets'
import { home } from '../../src/content/pages/home'
import { people } from '../../src/content/people'
import { processSteps } from '../../src/content/process'
import { services } from '../../src/content/services'

/**
 * Home sections B to G (owner: home-about): no H1 of their own, the CTA band
 * last, nothing sticky below 1024 px, the sheet index and its key plans, one
 * "You:" line per step, one card per crew member, and as-builts in preview
 * only. Expectations come from content, never from literals.
 */

const SECTIONS = [
  home.wiring.id,
  home.sheetIndex.id,
  home.process.id,
  home.crew.id,
  home.asBuilts.id,
  home.closing.id,
]

test('sections B to G render no H1; the page ends with the CTA band', async ({ page, guard }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveCount(1)
  for (const id of SECTIONS) await expect(page.locator(`main #${id} h1`)).toHaveCount(0)
  const last = await page
    .locator('main section')
    .last()
    .evaluate((el) => el.id)
  expect(last).toBe(home.closing.id)
  expect(guard.errors).toEqual([])
})

async function stickyBelow(page: Page) {
  return page.evaluate((ids) => {
    const out: string[] = []
    for (const id of ids) {
      const root = document.getElementById(id)
      if (!root) continue
      for (const el of [root, ...root.querySelectorAll('*')])
        if (getComputedStyle(el).position === 'sticky') out.push(`${id} ${el.tagName}`)
    }
    return out
  }, SECTIONS)
}

for (const width of [360, 390, 768, 1023]) {
  test(`nothing in B to G is sticky @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    expect(await stickyBelow(page)).toEqual([])
  })
}

test('the sheet index: rows link to the sheets, S-01 starts here, hover shows a key plan', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  const section = page.locator(`#${home.sheetIndex.id}`)
  const rows = section.locator('tbody tr[data-sheet]')
  await expect(rows).toHaveCount(services.length)
  for (const sv of services)
    await expect(section.locator(`tr[data-sheet="${sv.id}"] a[href]`)).toHaveCount(1)
  await expect(rows.first()).toContainText(home.sheetIndex.startHere)
  test.skip(isMobile, 'the key-plan panel shows from 1024 px')
  const plan = (id: string) => section.locator(`[data-plan="${id}"]`)
  await expect(plan(services[0]!.id)).toBeVisible()
  const other = services[1]!.id
  await section.locator(`tr[data-sheet="${other}"]`).hover()
  await expect(plan(other)).toBeVisible()
  await expect(plan(services[0]!.id)).toBeHidden()
  // keyboard focus picks the plan too
  await page.mouse.move(0, 0)
  await section.locator(`tr[data-sheet="${services[2]!.id}"] a`).focus()
  await expect(plan(services[2]!.id)).toBeVisible()
})

test('the process strip has one "You:" line per step and links to How it works', async ({
  page,
}) => {
  await page.goto('/')
  const section = page.locator(`#${home.process.id}`)
  await expect(section.locator('li')).toHaveCount(processSteps.length)
  await expect(section.getByText(home.process.youPrefix, { exact: false })).toHaveCount(
    processSteps.length,
  )
  await expect(section.locator(`a[href="${home.process.link.href}"]`)).toHaveCount(1)
})

test('the crew: one card per person, APPROVED BY: YOU, and a link to About', async ({ page }) => {
  await page.goto('/')
  const section = page.locator(`#${home.crew.id}`)
  await expect(section.locator('li[data-person]')).toHaveCount(people.people.length)
  await expect(section).toContainText(home.crew.approvedBy.value)
  await expect(section.locator(`a[href="${home.crew.link.href}"]`)).toHaveCount(1)
})

test('preview: as-builts show HOLD clouds; production: no proof, no HOLD, names fall back', async ({
  page,
}) => {
  await page.goto('/')
  const prod = await isProductionBuild(page)
  const asBuilts = page.locator(`#${home.asBuilts.id}`)
  if (!prod) {
    await expect(asBuilts).toHaveCount(1)
    expect(await asBuilts.locator('[data-hold]').count()).toBeGreaterThan(0)
    return
  }
  await expect(asBuilts).toHaveCount(0)
  await expect(page.locator('main [data-hold]')).toHaveCount(0)
  // names are essential HOLDs with no fallback: each card's heading is its role
  const headings = page.locator(`#${home.crew.id} li[data-person] h3`)
  await expect(headings).toHaveCount(people.people.length)
  for (let i = 0; i < people.people.length; i++) {
    const role = people.people[i]!.role
    const expected = typeof role === 'string' ? role : role.prodFallback
    if (expected) await expect(headings.nth(i)).toHaveText(expected)
  }
})
