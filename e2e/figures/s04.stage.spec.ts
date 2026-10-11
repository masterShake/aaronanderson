import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * The S-04 WebGL quality gate (optional scene; SHIP.s04 is 'svg', so it runs with
 * ?ship=s04), on the gpu project. The seam is `SEAM_SCENES=s04 npm run seam`
 * (src/figures/s04/seam.ts); the chunk sizes are `npm run perf:3d`.
 *
 *   npm run test:stage -- e2e/figures/s04.stage.spec.ts
 */

const FIG = '#fig-s04'
const PATH = '/kit/fig/s04?tier=webgl&ship=s04&p=0.5'
type State = {
  renderer?: string
  dead?: boolean
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
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
        const el = document.querySelector('#fig-s04')!
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

test('s04 hands off on a hardware renderer, with its perf marks', async ({ page, guard }) => {
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  const marks = await page.evaluate(() =>
    performance
      .getEntries()
      .map((e) => e.name)
      .filter((n) => n.startsWith('3d:')),
  )
  for (const m of ['3d:build:s04', '3d:compile:s04', '3d:ready:s04', '3d:handoff:s04'])
    expect(marks, m).toContain(m)
  expect(guard.errors).toEqual([])
})

test('s04 for 60 s: the guard never trips, median rAF ≤ 17.5 ms; chips turn needles', async ({
  page,
  guard,
}) => {
  test.setTimeout(120_000)
  const fig = await handedOff(page)
  await page.evaluate(() => {
    const w = window as unknown as { __raf: number[] }
    w.__raf = []
    let last = 0
    const tick = (t: number) => {
      if (last) w.__raf.push(t - last)
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const t0 = await page.evaluate(() => performance.now())
  await scrub(page, 0.5, 0.85, 2500)
  await fig.locator('button[data-q="budget"]').click()
  await expect(fig).toHaveAttribute('data-cost', 'check')
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 30_000 })
  while ((await page.evaluate(() => performance.now())) - t0 < 60_000) {
    await fig.locator('[data-action="run-again"]').click()
    const left = 60_000 - ((await page.evaluate(() => performance.now())) - t0)
    await page.waitForTimeout(Math.max(0, Math.min(18_500, left)))
  }
  const raf = await page.evaluate(() => (window as unknown as { __raf: number[] }).__raf)
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
  expect(guard.errors).toEqual([])
})

test('s04 context loss falls back to SVG within 500 ms', async ({ page, guard }) => {
  await handedOff(page)
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>('#fig-s04')!
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
  expect(guard.errors).toEqual([])
})

test('s04 five route round-trips: no leaks', async ({ page, guard }) => {
  test.setTimeout(120_000)
  await page.goto(PATH)
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('s04'))
  await page.locator(FIG).scrollIntoViewIfNeeded()
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL(/\/kit\/fig\/s04/)
    await page.locator(FIG).scrollIntoViewIfNeeded()
    await hold()
    const m = (await state(page))!.memory!
    seen.push(m)
    expect(Math.abs(m.geometries - base.geometries), JSON.stringify(seen)).toBeLessThanOrEqual(2)
    expect(Math.abs(m.textures - base.textures), JSON.stringify(seen)).toBeLessThanOrEqual(2)
  }
  test.info().annotations.push({ type: 'memory', description: JSON.stringify({ base, seen }) })
  expect(guard.errors).toEqual([])
})
