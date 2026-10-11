import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * The hero's WebGL gate (stage-hero §4.5, Appendix B §B10), on the gpu project only (real
 * Chrome, --use-angle=metal; a software renderer is never a pass):
 *   hand-off on the webgl tier with every perf mark; the frame guard never trips in 60 s and
 *   the median rAF is ≤ 17.5 ms; context loss is back on SVG within 500 ms; five route
 *   round-trips leak nothing and keep one context.
 *   npm run test:stage -- e2e/figures/hero.stage.spec.ts
 */

const FIG = '#fig-hero'
type State = {
  renderer?: string
  dead?: boolean
  frames?: number
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
}
const state = (page: Page) => page.evaluate(() => window.__aeStage?.state() as State | undefined)

async function handedOff(page: Page) {
  await page.goto('/?tier=webgl')
  await page.locator(FIG).scrollIntoViewIfNeeded()
  await expect(page.locator(FIG)).toHaveAttribute('data-stage', 'webgl', { timeout: 30_000 })
}

test('hands off on a hardware renderer, with every perf mark', async ({ page, guard }) => {
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer).toBeTruthy()
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  await expect(page.locator(FIG)).toHaveAttribute('data-medium', 'webgl')
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(1)
  const marks = await page.evaluate(() => performance.getEntries().map((e) => e.name))
  for (const m of [
    '3d:init',
    '3d:env',
    '3d:build:hero',
    '3d:compile:hero',
    '3d:ready:hero',
    '3d:handoff:hero',
  ])
    expect(marks, m).toContain(m)
  // the tilt ends on iso labels, then the loops run
  await expect(page.locator(FIG)).toHaveAttribute('data-labels', 'iso', { timeout: 5_000 })
  await expect(page.locator(FIG)).toHaveAttribute('data-rev', 'running', { timeout: 5_000 })
  expect(guard.errors).toEqual([])
})

test('60 s of mechanism: the guard never trips and the median rAF is at most 17.5 ms', async ({
  page,
  guard,
}) => {
  test.setTimeout(120_000)
  await handedOff(page)
  // sample rAF deltas while the machine runs; Run again at each idle keeps it running
  await page.evaluate(() => {
    const w = window as unknown as { __raf: number[] }
    w.__raf = []
    let last = 0
    const tick = (t: number) => {
      const fig = document.querySelector<HTMLElement>('#fig-hero')!
      if (last && fig.dataset.rev === 'running') w.__raf.push(t - last)
      last = t
      if (fig.dataset.rev === 'done')
        fig.querySelector<HTMLElement>('[data-action="again"]')?.click()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.waitForTimeout(60_000)
  const deltas = await page.evaluate(() => (window as unknown as { __raf: number[] }).__raf)
  const sorted = [...deltas].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? Infinity
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? Infinity
  const s = await state(page)
  test.info().annotations.push({
    type: 'frames',
    description: JSON.stringify({ n: deltas.length, median, p95, guard: s?.guard }),
  })
  expect(deltas.length).toBeGreaterThan(1500)
  expect(s?.guard?.tripped).toBe(false)
  expect(s?.dead).toBe(false)
  expect(median).toBeLessThanOrEqual(17.5)
  await expect(page.locator(FIG)).toHaveAttribute('data-medium', 'webgl')
  expect(guard.errors).toEqual([])
})

test('context loss: back on the SVG within 500 ms', async ({ page, guard }) => {
  await handedOff(page)
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>('#fig-hero')!
        const t0 = performance.now()
        const poll = () =>
          fig.dataset.stage === 'svg' && fig.dataset.medium === 'svg'
            ? resolve(performance.now() - t0)
            : requestAnimationFrame(poll)
        window.__aeStage!.loseContext()
        poll()
      }),
  )
  test.info().annotations.push({ type: 'contextLossMs', description: ms.toFixed(1) })
  expect(ms).toBeLessThanOrEqual(500)
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(0)
  // the SVG plan mechanism carries on
  const visible = await page.evaluate(
    () => getComputedStyle(document.querySelector('#fig-hero .drawing svg.l-cad')!).visibility,
  )
  expect(visible).toBe('visible')
  expect(guard.errors).toEqual([])
})

test('five route round-trips: no leaks, one context', async ({ page, guard }) => {
  test.setTimeout(150_000)
  await page.goto('/?tier=webgl')
  await page.locator(FIG).scrollIntoViewIfNeeded()
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('hero'))
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL((u) => u.pathname === '/')
    await page.locator(FIG).scrollIntoViewIfNeeded()
    await hold()
    const m = (await state(page))!.memory!
    seen.push(m)
    expect(Math.abs(m.geometries - base.geometries), JSON.stringify(seen)).toBeLessThanOrEqual(2)
    expect(Math.abs(m.textures - base.textures), JSON.stringify(seen)).toBeLessThanOrEqual(2)
  }
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(1)
  test.info().annotations.push({ type: 'memory', description: JSON.stringify({ base, seen }) })
  expect(guard.errors).toEqual([])
})
