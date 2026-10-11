import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * The S-02 WebGL quality gate (stage-hero §4.5, PLAN Verification), on the gpu project
 * (real Chrome, --use-angle=metal). The seam is e2e/seam.spec.ts (src/figures/s02/seam.ts);
 * the chunk sizes are `npm run perf:3d`.
 *
 *   npm run test:stage -- e2e/figures/s02.stage.spec.ts
 */

const FIG = '#fig-s02'
const PATH = '/kit/fig/s02?tier=webgl&p=0.44'
type State = {
  renderer?: string
  dead?: boolean
  frames?: number
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
  figs?: { scene: string; arm: string; stage: string }[]
}
const state = (page: Page) => page.evaluate(() => window.__aeStage?.state() as State | undefined)

async function handedOff(page: Page) {
  await page.goto(PATH)
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-stage', 'webgl', { timeout: 20_000 })
  return fig
}

/** Scrubs the pinned harness (preview-only `ae:progress` events) from a to b over ms. */
const scrub = (page: Page, a: number, b: number, ms: number) =>
  page.evaluate(
    ({ a, b, ms }) =>
      new Promise<void>((resolve) => {
        const el = document.querySelector('#fig-s02')!
        const t0 = performance.now()
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / ms)
          el.dispatchEvent(new CustomEvent('ae:progress', { detail: a + (b - a) * k }))
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      }),
    { a, b, ms },
  )

test('s02 hands off on a hardware renderer, with its perf marks', async ({ page, guard }) => {
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer).toBeTruthy()
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  await expect(page.locator(FIG)).toHaveAttribute('data-medium', 'webgl')
  const marks = await page.evaluate(() =>
    performance
      .getEntries()
      .map((e) => e.name)
      .filter((n) => n.startsWith('3d:')),
  )
  for (const m of ['3d:build:s02', '3d:compile:s02', '3d:ready:s02', '3d:handoff:s02'])
    expect(marks, m).toContain(m)
  expect(guard.errors).toEqual([])
})

test('s02 for 60 s: the guard never trips, median rAF ≤ 17.5 ms, loop 3 fails once', async ({
  page,
  guard,
}) => {
  test.setTimeout(120_000)
  const fig = await handedOff(page)
  // rAF intervals across the whole run, and when the sync failure shows
  await page.evaluate(() => {
    const w = window as unknown as { __raf: number[]; __sync: number[] }
    w.__raf = []
    w.__sync = []
    const el = document.querySelector<HTMLElement>('#fig-s02')!
    let last = 0
    let was = false
    const tick = (t: number) => {
      if (last) w.__raf.push(t - last)
      last = t
      const on = 'sync' in el.dataset
      if (on && !was) w.__sync.push(t)
      was = on
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const t0 = await page.evaluate(() => performance.now())
  await scrub(page, 0.44, 0.8, 2500)
  const loopsAt = await page.evaluate(() => performance.now())
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 30_000 })
  // keep it busy for the rest of the minute: Run again
  while ((await page.evaluate(() => performance.now())) - t0 < 60_000) {
    await fig.locator('[data-action="run-again"]').click()
    await page.waitForTimeout(
      Math.min(18_500, 60_000 - ((await page.evaluate(() => performance.now())) - t0)),
    )
  }
  const { raf, sync } = await page.evaluate(() => {
    const w = window as unknown as { __raf: number[]; __sync: number[] }
    return { raf: w.__raf, sync: w.__sync }
  })
  const sorted = [...raf].sort((x, y) => x - y)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const s = (await state(page))!
  test.info().annotations.push({
    type: 'frames',
    description: JSON.stringify({ median, n: raf.length, guard: s.guard }),
  })
  expect(s.guard?.tripped).toBe(false)
  expect(s.dead).toBe(false)
  await expect(fig).toHaveAttribute('data-stage', 'webgl')
  expect(median).toBeLessThanOrEqual(17.5)
  // the first failure comes in the third loop (two clean loops first)
  expect(sync.length).toBeGreaterThan(0)
  expect(sync[0]! - loopsAt).toBeGreaterThan(12_000)
  expect(guard.errors).toEqual([])
})

test('s02 context loss falls back to SVG within 500 ms', async ({ page, guard }) => {
  await handedOff(page)
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>('#fig-s02')!
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

test('s02 five route round-trips: no leaks', async ({ page, guard }) => {
  test.setTimeout(120_000)
  await page.goto(PATH)
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('s02'))
  await page.locator(FIG).scrollIntoViewIfNeeded()
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL(/\/kit\/fig\/s02/)
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
