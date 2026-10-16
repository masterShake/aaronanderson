import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { axe } from '../helpers/axe'
import { s03Figure as copy } from '../../src/content/figures/s03'
import { S03_COUNTS } from '../../src/drawings/views/s03'

/**
 * S-03, the reading machine (owner: scenes-b), on the /kit/fig/s03 harness:
 *   - with no interaction the batch ends at HELD FOR APPROVAL and stays there;
 *   - Approve updates the live region once and shows the approved state in the svg and
 *     still tiers; Run another resets it; Enter and Space both work; the target is ≥ 24 px;
 *   - below 1024 px nothing 3D is requested, the 2D phases play on entry, Replay is offered;
 *   - labels are at least 104 × 36 CSS px and inside the box at 440 px (wide) and 360 px (tall);
 *   - no <text> and no vector-effect; axe finds nothing in the held and approved states.
 */

const FIG = '#fig-s03'
const fill = (s: string) =>
  s.replace(/\{([a-zA-Z]+)(?::word)?\}/g, (m, k: string) =>
    k in S03_COUNTS ? String(S03_COUNTS[k as keyof typeof S03_COUNTS]) : m,
  )
const text = (v: unknown) => (typeof v === 'string' ? v : (v as { text: string }).text)
const APPROVED = fill(text(copy.live.approved))

const approveBtn = (page: Page) => page.locator(`${FIG} button[data-action="approve"]`)

async function atHeld(page: Page, fig: Locator) {
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-batch', 'held', { timeout: 20_000 })
  await expect(approveBtn(page)).toHaveAttribute('aria-disabled', 'false')
}

/** Counts text changes of the figure's live region from now on. */
async function watchLive(page: Page) {
  await page.evaluate((sel) => {
    const live = document.querySelector(`${sel} [data-live]`)!
    const w = window as unknown as { __liveChanges: string[] }
    w.__liveChanges = []
    new MutationObserver(() => w.__liveChanges.push(live.textContent ?? '')).observe(live, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  }, FIG)
  return () => page.evaluate(() => (window as unknown as { __liveChanges: string[] }).__liveChanges)
}

test('the batch stops at HELD FOR APPROVAL and nothing approves it', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s03', 'svg')
  const fig = page.locator(FIG)
  await expect(approveBtn(page)).toHaveAttribute('aria-disabled', 'true')
  await atHeld(page, fig)
  await page.waitForTimeout(4000)
  await expect(fig).toHaveAttribute('data-batch', 'held')
  await expect(fig).not.toHaveAttribute('data-rev', 'approved')
  await expect(fig.locator('.chip, [class*="chip"]').first()).toContainText(text(copy.ui.heldChip))
  expect(guard.errors).toEqual([])
})

for (const key of ['Enter', 'Space'] as const)
  test(`Approve with ${key}: one live update, approved state, Run another resets`, async ({
    page,
    guard,
  }) => {
    await gotoTier(page, '/kit/fig/s03', 'svg')
    const fig = page.locator(FIG)
    await atHeld(page, fig)
    const btn = approveBtn(page)
    const box = (await btn.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(24)
    expect(box.width).toBeGreaterThanOrEqual(24)
    await expect(btn).toHaveAccessibleName(copy.controls.approve)
    const changes = await watchLive(page)
    await btn.focus()
    await page.keyboard.press(key)
    await expect(fig).toHaveAttribute('data-rev', 'approved')
    await expect(fig.locator('[data-live]')).toHaveText(APPROVED)
    await page.waitForTimeout(500)
    expect(await changes()).toEqual([APPROVED])
    await expect(btn).toHaveAccessibleName(copy.controls.runAnother)
    await expect(btn).toBeFocused()
    await expect(fig.locator('[data-part="card.2"]').first()).toHaveCSS('opacity', '1')
    // Run another batch (demo): back to a running batch, then HELD again
    await page.keyboard.press(key)
    await expect(fig).not.toHaveAttribute('data-rev', 'approved')
    await expect(fig).toHaveAttribute('data-batch', 'run')
    await expect(btn).toHaveAttribute('aria-disabled', 'true')
    await atHeld(page, fig)
    expect(guard.errors).toEqual([])
  })

test('still tier: Approve swaps the held still for the approved one', async ({ page, guard }) => {
  const fetched: string[] = []
  page.on('request', (r) => fetched.push(r.url()))
  await gotoTier(page, '/kit/fig/s03', 'still')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-phase', 'still')
  const held = fig.locator('.still-wrap img[data-still="held"]:visible')
  const approved = fig.locator('.still-wrap img[data-still="approved"]:visible')
  await expect(held).toHaveCSS('opacity', '1')
  await expect(approveBtn(page)).toHaveAttribute('aria-disabled', 'false')
  await approveBtn(page).click()
  await expect(fig.locator('[data-live]')).toHaveText(APPROVED)
  await expect(approved).toHaveCSS('opacity', '1')
  await expect(held).toHaveCSS('opacity', '0')
  await approveBtn(page).click()
  await expect(held).toHaveCSS('opacity', '1')
  expect(fetched.filter((u) => /\/drawings\/s03\.[a-z]+\.json$/.test(u))).toEqual([])
  expect(fetched.filter((u) => /stage|three|runtime/i.test(u) && u.endsWith('.js'))).toEqual([])
  expect(guard.errors).toEqual([])
})

test('below 1024 px: no 3D, the 2D phases play on entry, Replay is offered', async ({
  page,
  guard,
}) => {
  const js: string[] = []
  page.on('response', async (r) => {
    if (!r.url().endsWith('.js')) return
    const body = await r.text().catch(() => '')
    if (/WebGLRenderer|stage-canvas/.test(body)) js.push(r.url())
  })
  await page.setViewportSize({ width: 800, height: 900 })
  await gotoTier(page, '/kit/fig/s03', 'webgl')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-mode', 'play')
  await expect(fig.locator('button[data-action="replay"]')).toBeVisible()
  await expect(fig).toHaveAttribute('data-batch', 'held', { timeout: 20_000 })
  expect(js).toEqual([])
  await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
  expect(guard.errors).toEqual([])
})

for (const [family, width] of [
  ['wide', 440],
  ['tall', 360],
] as const)
  test(`labels at ${width} px (${family}): at least 104 × 36, inside, apart`, async ({
    page,
    guard,
  }) => {
    await page.setViewportSize({ width: 1000, height: 900 })
    await gotoTier(page, '/kit/fig/s03?p=1', 'svg')
    await page.addStyleTag({ content: `${FIG}{inline-size:${width + 2}px}` })
    const fig = page.locator(FIG)
    await atHeld(page, fig)
    await expect(fig).toHaveAttribute('data-family', family)
    const r = await page.evaluate((sel) => {
      const f = document.querySelector(sel)!
      const b = f.querySelector('.box')!.getBoundingClientRect()
      return {
        box: { w: b.width, h: b.height },
        labels: [...f.querySelectorAll<HTMLElement>('.labels > [data-anchor]')]
          .filter((e) => getComputedStyle(e).visibility !== 'hidden')
          .map((e) => {
            const q = e.getBoundingClientRect()
            return {
              key: e.dataset.anchor!,
              x: q.left - b.left,
              y: q.top - b.top,
              w: q.width,
              h: q.height,
            }
          }),
        text: f.querySelectorAll('svg text').length,
        vectorEffect: f.innerHTML.includes('vector-effect'),
      }
    }, FIG)
    expect(Math.round(r.box.w)).toBe(width)
    expect(r.text).toBe(0)
    expect(r.vectorEffect).toBe(false)
    // one label per object: every label of the held state shows, the data card included
    expect(r.labels.map((l) => l.key).sort()).toEqual(
      ['card', 'hopper', 'output', 'reader', 'section', 'tolerance', 'tray'].sort(),
    )
    for (const l of r.labels) {
      // (sub-pixel slack: rects are measured after layout rounding)
      expect(l.w, `${l.key} width`).toBeGreaterThanOrEqual(104 - 0.01)
      expect(l.h, `${l.key} height`).toBeGreaterThanOrEqual(36 - 0.01)
      expect(l.x, `${l.key} left`).toBeGreaterThanOrEqual(0)
      expect(l.y, `${l.key} top`).toBeGreaterThanOrEqual(0)
      expect(l.x + l.w, `${l.key} right`).toBeLessThanOrEqual(r.box.w + 0.5)
      expect(l.y + l.h, `${l.key} bottom`).toBeLessThanOrEqual(r.box.h + 0.5)
    }
    for (let i = 0; i < r.labels.length; i++)
      for (let j = i + 1; j < r.labels.length; j++) {
        const a = r.labels[i]!
        const c = r.labels[j]!
        const hit = a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h
        expect(hit, `${a.key} overlaps ${c.key}`).toBe(false)
      }
    expect(guard.errors).toEqual([])
  })

test('p = 0 shows the whole pencil machine, never an empty panel', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s03?p=0', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  const sketch = await fig.evaluate((el) =>
    [...el.querySelectorAll<SVGPathElement>('svg.l-pencil g[data-rev="sketch"] path')].map((p) => ({
      o: Number(getComputedStyle(p).opacity),
      off: parseFloat(getComputedStyle(p).strokeDashoffset),
    })),
  )
  expect(sketch.length).toBeGreaterThan(0)
  for (const s of sketch) {
    expect(s.o).toBe(1)
    expect(s.off).toBeLessThanOrEqual(0.001)
  }
  expect(guard.errors).toEqual([])
})

test('the title strip is one row; Approve sits under the figure with a solid outline', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop project only')
  await page.setViewportSize({ width: 1000, height: 900 })
  await gotoTier(page, '/kit/fig/s03', 'svg')
  await page.addStyleTag({ content: `${FIG}{inline-size:532px}` })
  const fig = page.locator(FIG)
  await atHeld(page, fig)
  const strip = await fig.locator('.strip').boundingBox()
  expect(strip!.height).toBeLessThanOrEqual(49)
  const btn = approveBtn(page)
  const box = await fig.locator('.box').boundingBox()
  expect((await btn.boundingBox())!.y).toBeGreaterThan(box!.y + box!.height)
  await expect(btn).toHaveCSS('border-top-style', 'solid')
})

for (const tier of ['svg', 'still'] as const)
  test(`axe on the ${tier} tier, held and approved`, async ({ page, guard }) => {
    await gotoTier(page, '/kit/fig/s03', tier)
    const fig = page.locator(FIG)
    await atHeld(page, fig)
    expect(await axe(page)).toEqual([])
    await approveBtn(page).click()
    await expect(fig).toHaveAttribute('data-rev', 'approved')
    expect(await axe(page)).toEqual([])
    expect(guard.errors).toEqual([])
  })
