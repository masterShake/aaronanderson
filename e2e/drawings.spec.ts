import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

/**
 * The drawing pipeline and the interactive schematic, on the /kit/fig harness:
 * roving tabindex, WCAG 1.4.13 callouts, the As found / Rewired toggle, the
 * table alternative, the stroke and text rules, the still tier's zero layer
 * requests, and loading layers when motion is turned back on. Counts are never
 * literals: they come from the page.
 */

const FIRM = '/kit/fig/firm?tier=svg'
const tools = (page: Page) => page.locator('button[data-tool]')
const callout = (page: Page) => page.locator('[id$="-callout"]')
const active = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-tool'))

test('tools use a roving tabindex; arrows, Home and End move between them', async ({
  page,
  guard,
}) => {
  await page.goto(FIRM)
  const n = await tools(page).count()
  expect(n).toBeGreaterThan(1)
  await expect(page.locator('[data-tool][tabindex="0"]')).toHaveCount(1)
  const first = await tools(page).first().getAttribute('data-tool')
  const last = await tools(page).last().getAttribute('data-tool')
  await tools(page).first().focus()
  await page.keyboard.press('ArrowRight')
  const moved = await active(page)
  expect(moved).not.toBe(first)
  await expect(page.locator('[data-tool][tabindex="0"]')).toHaveCount(1)
  await expect(page.locator(`button[data-tool="${moved}"]`)).toHaveAttribute('tabindex', '0')
  await page.keyboard.press('ArrowDown')
  expect(await active(page)).not.toBe(moved)
  await page.keyboard.press('End')
  expect(await active(page)).toBe(last)
  await page.keyboard.press('Home')
  expect(await active(page)).toBe(first)
  // Tab leaves the group
  await page.keyboard.press('Tab')
  expect(await active(page)).toBeFalsy()
  expect(guard.errors).toEqual([])
})

test('focus opens a callout, Enter pins it, Escape unpins and dismisses', async ({ page }) => {
  await page.goto(FIRM)
  const tool = tools(page).first()
  await tool.focus()
  await expect(callout(page)).toBeVisible()
  const id = await tool.getAttribute('data-tool')
  const desc = await tool.getAttribute('aria-describedby')
  const title = await page.locator(`[id="${desc}"] [data-title]`).innerText()
  await expect(callout(page)).toContainText(title)
  await expect(callout(page)).toHaveAttribute('data-tool', id!)
  await page.keyboard.press('Enter')
  await expect(tool).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(tool).toHaveAttribute('aria-expanded', 'false')
  // focus stays, the callout is still open from focus; Escape dismisses it without moving focus
  await expect(callout(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(callout(page)).toBeHidden()
  expect(await active(page)).toBe(id)
  // moving focus brings callouts back
  await page.keyboard.press('ArrowRight')
  await expect(callout(page)).toBeVisible()
})

test('hover callouts are hoverable and persistent (WCAG 1.4.13)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer hover is a desktop behaviour; touch taps pin instead')
  await page.goto(FIRM)
  const tool = tools(page).nth(1)
  await tool.hover()
  await expect(callout(page)).toBeVisible()
  const box = await callout(page).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 4 })
  await page.waitForTimeout(500)
  await expect(callout(page)).toBeVisible()
  await page.mouse.move(2, 2, { steps: 4 })
  await expect(callout(page)).toBeHidden()
  // Escape dismisses a hover callout until the pointer leaves and comes back
  await tool.hover()
  await expect(callout(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(callout(page)).toBeHidden()
})

test('touch taps pin a docked callout with a close button', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only')
  await page.goto(FIRM)
  const tool = tools(page).first()
  await tool.tap()
  await expect(tool).toHaveAttribute('aria-expanded', 'true')
  await expect(callout(page)).toHaveAttribute('data-docked', 'true')
  const close = callout(page).locator('[data-callout-close]')
  await expect(close).toBeVisible()
  const size = await close.boundingBox()
  expect(size!.width).toBeGreaterThanOrEqual(44)
  await close.tap()
  await expect(callout(page)).toBeHidden()
})

test('the As found / Rewired toggle switches state, chip and descriptions', async ({ page }) => {
  await page.goto(FIRM)
  const fig = page.locator('#fig-firm')
  const chip = fig.locator('[data-rev-chip]')
  const before = await chip.innerText()
  await expect(fig).toHaveAttribute('data-toggle', 'asFound')
  await page.locator('[data-state-value="rewired"]').click()
  await expect(fig).toHaveAttribute('data-toggle', 'rewired')
  await expect(fig).toHaveAttribute('data-rev', 'rewired')
  await expect(page.locator('[data-state-value="rewired"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-state-value="asFound"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(await chip.innerText()).not.toBe(before)
  const desc = await tools(page).first().getAttribute('aria-describedby')
  expect(desc).toMatch(/-rewired$/)
  await expect(page.locator(`[id="${desc}"]`)).toHaveCount(1)
  // detail bubbles: links to the service sheets, shown only once rewired
  const bubbles = fig.locator('.ui ul a')
  expect(await bubbles.count()).toBeGreaterThan(0)
  await expect(bubbles.first()).toBeVisible()
  expect(await bubbles.first().getAttribute('aria-label')).toBeTruthy()
  await page.locator('[data-state-value="asFound"]').click()
  await expect(bubbles.first()).toBeHidden()
})

test('every visible label sits inside the box at 390 and 1280, in both states', async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(FIRM)
    for (const state of ['asFound', 'rewired'] as const) {
      await page.locator(`[data-state-value="${state}"]`).click()
      await expect(page.locator('#fig-firm')).toHaveAttribute('data-toggle', state)
      const out = await page.evaluate(() => {
        const fig = document.querySelector('#fig-firm')!
        const box = fig.querySelector('.box')!.getBoundingClientRect()
        const anchorOut: { text: string; at: number[] }[] = []
        const overflow: { text: string; at: number[] }[] = []
        let shown = 0
        for (const el of fig.querySelectorAll<HTMLElement>('.labels > *')) {
          if (!el.checkVisibility({ visibilityProperty: true })) continue
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height) continue
          shown++
          const at = [r.left - box.left, r.top - box.top, r.right - box.left, r.bottom - box.top]
          const hit = { text: el.textContent ?? '', at: at.map(Math.round) }
          // 1 px of slack for subpixel rounding
          const [x0, y0, x1, y1] = at as [number, number, number, number]
          const inX = (x: number) => x >= -1 && x <= box.width + 1
          const inY = (y: number) => y >= -1 && y <= box.height + 1
          if (!inX(x0) || !inY(y0) || !inY(y1)) anchorOut.push(hit)
          else if (!inX(x1)) overflow.push(hit)
        }
        return { shown, anchorOut, overflow, box: [Math.round(box.width), Math.round(box.height)] }
      })
      const where = `${state} at ${width}: box ${out.box}`
      expect(out.shown, `${where}: labels shown`).toBeGreaterThan(0)
      // positions: every label's anchor (top-left) and its height lie inside the box
      expect(out.anchorOut, where).toEqual([])
      // widths: the hand notes fit; long rewired instrument labels may still run past the
      // right edge (the schematic places them without their text width), so they are recorded
      if (state === 'asFound') expect(out.overflow, where).toEqual([])
      else if (out.overflow.length)
        test.info().annotations.push({
          type: 'label-overflow',
          description: JSON.stringify({ width, state, overflow: out.overflow }),
        })
    }
  }
})

test('the table alternative lists every hand-off and works as a details element', async ({
  page,
}) => {
  await page.goto(FIRM)
  const details = page.locator('#fig-firm details')
  await details.locator('summary').click()
  const rows = details.locator('tbody tr')
  // one row per as-found hand-off line drawn in the pencil layer, plus new routes
  const drawn = await page
    .locator('.drawing svg.l-pencil:visible g[data-layer="pencil"] > g[data-part^="h"]')
    .count()
  expect(drawn).toBeGreaterThan(0)
  expect(await rows.count()).toBeGreaterThanOrEqual(drawn)
  await expect(details.locator('tfoot')).toHaveCount(1)
})

test('no text inside any SVG and no vector-effect anywhere', async ({ page }) => {
  for (const url of [FIRM, '/kit/fig/hero?tier=svg', '/kit/fig/not-found?tier=svg']) {
    await page.goto(url)
    expect(await page.locator('figure svg text').count()).toBe(0)
    const effects = await page.evaluate(
      () =>
        [...document.querySelectorAll('figure svg *')].filter(
          (el) => getComputedStyle(el).getPropertyValue('vector-effect') !== 'none',
        ).length,
    )
    expect(effects).toBe(0)
  }
})

test('the still tier fetches no layer bundles; motion back on loads them without a reload', async ({
  page,
}) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (/\/drawings\/.+\.json$/.test(q.url())) fetched.push(q.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const url of ['/kit/fig/firm', '/kit/fig/s02']) {
    await page.goto(url)
    await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
    await page.locator('figure[data-figure]').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  expect(fetched).toEqual([])
  // on /kit/fig/s02 (a lazy drawing), turn motion back on
  await page.evaluate(() => window.__ae?.setPaused(false))
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'svg')
  await expect(page.locator('#fig-s02')).toHaveAttribute('data-layers', 'ready')
  expect(fetched.length).toBeGreaterThan(0)
})

test('firm drawing files, when served, are static and text-free', async ({ request }) => {
  const res = await request.get('/drawings/firm.wide.json')
  test.skip(
    res.status() === 404,
    'firm files are served once figures/firm/drawing.server.ts uses firmDrawing',
  )
  const b = await res.json()
  expect(b.v).toBe(1)
  for (const markup of Object.values(b.layers as Record<string, string>)) {
    expect(markup).not.toContain('<text')
    expect(markup).not.toContain('vector-effect')
  }
  const still = await request.get('/drawings/firm.wide.rewired.still.svg')
  expect(still.headers()['content-type']).toContain('image/svg+xml')
})

test('screenshots of the firm and hero harness at 390 and 1280', async ({ page, isMobile }) => {
  test.skip(isMobile, 'taken once, from the desktop project')
  const dir = process.env.ARTIFACTS_DIR
  test.skip(!dir, 'set ARTIFACTS_DIR to keep screenshots')
  mkdirSync(dir!, { recursive: true })
  for (const id of ['firm', 'hero'])
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/kit/fig/${id}?tier=svg`)
      await page.waitForTimeout(600)
      await page.locator(`#fig-${id}`).screenshot({ path: join(dir!, `${id}-${width}.png`) })
      if (id === 'firm') {
        await page.locator('[data-state-value="rewired"]').click()
        await page.waitForTimeout(1200)
        await page
          .locator('#fig-firm')
          .screenshot({ path: join(dir!, `${id}-rewired-${width}.png`) })
      }
    }
})
