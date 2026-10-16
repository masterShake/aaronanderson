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

test('the 3D idle carries the svg idle words: idle note, AI sub-line, sign-off label', async ({
  page,
  guard,
}) => {
  test.setTimeout(90_000)
  await handedOff(page)
  // D2 A steps 4 and 7: REV 3 shows the idle note; the AI reader keeps "reads, never signs"
  // and the valve its SIGN-OFF label (W4: one label per object, no valve sub-line)
  await expect(page.locator(FIG)).toHaveAttribute('data-rev', 'done', { timeout: 45_000 })
  await page.waitForTimeout(800)
  const seen = await page.evaluate(() => {
    const fig = document.querySelector<HTMLElement>('#fig-hero')!
    const on = (el: Element | null) =>
      !!el &&
      (el as HTMLElement).offsetWidth > 0 &&
      el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    const idle = [...fig.querySelectorAll('.labels > span, .labels > *')].find(
      (el) => el.textContent?.trim().toLowerCase() === 'waiting for paperwork',
    )
    const sub = (k: string) => fig.querySelector(`.labels [data-anchor="${k}"] > span`)
    const valve = fig.querySelector('.labels [data-anchor="sym.valve"]')
    return {
      idle: on(idle ?? null),
      ai: on(sub('sym.ai')),
      valve: on(valve) && /sign-off/i.test(valve?.textContent ?? ''),
    }
  })
  await page
    .locator(FIG)
    .screenshot({ path: test.info().outputPath('hero-webgl-idle.png') })
    .catch(() => undefined)
  expect(seen).toEqual({ idle: true, ai: true, valve: true })
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

/** stage-hero §5.2's 3D window at 4× CPU: [3d:init, 3d:ready:<scene> + 500 ms]. */
async function window4x(page: Page, path: string, scene: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lt: { s: number; d: number }[] }
    w.__lt = []
    new PerformanceObserver((l) =>
      w.__lt.push(...l.getEntries().map((e) => ({ s: e.startTime, d: e.duration }))),
    ).observe({ type: 'longtask', buffered: true })
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(path)
  await page.waitForFunction(
    (s) => performance.getEntriesByName(`3d:ready:${s}`).length > 0,
    scene,
    { timeout: 30_000 },
  )
  await page.waitForTimeout(600)
  const r = await page.evaluate((s) => {
    const at = (n: string) => performance.getEntriesByName(n)[0]?.startTime ?? NaN
    const init = at('3d:init')
    const ready = at(`3d:ready:${s}`)
    const env = performance.getEntriesByName('3d:env')[0]?.duration ?? NaN
    const named = performance
      .getEntriesByType('measure')
      .filter((m) => m.name.startsWith('3d:'))
      .map((m) => [m.name, Math.round(m.duration)])
    const lt = (window as unknown as { __lt: { s: number; d: number }[] }).__lt.filter(
      (t) => t.s + t.d >= init && t.s <= ready + 500,
    )
    return {
      initToReady: ready - init,
      env,
      largest: Math.max(0, ...lt.map((t) => t.d)),
      over50: lt.reduce((s, t) => s + Math.max(0, t.d - 50), 0),
      tasks: lt.map((t) => [Math.round(t.s - init), Math.round(t.d)]),
      named,
    }
  }, scene)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return r
}

test('the 3D window at 4× CPU: init → ready, the largest task, the work over 50 ms', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  void page
  // each in a fresh context (no shared code cache); the stage lane's demo is the runtime's
  // own cost before any scene
  const measure = async (path: string, scene: string) => {
    const c = await browser.newContext(test.info().project.use)
    const p = await c.newPage()
    const out = await window4x(p, path, scene)
    await c.close()
    return out
  }
  const demo = await measure('/kit/stage?tier=webgl', '_demo')
  const r = await measure('/?tier=webgl', 'hero')
  test
    .info()
    .annotations.push({ type: '3d-window', description: JSON.stringify({ hero: r, demo }) })
  // stage-hero §5.2: env and init → ready are gated here. The largest task and the work over
  // 50 ms are recorded (annotation) for the W3 perf lens: on Home they include the page's own
  // work in the same window, and the runtime's first task alone is about 70 ms (the demo).
  expect(r.env).toBeLessThanOrEqual(80)
  expect(r.initToReady).toBeLessThanOrEqual(1200)
  expect(r.largest).toBeLessThanOrEqual(demo.largest + 50)
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
