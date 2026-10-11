import { gzipSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { freezeAt } from '../helpers/freeze'

/**
 * The hero (D2 A, lane w2/hero): the words, the one H1, the inline drawing's weight, the
 * storyboard states (frozen at storyboard ms), the reduced-motion still, Pause, the mobile
 * entry gate, label sizes and Run again. Desktop and mobile projects; never the GPU.
 */

const FIG = '#fig-hero'

const visible = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return cs.visibility === 'visible' && cs.display !== 'none' && r.width > 0 && r.height > 0
  }, sel)

test('home has exactly one H1, in the hero, with the sign-off line right under it', async ({
  page,
  guard,
}) => {
  await gotoTier(page, '/', 'svg')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('#hero h1')).toHaveCount(1)
  const next = await page.evaluate(() => document.querySelector('#hero h1')?.nextElementSibling)
  expect(next).not.toBeNull()
  expect(await page.locator('#hero h1 + p').innerText()).toContain('sign off')
  expect(guard.errors).toEqual([])
})

test('the LCP element is the H1 or the deck, never the figure', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: string[] }
    w.__lcp = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { element?: Element })[]) {
        const el = e.element
        w.__lcp.push(
          el ? `${el.tagName.toLowerCase()}${el.closest('figure') ? ' in-figure' : ''}` : 'none',
        )
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await gotoTier(page, '/', 'svg')
  await page.waitForTimeout(1500)
  // LCP stops at the first input; read the last candidate
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: string[] }).__lcp)
  const last = lcp[lcp.length - 1] ?? ''
  expect(last, JSON.stringify(lcp)).not.toContain('in-figure')
  expect(['h1', 'p', 'div']).toContain(last.split(' ')[0])
})

test('the inline drawing (both families) stays under 15 KB gzip', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const html = await page.evaluate((s) => {
    const f = document.querySelector(s)!
    return f.querySelector('.drawing')!.outerHTML + f.querySelector('.still-wrap')!.outerHTML
  }, FIG)
  const kb = gzipSync(html, { level: 9 }).length / 1024
  test.info().annotations.push({ type: 'heroInlineGzKB', description: kb.toFixed(2) })
  expect(kb).toBeLessThanOrEqual(15)
})

test('storyboard: sketch, scan, REV 1 at the decision, the mechanism, then the idle print', async ({
  page,
  isMobile,
}) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const chip = async () =>
    page.evaluate(
      (s) =>
        [...document.querySelectorAll<HTMLElement>(`${s} [data-chip]`)]
          .filter((c) => getComputedStyle(c).visibility === 'visible')
          .map((c) => c.dataset.chip),
      FIG,
    )
  await freezeAt(page, 0)
  expect(await chip()).toEqual(['asFound'])
  await freezeAt(page, 3000)
  expect(await chip()).toEqual(['rewired'])
  await freezeAt(page, 9000)
  expect(await chip()).toEqual(['running'])
  expect(
    await visible(page, `${FIG} .drawing svg.l-pkt[data-family="${isMobile ? 'tall' : 'wide'}"]`),
  ).toBe(true)
  await freezeAt(page, 25000)
  expect(await chip()).toEqual(['done'])
  await expect(fig.locator('[data-action="again"]')).toBeVisible()
  const iso = fig.locator(`.drawing svg.l-iso[data-family="${isMobile ? 'tall' : 'wide'}"]`)
  await expect(iso).toHaveCSS('opacity', '1')
})

test('people, lines and tools come from the graph: 3 people, at most 4 hand notes', async ({
  page,
  isMobile,
}) => {
  await gotoTier(page, '/', 'svg')
  const fam = isMobile ? 'tall' : 'wide'
  const svg = page.locator(`${FIG} .drawing svg.l-pencil[data-family="${fam}"]`)
  await expect(svg.locator('g.k-person')).toHaveCount(3)
  await expect(svg.locator('g.k-box')).toHaveCount(isMobile ? 6 : 7)
  await expect(svg.locator('g.k-line')).toHaveCount(isMobile ? 8 : 9)
  expect(await page.locator(`${FIG} .note`).count()).toBeLessThanOrEqual(4)
  expect(await page.locator(`${FIG} svg text`).count()).toBe(0)
})

test('every tool box is at least 104 × 36 CSS px at 520 px (wide) and 360 px (tall)', async ({
  page,
}) => {
  await gotoTier(page, '/kit/fig/hero', 'svg')
  for (const [w, fam] of [
    [520, 'wide'],
    [360, 'tall'],
  ] as const) {
    await page.evaluate((w) => {
      const f = document.getElementById('fig-hero')!
      // the container (the figure's content box) is w px wide
      f.style.boxSizing = 'content-box'
      f.style.inlineSize = `${w}px`
    }, w)
    await page.waitForTimeout(150)
    const sizes = await page.evaluate((fam) => {
      const s = document.querySelector(`#fig-hero .drawing svg.l-pencil[data-family="${fam}"]`)!
      return [...s.querySelectorAll('.k-box path.f-paper')].map((p) => {
        const r = p.getBoundingClientRect()
        return [r.width, r.height]
      })
    }, fam)
    expect(sizes.length).toBeGreaterThan(0)
    for (const [bw, bh] of sizes) {
      expect(bw).toBeGreaterThanOrEqual(104)
      expect(bh).toBeGreaterThanOrEqual(36)
    }
  }
})

test('reduced motion: the iso print, AS FOUND inset and Play the drawing; nothing runs, no canvas', async ({
  page,
}) => {
  const chunks: string[] = []
  page.on('request', (r) => {
    if (/three|runtime|scenes/.test(r.url())) chunks.push(r.url())
  })
  await gotoTier(page, '/', 'still')
  const fig = page.locator(FIG)
  await expect(fig).toHaveAttribute('data-phase', 'still')
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const running = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === 'running').length,
    FIG,
  )
  expect(running).toBe(0)
  await expect(page.locator(`${FIG} canvas.stage-canvas`)).toHaveCount(0)
  await expect(fig.locator('.still-wrap')).toBeVisible()
  await expect(fig.locator('.still-wrap svg').first()).toBeAttached()
  await expect(fig.locator('[data-action="play"]')).toBeVisible()
  await expect(fig.locator('[data-action="again"]')).toBeHidden()
  const iso = await page.evaluate((s) => {
    const svgs = [...document.querySelectorAll<SVGElement>(`${s} .drawing svg.l-iso`)]
    return svgs.some(
      (v) => getComputedStyle(v).display !== 'none' && getComputedStyle(v).opacity === '1',
    )
  }, FIG)
  expect(iso).toBe(true)
  // Play the drawing runs the figure (figure-scoped; nothing is stored)
  await fig.locator('[data-action="play"]').click()
  await expect(fig).toHaveAttribute('data-user-play', '')
  const stored = await page.evaluate(() => localStorage.getItem('ae:motion'))
  expect(stored).toBeNull()
  expect(chunks).toEqual([])
})

test('Pause stops every hero animation', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await fig.locator('input[data-motion-switch]').check()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused')
  const states = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .filter((a) => a instanceof CSSAnimation)
        .map((a) => a.playState),
    FIG,
  )
  expect(states.length).toBeGreaterThan(0)
  expect(states.filter((x) => x === 'running')).toEqual([])
  await fig.locator('input[data-motion-switch]').uncheck()
})

test('phones wait for the figure to be 40% visible before it starts', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the entry gate holds below 1024 px')
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  const gate = () =>
    page.evaluate(
      (s) => getComputedStyle(document.querySelector(s)!).getPropertyValue('--gate'),
      FIG,
    )
  await expect(fig).toHaveAttribute('data-armed', '')
  if ((await fig.getAttribute('data-inview')) === null) expect(await gate()).toBe('paused')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-inview', '')
  expect(await gate()).toBe('running')
})

test('Run again replays the mechanism, not the sketch', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await freezeAt(page, 25000)
  await fig.locator('[data-action="again"]').click()
  const t = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .find((a) => a instanceof CSSAnimation)?.currentTime,
    FIG,
  )
  expect(Number(t)).toBeGreaterThan(2900)
  expect(Number(t)).toBeLessThan(4000)
  await expect(fig.locator('[data-action="again"]')).toBeHidden()
})
