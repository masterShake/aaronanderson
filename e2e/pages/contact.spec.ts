import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { axe, describe as describeFindings } from '../helpers/axe'
import { isProductionBuild } from '../helpers/budgets'

/**
 * /contact as a page (G-03): structure, the no-JS round trip, the error and
 * success states under axe (zero findings of any impact) at 390 and 1280,
 * and, on a VERCEL_ENV=production build, the no-scheduler layout.
 */

let ip = 0
async function fresh(page: Page) {
  ip += 1
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.8.${process.pid % 250}.${ip}` })
}

test('one H1, the sections in order, and the CTA band last', async ({ page, guard }) => {
  await page.goto('/contact')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText('Pick a time. Bring the spreadsheet.')
  const ids = await page.locator('main section[id]').evaluateAll((els) => els.map((e) => e.id))
  expect(ids.at(-1)).toBe('call')
  for (const id of ['write', 'email', 'next', 'privacy']) expect(ids).toContain(id)
  expect(ids.filter((i) => i === 'book').length).toBe(1)
  await expect(page.locator('#fig-after-contact')).toHaveCount(1)
  // the honeypot is inert and hidden from assistive tech
  await expect(page.locator('#extra_notes')).toHaveAttribute('tabindex', '-1')
  await expect(page.locator('[inert][aria-hidden="true"]:has(#extra_notes)')).toHaveCount(1)
  // "Show available times" is never inside the form
  await expect(page.locator('form button[type="button"]')).toHaveCount(0)
  expect(guard.errors).toEqual([])
})

test('the drawing files for the success state and the figure are served', async ({ request }) => {
  for (const f of [
    'after-contact.wide.json',
    'after-contact.tall.json',
    'after-contact.wide.flow.still.svg',
    'after-contact.tall.flow.still.svg',
    'after-contact.wide.received.still.svg',
  ]) {
    const r = await request.get(`/drawings/${f}`)
    expect(r.status(), f).toBe(200)
  }
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a POST returns the validation errors and the submitted values', async ({ page }) => {
    await fresh(page)
    await page.goto('/contact')
    await expect(page.locator('#f-sheet')).toHaveCount(1)
    await page.locator('#f-name').fill('Ana Ruiz')
    await page.locator('#f-email').fill('ana@example.com')
    await page.locator('#f-company').fill('Ruiz Build')
    await page.locator('#f-sheet').selectOption('S-02')
    // long enough for the browser's minlength, too short once the server trims it
    await page.locator('#f-message').fill(`Too short${' '.repeat(30)}`)
    await page.getByRole('button', { name: 'Send it' }).click()
    await page.waitForLoadState('load')
    const summary = page.locator('#form-errors')
    await expect(summary).toBeVisible()
    await expect(summary.getByRole('link')).toHaveText([/What's being retyped\?/])
    await expect(page.locator('#f-message-err')).toHaveText('Write at least 20 characters.')
    await expect(page.locator('#f-name')).toHaveValue('Ana Ruiz')
    await expect(page.locator('#f-email')).toHaveValue('ana@example.com')
    await expect(page.locator('#f-company')).toHaveValue('Ruiz Build')
    // the streamed ?sheet reader cannot swap in without JS: the form keeps its own select
    await expect(page.locator('form select[name="sheet"]')).toHaveValue('S-02')
  })

  test('a valid POST shows the success panel', async ({ page }) => {
    await fresh(page)
    await page.goto('/contact')
    await page.locator('#f-name').fill('Ana Ruiz')
    await page.locator('#f-email').fill(`ana.${Date.now()}@example.com`)
    await page.locator('#f-message').fill('The weekly cost report is retyped from three sheets.')
    await page.getByRole('button', { name: 'Send it' }).click()
    await page.waitForLoadState('load')
    await expect(page.locator('[role="status"]').filter({ hasText: 'Received.' })).toContainText(
      'Thanks, Ana Ruiz.',
    )
  })
})

for (const width of [390, 1280]) {
  test.describe(`axe @${width}`, () => {
    test.use({ viewport: { width, height: width < 768 ? 844 : 800 } })

    const clean = async (page: Page, state: string) => {
      const found = await axe(page)
      expect(describeFindings(found), `${state} @${width}`).toEqual([])
    }

    test('default, error and success states have no findings', async ({ page }) => {
      await fresh(page)
      await page.goto('/contact?tier=svg')
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await clean(page, 'default')

      await page.getByRole('button', { name: 'Send it' }).click()
      await expect(page.locator('#form-errors')).toBeFocused()
      await clean(page, 'error')

      await page.locator('#f-name').fill('Lee Park')
      await page.locator('#f-email').fill(`lee.${width}.${Date.now()}@example.com`)
      await page.locator('#f-company').fill('A company name that runs well past the node width')
      await page.locator('#f-message').fill('Purchase orders get retyped into the accounting tool.')
      await page.getByRole('button', { name: 'Send it' }).click()
      await expect(page.locator('[role="status"]').filter({ hasText: 'Received.' })).toBeVisible()
      await page.waitForTimeout(1_600)
      await clean(page, 'success')
      // the page still scrolls at exactly the viewport width
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    })
  })
}

test('production build without a scheduler: #book is the form', async ({ page }) => {
  test.skip(!(await isProductionBuild(page)), 'needs a VERCEL_ENV=production build')
  await page.goto('/contact')
  await expect(page.locator('[data-book]')).toHaveCount(0)
  const book = page.locator('section#book')
  await expect(book).toHaveCount(1)
  await expect(book.locator('form')).toHaveCount(1)
  await expect(book.locator('h2')).toHaveText("Tell us what's being retyped.")
  await expect(page.locator('#write')).toHaveCount(0)
})
