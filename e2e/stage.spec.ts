import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { HANDOFF_P, MOTION_FROM_P, SCRUB } from '../src/motion/timing'
import { SHIP } from '../src/stage/gates'

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
  // Hidden tab: the loop stops on visibilitychange.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)
  expect(await framesOver(1000)).toBeLessThanOrEqual(1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
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

test('a scene whose build throws falls back alone, with no session downgrade', async ({
  page,
  guard,
}) => {
  await page.goto('/kit/stage?tier=webgl&fail=build')
  await expect(page.locator(DEMO)).toHaveAttribute('data-events', /fallback:build-error/, {
    timeout: 20_000,
  })
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'svg')
  await expect(page.locator(DEMO)).toHaveAttribute('data-medium', 'svg')
  await expect(page.locator('html')).toHaveAttribute('data-tier-max', 'webgl')
  await expect(page.locator('html')).not.toHaveAttribute('data-tier-reason', /.+/)
  expect(await page.evaluate(() => sessionStorage.getItem('ae:tier'))).toBeNull()
  expect((await state(page))!.dead).toBe(false)
  expect(guard.errors).toEqual([])
})

test('unforced: hardware promotes svg to webgl; reduced motion takes it to the still', async ({
  page,
  guard,
}) => {
  await page.goto('/kit/stage')
  await handedOff(page)
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'webgl')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'svg')
  await expect(page.locator(DEMO)).toHaveAttribute('data-events', /fallback:ineligible/)
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

test.describe('service scenes: WebGL only at 1024 px and up with a fine pointer (D3)', () => {
  const S02 = '/kit/fig/s02?tier=webgl'
  /** Visits the s02 harness and reports whether the runtime chunk was fetched or loaded. */
  async function visit(page: Page) {
    const js: string[] = []
    page.on('response', async (r) => {
      if (!r.url().endsWith('.js')) return
      const body = await r.text().catch(() => '')
      if (/WebGLRenderer|stage-canvas/.test(body)) js.push(r.url())
    })
    await page.goto(S02)
    await page.waitForLoadState('load')
    await page.locator('#fig-s02').scrollIntoViewIfNeeded()
    return js
  }

  test('a wide desktop with a fine pointer prefetches the runtime', async ({ page, guard }) => {
    const js = await visit(page)
    await expect(page.locator('html')).toHaveAttribute('data-stage-runtime', 'loaded', {
      timeout: 15_000,
    })
    expect(js.length).toBeGreaterThan(0)
    expect(guard.errors).toEqual([])
  })

  test('below 1024 px: no probe, no prefetch', async ({ page, guard }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    const js = await visit(page)
    await page.waitForTimeout(2500)
    expect(js).toEqual([])
    await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
    expect(guard.errors).toEqual([])
  })

  test.describe('touch', () => {
    test.use({ hasTouch: true })
    test('a coarse pointer at 1440 px: no probe, no prefetch', async ({ page, guard }) => {
      const js = await visit(page)
      expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(false)
      await page.waitForTimeout(2500)
      expect(js).toEqual([])
      await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
      expect(guard.errors).toEqual([])
    })
  })
})

/**
 * Line widths across horizontal plan lines, in device px: for each point (viewBox units, on a
 * horizontal line), the ink summed down a ±12 unit column, over the ink of a full pixel.
 */
async function lineWidths(
  page: Page,
  png: Buffer,
  pts: readonly (readonly [number, number])[],
  scale: number,
): Promise<number[]> {
  return page.evaluate(
    async ({ b64, pts, scale }) => {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const c = new OffscreenCanvas(bm.width, bm.height)
      const g = c.getContext('2d')!
      g.drawImage(bm, 0, 0)
      const I = g.getImageData(0, 0, bm.width, bm.height)
      const px = (x: number, y: number) => {
        const i = (y * I.width + x) * 4
        return [I.data[i]!, I.data[i + 1]!, I.data[i + 2]!] as const
      }
      const ink = (p: readonly number[], q: readonly number[]) =>
        Math.max(...p.map((v, i) => Math.abs(v - q[i]!)))
      return pts.map(([vx, vy]) => {
        const x = Math.round(vx * scale)
        const y0 = Math.round((vy - 12) * scale)
        const y1 = Math.round((vy + 12) * scale)
        const bg = px(x, Math.max(0, y0 - 2))
        const col: number[] = []
        for (let y = y0; y <= y1; y++) col.push(ink(px(x, y), bg))
        const peak = Math.max(...col)
        return peak ? col.reduce((s, v) => s + v, 0) / peak : 0
      })
    },
    { b64: png.toString('base64'), pts, scale },
  )
}

test('canvas strokes follow the SVG stroke scale (--k on the CAD layer)', async ({
  page,
  guard,
}) => {
  await page.goto('/kit/stage?tier=webgl')
  await page.evaluate(() => window.__aeStage!.holdAtHandoff('_demo'))
  const box = page.locator(`${DEMO} .box`)
  await box.scrollIntoViewIfNeeded()
  // midpoints of the three boxes' top edges (demo-plan.ts DEMO_BOXES)
  const pts = [
    [200, 220],
    [480, 140],
    [760, 300],
  ] as const
  const dpr = await page.evaluate(() => devicePixelRatio)
  const scale = ((await box.boundingBox())!.width / 960) * dpr
  // show() re-fits the scene, so the runtime reads the stroke scale again
  const shot = async (medium: 'svg' | 'webgl') => {
    await page.evaluate((m) => window.__aeStage!.show('_demo', m), medium)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    return box.screenshot({ animations: 'disabled' })
  }
  const widths = async (k: number) => {
    await page
      .locator(`${DEMO} svg.l-cad`)
      .evaluate((el, k) => (el as SVGElement).style.setProperty('--k', String(k)), k)
    const svg = await lineWidths(page, await shot('svg'), pts, scale)
    const gl = await lineWidths(page, await shot('webgl'), pts, scale)
    return { svg, gl }
  }
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  const at1 = await widths(1)
  const at15 = await widths(1.5)
  test.info().annotations.push({ type: 'widths', description: JSON.stringify({ at1, at15 }) })
  // the SVG really drew wider lines
  expect(sum(at15.svg) / sum(at1.svg)).toBeGreaterThan(1.3)
  // and the canvas matches the SVG at both scales
  for (const w of [at1, at15]) {
    const r = sum(w.gl) / sum(w.svg)
    expect(r, JSON.stringify(w)).toBeGreaterThan(0.88)
    expect(r, JSON.stringify(w)).toBeLessThan(1.14)
  }
  expect(guard.errors).toEqual([])
})

/**
 * /services at a steady reading pace (60 px per wheel tick every 200 ms, craft-11): every shipped
 * service scene hands off on the real page, at a p between its HANDOFF_P and MOTION_FROM_P. One
 * tick can move p further than the .04 window, and the scene can arm after p passed it.
 */
test.describe('/services: shipped scenes hand off during a steady scroll', () => {
  /**
   * Opens /services with the figure's track 1.6 viewports below the top of the screen: near
   * enough for its drawing layers to load (and the figure's scroll driver to attach), far enough
   * that the driver's first look does not see the track (which would hold p at 1 until the track
   * had left the screen once, scroll-driver.ts).
   */
  async function open(page: Page, fig: string) {
    await page.goto('/services?tier=webgl')
    await page.waitForLoadState('load')
    await expect(page.locator(fig)).toHaveAttribute('data-phase', /.+/)
    await page.locator(fig).evaluate((el) => {
      const track = el.closest('section')!.querySelector('[data-scrub-track]')!
      const y = track.getBoundingClientRect().top + scrollY - 1.6 * innerHeight
      window.scrollTo(0, Math.max(0, y))
    })
    await expect(page.locator(fig)).toHaveAttribute('data-layers', 'ready', { timeout: 15_000 })
    await page.waitForTimeout(500)
  }

  for (const id of ['s02', 's06'] as const) {
    test(id, async ({ page, guard }) => {
      test.skip(SHIP[id] !== 'webgl', `${id} ships as svg`)
      test.setTimeout(120_000)
      const fig = `#fig-${id}`
      await open(page, fig)
      await page.locator(fig).evaluate((el) => {
        const w = window as unknown as { __handoffP?: number }
        new MutationObserver(() => {
          if (el.dataset.stage === 'handoff' && w.__handoffP === undefined)
            w.__handoffP = parseFloat(el.style.getPropertyValue('--p'))
        }).observe(el, { attributes: true, attributeFilter: ['data-stage'] })
      })
      await page.mouse.move(720, 450)
      const p = () =>
        page.locator(fig).evaluate((el) => parseFloat(el.style.getPropertyValue('--p')))
      for (let i = 0; i < 300 && !((await p()) >= 0.999); i++) {
        await page.mouse.wheel(0, 60)
        await page.waitForTimeout(200)
      }
      expect(await p(), 'the scrub reached its end').toBeGreaterThanOrEqual(0.999)
      const at = await page.evaluate(
        () => (window as unknown as { __handoffP?: number }).__handoffP,
      )
      expect(at, `${id} handed off`).toBeDefined()
      expect(at!).toBeGreaterThanOrEqual(HANDOFF_P[id])
      expect(at!).toBeLessThanOrEqual(MOTION_FROM_P[id])
      await expect(page.locator(fig)).toHaveAttribute('data-stage', 'webgl')
      test.info().annotations.push({ type: `${id} handoff p`, description: String(at) })
      expect(guard.errors).toEqual([])
    })
  }

  /** Scrolls so the figure's scrub (scroll-driver: sticky top over the section's track) is at p. */
  const scrollToP = (page: Page, fig: string, p: number) =>
    page.locator(fig).evaluate((el, p) => {
      const track = el.closest('section')!.querySelector<HTMLElement>('[data-scrub-track]')!
      const top = parseFloat(getComputedStyle(el).top) || 0
      const r = track.getBoundingClientRect()
      const span = Math.max(1, r.height - (el as HTMLElement).offsetHeight)
      window.scrollTo(0, r.top + scrollY - top + p * span)
    }, p)
  const armed = (page: Page, id: string) =>
    page.evaluate(
      (id) => (window.__aeStage?.state() as State | undefined)?.figs?.find((f) => f.scene === id),
      id,
    )

  for (const id of ['s02', 's06'] as const) {
    test(`${id}: one step across the whole window still hands off`, async ({ page, guard }) => {
      test.skip(SHIP[id] !== 'webgl', `${id} ships as svg`)
      const fig = `#fig-${id}`
      await open(page, fig)
      await scrollToP(page, fig, Math.max(0, HANDOFF_P[id] - 0.03))
      await expect.poll(async () => (await armed(page, id))?.arm, { timeout: 30_000 }).toBe('armed')
      await expect(page.locator(fig)).toHaveAttribute('data-stage', 'svg')
      await scrollToP(page, fig, HANDOFF_P[id] + SCRUB.handoffWindow + 0.04)
      await expect(page.locator(fig)).toHaveAttribute('data-stage', 'webgl', { timeout: 3000 })
      expect(guard.errors).toEqual([])
    })

    test(`${id}: armed after p passed the window still hands off`, async ({ page, guard }) => {
      test.skip(SHIP[id] !== 'webgl', `${id} ships as svg`)
      const fig = `#fig-${id}`
      await open(page, fig)
      const mid = (HANDOFF_P[id] + MOTION_FROM_P[id]) / 2
      await scrollToP(page, fig, mid)
      await expect
        .poll(() =>
          page.locator(fig).evaluate((el) => parseFloat(el.style.getPropertyValue('--p'))),
        )
        .toBeCloseTo(mid, 1)
      await expect(page.locator(fig)).toHaveAttribute('data-stage', 'webgl', { timeout: 30_000 })
      expect(guard.errors).toEqual([])
    })
  }
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
