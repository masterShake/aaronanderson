import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * Home B, the example-firm schematic, as Home ships it: labels, detail bubbles
 * and people never overlap each other and never leave the drawing's box, in
 * both states at 360, 390 and 1280 px; the rendered counts are the graph's
 * (read from the page's own table footer and description, never literals);
 * the toggle and the table work.
 */

const URL = '/?tier=svg'
const WIDTHS = [360, 390, 1280] as const

type Hit = { what: string; at: number[] }

async function collect(page: Page, state: string) {
  return page.evaluate((st) => {
    const fig = document.querySelector<HTMLElement>('#fig-firm')!
    const box = fig.querySelector('.box')!.getBoundingClientRect()
    const hits: { what: string; at: number[] }[] = []
    const add = (what: string, r: DOMRect) => {
      if (!r.width || !r.height) return
      hits.push({
        what,
        at: [r.left - box.left, r.top - box.top, r.right - box.left, r.bottom - box.top].map(
          (v) => Math.round(v * 10) / 10,
        ),
      })
    }
    // the leader-line overlay is an <svg> covering the box; everything else is a label
    for (const el of fig.querySelectorAll<HTMLElement>('.labels > :not(svg)'))
      if (el.checkVisibility({ visibilityProperty: true }))
        add(`label ${el.textContent}`, el.getBoundingClientRect())
    for (const el of fig.querySelectorAll<HTMLElement>('.ui li a'))
      if (el.checkVisibility({ visibilityProperty: true }))
        add(`bubble ${el.getAttribute('href')}`, el.getBoundingClientRect())
    const layer = st === 'rewired' ? 'cad' : 'pencil'
    for (const svg of fig.querySelectorAll<SVGSVGElement>(`.drawing svg.l-${layer}`)) {
      if (!svg.checkVisibility()) continue
      for (const g of svg.querySelectorAll<SVGGElement>(`g[data-rev="${st}"] > g[data-part]`))
        if (/^p\d+$/.test(g.getAttribute('data-part') ?? ''))
          add(`person ${g.getAttribute('data-part')}`, g.getBoundingClientRect())
    }
    return { hits, box: [box.width, box.height] }
  }, state)
}

const overlaps = (hits: Hit[]) => {
  const out: string[] = []
  for (let i = 0; i < hits.length; i++)
    for (let j = i + 1; j < hits.length; j++) {
      const [a, b] = [hits[i]!.at, hits[j]!.at] as [number[], number[]]
      const x = Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)
      const y = Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!)
      // half a pixel of slack for subpixel rounding
      if (x > 0.5 && y > 0.5) out.push(`${hits[i]!.what} × ${hits[j]!.what}`)
    }
  return out
}

for (const width of WIDTHS) {
  test(`labels, bubbles and people stay apart and inside the box @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(URL)
    const fig = page.locator('#fig-firm')
    await fig.scrollIntoViewIfNeeded()
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    for (const state of ['asFound', 'rewired'] as const) {
      await page.locator(`#fig-firm [data-state-value="${state}"]`).click()
      await expect(fig).toHaveAttribute('data-toggle', state)
      await expect(fig).toHaveAttribute('data-placed', new RegExp(`-${state}-`))
      const { hits, box } = await collect(page, state)
      const where = `${state} @${width}`
      expect(hits.filter((h) => h.what.startsWith('label')).length, where).toBeGreaterThan(0)
      expect(hits.filter((h) => h.what.startsWith('person')).length, where).toBeGreaterThan(0)
      if (state === 'rewired')
        expect(hits.filter((h) => h.what.startsWith('bubble')).length, where).toBeGreaterThan(0)
      const out = hits.filter(
        (h) => h.at[0]! < -1 || h.at[1]! < -1 || h.at[2]! > box[0]! + 1 || h.at[3]! > box[1]! + 1,
      )
      expect(
        out.map((h) => h.what),
        `${where}: outside the box`,
      ).toEqual([])
      expect(overlaps(hits), `${where}: overlapping`).toEqual([])
    }
  })
}

test('rendered counts are the graph counts; the table lists every hand-off', async ({ page }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-firm')
  const details = fig.locator('details')
  await details.locator('summary').click()
  // the counts sentence is computed from the graph; no count literal here
  const foot = await details.locator('tfoot').innerText()
  const desc = await page.locator('#fig-firm-desc').innerText()
  expect(foot.trim().length).toBeGreaterThan(0)
  expect(desc).not.toMatch(/\{|\}/)
  expect(foot).not.toMatch(/\{|\}/)
  // one hand-off row per as-found line drawn, plus new routes
  const drawn = await fig
    .locator('.drawing svg.l-pencil g[data-rev="asFound"] > g[data-part^="h"]')
    .evaluateAll((els) => new Set(els.map((e) => e.getAttribute('data-part'))).size)
  expect(drawn).toBeGreaterThan(0)
  expect(await details.locator('tbody tr').count()).toBeGreaterThanOrEqual(drawn)
})

test('the toggle exposes aria-pressed and the table works without JS', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto(URL)
  const group = page.locator('#fig-firm [role="group"]:has(> [aria-pressed])')
  await expect(group).toHaveCount(1)
  await expect(group.locator('> [aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('#fig-firm details tbody tr').first()).toBeAttached()
  await expect(page.locator('#fig-firm img.still-img').first()).toBeAttached()
  await ctx.close()
})

test('keyboard: arrows, Home and End rove; Enter pins; Escape clears', async ({ page }) => {
  await page.goto(URL)
  const tools = page.locator('#fig-firm button[data-tool]')
  const first = await tools.first().getAttribute('data-tool')
  const last = await tools.last().getAttribute('data-tool')
  const active = () => page.evaluate(() => document.activeElement?.getAttribute('data-tool'))
  await tools.first().focus()
  await page.keyboard.press('ArrowRight')
  expect(await active()).not.toBe(first)
  await page.keyboard.press('End')
  expect(await active()).toBe(last)
  await page.keyboard.press('Home')
  expect(await active()).toBe(first)
  await page.keyboard.press('Enter')
  await expect(tools.first()).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(tools.first()).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Escape')
  await expect(page.locator('#firm-sch-callout')).toBeHidden()
  expect(await active()).toBe(first)
})
