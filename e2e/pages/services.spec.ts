import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { artifactsDir } from '../helpers/budgets'
import { services } from '../../src/content/services'
import { servicesPage } from '../../src/content/pages/services'

/**
 * The Services sheet (S-00), lane w2/services acceptance:
 * one H1 and the CTA band last in main; the schedule is a real table that
 * stacks at 390 and reflows at 320; the rail is sticky only from 1280 and
 * nothing in main is sticky below 1024; at 1280 × 800 each figure column is
 * as tall as its text column (the scrub track); price chips and N.I.C. items
 * follow the build (SHOW_HOLDS=0 is the production-mode build); every Talk
 * link points at its sheet; the print view prints one sheet per page with
 * stills and URL suffixes (screenshot and PDF to $ARTIFACTS_DIR/print); CLS
 * at 390 stays under 0.05.
 */

const PROD = process.env.SHOW_HOLDS === '0'

const noHScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('one H1, and the CTA band is the last element in main', async ({ page, guard }) => {
  await page.goto('/services')
  await expect(page.locator('h1')).toHaveCount(1)
  const last = await page.evaluate(() => {
    // the page shell may wrap its sections (the sheet transition); JSON-LD scripts do not count
    const real = (el: Element) => [...el.children].filter((c) => c.tagName !== 'SCRIPT')
    let list = real(document.querySelector('main')!)
    while (list.length === 1 && !list[0]!.id) list = real(list[0]!)
    return list[list.length - 1]?.id ?? null
  })
  expect(last).toBe(servicesPage.closing.id)
  expect(guard.errors).toEqual([])
})

test('the schedule is a captioned table with header cells', async ({ page }) => {
  await page.goto('/services')
  const table = page.locator(`#${servicesPage.schedule.id} table`)
  await expect(table).toHaveCount(1)
  await expect(table.locator('caption')).toHaveText(servicesPage.schedule.caption)
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(5)
  await expect(table.locator('tbody th[scope="row"]')).toHaveCount(services.length)
})

for (const width of [390, 320]) {
  test(`schedule rows stack and nothing scrolls sideways at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/services')
    expect(await noHScroll(page)).toBe(true)
    const display = await page
      .locator(`#${servicesPage.schedule.id} tbody tr`)
      .first()
      .evaluate((el) => getComputedStyle(el).display)
    expect(display).toBe('block')
  })
}

test('at 1280 × 800 each figure column is as tall as its text column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/services')
  for (const s of services) {
    const m = await page.locator(`section#${s.slug}`).evaluate((sec) => {
      const track = sec.querySelector<HTMLElement>('[data-scrub-track]')!
      const fig = sec.querySelector<HTMLElement>('figure.fig')!
      const col = fig.parentElement!
      return {
        track: Math.round(track.getBoundingClientRect().height),
        col: Math.round(col.getBoundingClientRect().height),
        sticky: getComputedStyle(fig).position,
        top: getComputedStyle(fig).top,
      }
    })
    expect(m.col, `${s.id} figure column height`).toBe(m.track)
    expect(m.sticky, `${s.id} figure is sticky`).toBe('sticky')
  }
  // the rail is sticky at 1280 and the jump list is hidden
  const rail = page.locator(`nav[aria-label="${servicesPage.rail.label}"]`)
  await expect(rail).toBeVisible()
  expect(await rail.evaluate((el) => getComputedStyle(el).position)).toBe('sticky')
  await expect(page.locator(`nav[aria-label="${servicesPage.rail.jump}"]`)).toBeHidden()
})

test('at 1024 the jump list shows, not the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto('/services')
  await expect(page.locator(`nav[aria-label="${servicesPage.rail.jump}"]`)).toBeVisible()
  await expect(page.locator(`nav[aria-label="${servicesPage.rail.label}"]`)).toBeHidden()
})

for (const width of [1023, 768, 390]) {
  test(`nothing in main is sticky at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/services')
    const sticky = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => getComputedStyle(el).position === 'sticky')
        .map((el) => el.tagName + (el.id ? `#${el.id}` : '')),
    )
    expect(sticky).toEqual([])
  })
}

test('price chips and N.I.C. follow the build', async ({ page }) => {
  await page.goto('/services')
  for (const s of services.filter((x) => x.shape.price)) {
    const chip = page.locator(`section#${s.slug} [data-price-chip]`)
    await expect(chip).toHaveCount(1)
    const price = s.shape.price!
    const fallback = typeof price.value === 'string' ? price.value : price.value.prodFallback
    if (PROD) {
      await expect(chip.locator('[data-hold]')).toHaveCount(0)
      await expect(chip).toHaveText(fallback ?? '')
    } else {
      await expect(chip).toContainText(price.label)
      await expect(chip.locator('[data-hold]')).toHaveCount(1)
    }
  }
  const nic = page.locator(`#${servicesPage.nic.id}`)
  if (PROD) await expect(nic).toHaveCount(0)
  else
    await expect(nic.locator('li [data-confirm]')).toHaveCount(
      servicesPage.nic.items.filter((it) => it.status === 'pending').length,
    )
})

test('every Talk link points at its own sheet', async ({ page }) => {
  await page.goto('/services')
  for (const s of services) {
    const link = page.locator(`section#${s.slug} a[href^="/contact?sheet="]`)
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('href', `/contact?sheet=${s.id}#book`)
    await expect(link).toHaveAttribute('data-print-url', /\/contact\?sheet=S-0\d#book$/)
  }
})

test('print: one sheet per page, stills and URL suffixes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'printed once, from the desktop project')
  await page.goto('/services')
  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: 816, height: 1056 })
  // lazy stills load when printing for real; in emulation they are asked to load now
  await page.evaluate(() => {
    for (const img of document.querySelectorAll<HTMLImageElement>('img.still-img'))
      img.loading = 'eager'
  })
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>('img.still-img')]
      .filter((i) => i.getClientRects().length)
      .every((i) => i.complete && i.naturalWidth > 0),
  )
  for (const s of services) {
    const sec = page.locator(`section#${s.slug}`)
    expect(await sec.evaluate((el) => getComputedStyle(el).breakBefore)).toBe('page')
    const still = sec.locator('img.still-img').filter({ visible: true })
    await expect(still.first()).toBeVisible()
    expect(
      await sec.locator('figure .drawing').evaluate((el) => getComputedStyle(el).display),
    ).toBe('none')
    const suffix = await sec
      .locator('a[data-print-url]')
      .evaluate((a) => getComputedStyle(a, '::after').content)
    expect(suffix).toContain('/contact?sheet=')
  }
  await expect(page.locator(`nav[aria-label="${servicesPage.rail.jump}"]`)).toBeHidden()
  const dir = artifactsDir('print')
  const png = join(dir, `services-print${PROD ? '' : '-preview'}.png`)
  await page.screenshot({ path: png, fullPage: true })
  await info.attach('print', { path: png, contentType: 'image/png' })
  const pdf = join(dir, `services-print${PROD ? '' : '-preview'}.pdf`)
  await page.pdf({ path: pdf, format: 'Letter', printBackground: true })
  await info.attach('print-pdf', { path: pdf, contentType: 'application/pdf' })
})

test('layout shift at 390 stays under 0.05', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number }
    w.__cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number
        hadRecentInput: boolean
      })[])
        if (!e.hadRecentInput) w.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await gotoTier(page, '/services', 'svg')
  await page.waitForLoadState('load')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(1500)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
  expect(cls).toBeLessThan(0.05)
})
