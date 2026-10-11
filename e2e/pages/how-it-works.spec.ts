import { test, expect } from '../fixtures'
import { processSteps } from '../../src/content/process'
import { glossary } from '../../src/content/legend'
import { faq } from '../../src/content/faq'

/**
 * How It Works (P-00): one H1 and the CTA last; the ticket's revision follows
 * the steps; stamps in D4 order; the legend and its glossary; the FAQ as
 * native <details>; plates as CONFIRMs; nothing sticky below 1024 px, no
 * horizontal scroll at 320 px, and little layout shift at 390 px.
 */

const PAGE = '/how-it-works'
const STAMPS = [
  'EXISTING CONDITIONS',
  'ISSUED FOR REVIEW',
  'ISSUED FOR CONSTRUCTION',
  'AS-BUILT',
  'IN SERVICE',
]

test('one H1, and the page ends with the CTA band', async ({ page, guard }) => {
  await page.goto(PAGE)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  const last = await page.evaluate(() => {
    const kids = [...document.querySelectorAll('main section')]
    return kids[kids.length - 1]?.id
  })
  expect(last).toBe('call')
  expect(guard.errors).toEqual([])
})

test('scrolling each step past 55% sets the ticket to its revision', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sticky ticket is a desktop figure; phones get a still per step')
  await page.goto(`${PAGE}?tier=svg`)
  const fig = page.locator('#fig-ticket')
  await expect(fig).toHaveAttribute('data-rev', 'rev0')
  for (let i = 0; i < processSteps.length; i++) {
    const id = processSteps[i]!.id.toLowerCase()
    // put the step's top at 40% of the viewport, above the 55% line
    await page.evaluate((sid) => {
      const el = document.getElementById(sid)!
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - innerHeight * 0.4)
    }, id)
    await expect(fig).toHaveAttribute('data-rev', `rev${i}`)
    await expect(fig.locator('[data-rev-chip]')).toHaveText(/REV/)
  }
  // the last step sets the last revision, and its chip follows
  await expect(fig).toHaveAttribute('data-rev', 'rev4')
  await expect(fig.locator('[data-rev-chip]')).toContainText('IN SERVICE')
  // scrolling back up reverses it
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(fig).toHaveAttribute('data-rev', 'rev0')
})

test('stamps in D4 order; legend with all thirteen glossary terms', async ({ page }) => {
  await page.goto(PAGE)
  const stamps = await page.locator('main section[data-rev-value] .stamp').allInnerTexts()
  expect(stamps.map((s) => s.trim().toUpperCase())).toEqual(STAMPS)
  await expect(page.locator('#legend')).toHaveCount(1)
  for (const g of glossary) await expect(page.locator(`#legend #term-${g.id}`)).toHaveCount(1)
  expect(await page.locator('#legend [id^="term-"]').count()).toBe(13)
})

test('FAQ items open and close with the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard check runs on desktop')
  await page.goto(PAGE)
  const items = page.locator('#faq details')
  expect(await items.count()).toBeGreaterThan(0)
  expect(await items.count()).toBeLessThanOrEqual(faq.length)
  const first = items.first()
  const summary = first.locator('summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('open', '')
  await page.keyboard.press('Space')
  await expect(first).not.toHaveAttribute('open', '')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('FAQ items still open and close', async ({ page }) => {
    await page.goto(PAGE)
    const first = page.locator('#faq details').first()
    await first.locator('summary').click()
    await expect(first).toHaveAttribute('open', '')
    await first.locator('summary').click()
    await expect(first).not.toHaveAttribute('open', '')
  })
})

test('plates and promising answers carry their CONFIRM mark in preview', async ({ page }) => {
  await page.goto(PAGE)
  const plates = page.locator('#sign-off [data-plate]')
  const n = await plates.count()
  // preview shows all five, each marked; a production build shows only confirmed ones
  if (n === 5) await expect(page.locator('#sign-off [data-plate] [data-confirm]')).toHaveCount(5)
  else expect(await page.locator('#sign-off [data-confirm]').count()).toBe(0)
  await page
    .locator('#faq details')
    .evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)))
  if (n === 5) expect(await page.locator('#faq [data-confirm]').count()).toBeGreaterThan(0)
})

test('nothing sticky below 1024 px; no horizontal scroll at 320 px', async ({ page }) => {
  for (const width of [320, 390, 1000]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(PAGE)
    const sticky = await page.evaluate(
      () =>
        [...document.querySelectorAll('main *')].filter((el) => {
          const cs = getComputedStyle(el)
          return cs.position === 'sticky' && (el as HTMLElement).offsetParent !== null
        }).length,
    )
    expect(sticky, `sticky elements at ${width}`).toBe(0)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(sw, `scroll width at ${width}`).toBe(width)
  }
})

test('below 1024 px each step shows its own still of the ticket', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PAGE)
  await expect(page.locator('#fig-ticket')).toBeHidden()
  for (let i = 0; i < processSteps.length; i++) {
    const img = page.locator(`#${processSteps[i]!.id.toLowerCase()} figure img`)
    await expect(img).toHaveAttribute('src', new RegExp(`ticket\\.tall\\.rev${i}\\.still\\.svg$`))
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  }
})

test('layout shift at 390 px stays under 0.05', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PAGE)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
  })
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let sum = 0
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          })[])
            if (!e.hadRecentInput) sum += e.value
        }).observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => resolve(sum), 300)
      }),
  )
  expect(cls).toBeLessThanOrEqual(0.05)
})
