import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * S-06's WebGL gate on the gpu project (optional scene; SHIP.s06 stays 'svg' until it passes,
 * so every test runs it with ?ship=s06 on the /kit/fig/s06 harness, where p plays 0 → 1).
 *   hand-off inside the scrub window with every perf mark; the inspection loops run with the
 *   guard untripped and a median rAF ≤ 17.5 ms; context loss is back on SVG within 500 ms;
 *   five route round-trips leak nothing.
 *   npm run test:stage -- e2e/figures/s06.stage.spec.ts
 */

const FIG = '#fig-s06'
const URL = '/kit/fig/s06?tier=webgl&ship=s06'
type State = {
  renderer?: string
  dead?: boolean
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
}
const state = (page: Page) => page.evaluate(() => window.__aeStage?.state() as State | undefined)

async function handedOff(page: Page) {
  await page.goto(URL)
  await page.locator(FIG).scrollIntoViewIfNeeded()
  await expect(page.locator(FIG)).toHaveAttribute('data-stage', 'webgl', { timeout: 30_000 })
}

test('hands off in the scrub window on a hardware renderer', async ({ page, guard }) => {
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  const marks = await page.evaluate(() => performance.getEntries().map((e) => e.name))
  for (const m of ['3d:build:s06', '3d:compile:s06', '3d:ready:s06', '3d:handoff:s06'])
    expect(marks, m).toContain(m)
  // the months and the iso labels arrive as p plays on
  await expect(page.locator(FIG)).toHaveAttribute('data-labels', 'iso', { timeout: 10_000 })
  expect(guard.errors).toEqual([])
})

test('inspection loops: guard untripped, median rAF ≤ 17.5 ms', async ({ page, guard }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number[] }
    w.__raf = []
    let last = 0
    const tick = (t: number) => {
      const fig = document.querySelector<HTMLElement>('#fig-s06')
      if (last && fig?.dataset.stage === 'webgl') w.__raf.push(t - last)
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await handedOff(page)
  await page.waitForTimeout(12_000)
  const deltas = await page.evaluate(() => (window as unknown as { __raf: number[] }).__raf)
  const sorted = [...deltas].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? Infinity
  const s = await state(page)
  test.info().annotations.push({
    type: 'frames',
    description: JSON.stringify({ n: deltas.length, median, guard: s?.guard }),
  })
  expect(deltas.length).toBeGreaterThan(300)
  expect(s?.guard?.tripped).toBe(false)
  expect(median).toBeLessThanOrEqual(17.5)
  expect(guard.errors).toEqual([])
})

test('context loss: back on the SVG within 500 ms', async ({ page, guard }) => {
  await handedOff(page)
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>('#fig-s06')!
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
  expect(guard.errors).toEqual([])
})

test('five route round-trips: no leaks, one context', async ({ page, guard }) => {
  test.setTimeout(150_000)
  await page.goto(URL)
  await page.locator(FIG).scrollIntoViewIfNeeded()
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('s06'))
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL(/\/kit\/fig\/s06/)
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
