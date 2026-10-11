import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

/**
 * The Stage on the gpu project (real Chrome, --use-angle=metal). A
 * SwiftShader renderer is never a pass: the hardware test fails on it.
 *
 *   npm run test:stage
 */

const DEMO = '#fig-stage-demo'
type State = {
  loaded: boolean
  renderer?: string
  dead?: boolean
  contexts?: number
  canvases?: number
  frames?: number
  looping?: boolean
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
  ship: Record<string, boolean>
  figs?: { scene: string; arm: string; stage: string }[]
}
const state = (page: Page) => page.evaluate(() => window.__aeStage?.state() as State | undefined)

/** Counts WebGL contexts the page creates. */
async function countContexts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __glContexts: number }
    w.__glContexts = 0
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...a: unknown[]) {
      const ctx = (get as (...x: unknown[]) => unknown).apply(this, a)
      if (ctx && /webgl/.test(String(a[0]))) {
        const seen = (this as unknown as { __counted?: boolean }).__counted
        if (!seen) w.__glContexts++
        ;(this as unknown as { __counted?: boolean }).__counted = true
      }
      return ctx
    } as typeof get
  })
}
const contexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __glContexts: number }).__glContexts)

async function handedOff(page: Page) {
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'webgl', { timeout: 20_000 })
}

test.describe('still and svg tiers fetch no 3D', () => {
  for (const tier of ['still', 'svg'] as const)
    for (const path of ['/', '/services', '/kit/stage']) {
      test(`${path} on ${tier}`, async ({ page, guard }) => {
        const js: string[] = []
        page.on('response', async (r) => {
          if (!r.url().endsWith('.js')) return
          const body = await r.text().catch(() => '')
          if (/WebGLRenderer|stage-canvas/.test(body)) js.push(r.url())
        })
        await page.emulateMedia({ reducedMotion: tier === 'still' ? 'reduce' : 'no-preference' })
        await page.goto(`${path}?tier=${tier}`)
        await page.waitForLoadState('load')
        await page.mouse.wheel(0, 3000)
        await page.waitForTimeout(2500)
        expect(js).toEqual([])
        await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
        expect(guard.errors).toEqual([])
      })
    }
})

test('webgl tier: one hardware context, ready then handoff, perf marks', async ({
  page,
  guard,
}) => {
  await countContexts(page)
  await page.goto('/kit/stage?tier=webgl')
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer, 'renderer string').toBeTruthy()
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  expect(await contexts(page)).toBe(1)
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(1)
  await expect(page.locator(DEMO)).toHaveAttribute('data-events', /^ready handoff/)
  await expect(page.locator(DEMO)).toHaveAttribute('data-medium', 'webgl')
  const marks = await page.evaluate(() =>
    performance
      .getEntries()
      .map((e) => e.name)
      .filter((n) => n.startsWith('3d:')),
  )
  for (const m of [
    '3d:init',
    '3d:first-frame',
    '3d:env',
    '3d:build:_demo',
    '3d:compile:_demo',
    '3d:ready:_demo',
    '3d:handoff:_demo',
  ])
    expect(marks, m).toContain(m)
  expect(guard.errors).toEqual([])
})

test('context loss falls back to SVG within 500 ms and downgrades the session', async ({
  page,
  guard,
}) => {
  await page.goto('/kit/stage?tier=webgl')
  await handedOff(page)
  const ms = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>('#fig-stage-demo')!
        const t0 = performance.now()
        const done = () =>
          fig.dataset.stage === 'svg' && /fallback:context-lost/.test(fig.dataset.events ?? '')
        const poll = () => (done() ? resolve(performance.now() - t0) : requestAnimationFrame(poll))
        window.__aeStage!.loseContext()
        poll()
      }),
  )
  expect(ms).toBeLessThanOrEqual(500)
  await expect(page.locator(DEMO)).toHaveAttribute('data-medium', 'svg')
  await expect(page.locator('html')).toHaveAttribute('data-tier-reason', 'context-lost')
  await expect(page.locator('html')).toHaveAttribute('data-tier-max', 'svg')
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'svg')
  expect(await page.evaluate(() => sessionStorage.getItem('ae:tier'))).toBe('svg')
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(0)
  test.info().annotations.push({ type: 'contextLossMs', description: ms.toFixed(1) })
  expect(guard.errors).toEqual([])
})

test('five route round-trips: no leaks, still one context', async ({ page, guard }) => {
  test.setTimeout(120_000)
  await countContexts(page)
  await page.goto('/kit/stage?tier=webgl')
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('_demo'))
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL(/\/kit\/stage/)
    await hold()
    const m = (await state(page))!.memory!
    seen.push(m)
    expect(Math.abs(m.geometries - base.geometries), JSON.stringify(seen)).toBeLessThanOrEqual(2)
    expect(Math.abs(m.textures - base.textures), JSON.stringify(seen)).toBeLessThanOrEqual(2)
  }
  expect(await contexts(page)).toBe(1)
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(1)
  test.info().annotations.push({ type: 'memory', description: JSON.stringify({ base, seen }) })
  expect(guard.errors).toEqual([])
})

test('paused or off-screen: no frames', async ({ page, guard }) => {
  await page.goto('/kit/stage?tier=webgl')
  await handedOff(page)
  const framesOver = async (ms: number) => {
    const a = (await state(page))!.frames!
    await page.waitForTimeout(ms)
    return (await state(page))!.frames! - a
  }
  // Running: frames advance.
  expect(await framesOver(500)).toBeGreaterThan(5)
  // Paused site-wide: the loop stops (one last frame allowed).
  await page.evaluate(() => window.__ae!.setPaused(true))
  await page.waitForTimeout(100)
  expect(await framesOver(1000)).toBeLessThanOrEqual(1)
  expect((await state(page))!.looping).toBe(false)
  await page.evaluate(() => window.__ae!.setPaused(false))
  expect(await framesOver(500)).toBeGreaterThan(5)
  // Off-screen: scroll the figure away.
  await page.evaluate(() => {
    const pad = document.createElement('div')
    pad.style.height = '3000px'
    document.querySelector('main')!.appendChild(pad)
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  await page.waitForTimeout(200)
  expect(await framesOver(1000)).toBeLessThanOrEqual(1)
  expect((await state(page))!.looping).toBe(false)
  expect(guard.errors).toEqual([])
})

test('?ship= promotes an svg-gated scene outside production', async ({ page }) => {
  await page.goto('/kit/stage?tier=webgl')
  let s = await state(page)
  expect(s?.ship.s04).toBe(false)
  expect(s?.ship.hero).toBe(true)
  await page.goto('/kit/stage?tier=webgl&ship=s04,s06')
  s = await state(page)
  expect(s?.ship.s04).toBe(true)
  expect(s?.ship.s06).toBe(true)
  await page.goto('/kit/stage?tier=webgl&ship=all')
  s = await state(page)
  expect(Object.values(s!.ship).every(Boolean)).toBe(true)
})

test('?frame=plan holds the demo at its hand-off frame', async ({ page, guard }) => {
  await page.goto('/kit/stage?tier=webgl&frame=plan')
  await expect
    .poll(async () => (await state(page))?.figs?.[0]?.arm, { timeout: 20_000 })
    .toBe('armed')
  await page.waitForTimeout(500)
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'svg')
  expect(guard.errors).toEqual([])
})
