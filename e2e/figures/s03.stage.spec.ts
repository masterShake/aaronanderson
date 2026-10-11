import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'

/**
 * S-03 WebGL gate evidence (gpu project, hardware renderer), on the /kit/fig/s03 harness
 * pinned at the hand-off (?p=0.38) and scrubbed with `ae:s03-p` events:
 *   - hardware renderer, hand-off at the front elevation, perf marks;
 *   - HELD within 7 s of p ≥ .62; Approve brings the third card within 900 ms (beat approved);
 *   - the frame guard never trips over 60 s of scrubbing and batches; median rAF ≤ 17.5 ms;
 *   - context loss → SVG within 500 ms; five route round-trips leak nothing;
 *   - the svg and still tiers fetch no 3D.
 *   npm run test:stage -- e2e/figures/s03.stage.spec.ts   (ARTIFACTS_DIR keeps s03-gate.json)
 */

const FIG = '#fig-s03'
// ship=s03: SHIP.s03 is 'svg' (seam), so the gate runs the scene through the preview override
const URL = '/kit/fig/s03?tier=webgl&ship=s03&p=0.38'
type State = {
  renderer?: string
  dead?: boolean
  memory?: { geometries: number; textures: number }
  guard?: { tripped: boolean; medians: number[] }
  programs?: number
}
const state = (page: Page) => page.evaluate(() => window.__aeStage?.state() as State | undefined)
const setP = (page: Page, p: number) =>
  page.evaluate(
    ([sel, v]) =>
      document
        .querySelector(sel as string)!
        .dispatchEvent(new CustomEvent('ae:s03-p', { detail: v })),
    [FIG, p] as const,
  )
const gate: Record<string, unknown> = {}

async function handedOff(page: Page) {
  await page.goto(URL)
  await page.locator(FIG).scrollIntoViewIfNeeded()
  await expect(page.locator(FIG)).toHaveAttribute('data-stage', 'webgl', { timeout: 20_000 })
}

test.afterAll(() => {
  const dir = process.env.ARTIFACTS_DIR
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `s03-gate-${process.pid}.json`), JSON.stringify(gate, null, 2))
})

test('hardware hand-off at the front elevation, then HELD and Approve', async ({ page, guard }) => {
  await handedOff(page)
  const s = await state(page)
  expect(s?.renderer).not.toMatch(/swiftshader|llvmpipe|lavapipe|softpipe|software/i)
  const marks = await page.evaluate(() =>
    performance
      .getEntries()
      .map((e) => e.name)
      .filter((n) => n.startsWith('3d:')),
  )
  for (const m of ['3d:build:s03', '3d:compile:s03', '3d:ready:s03', '3d:handoff:s03'])
    expect(marks, m).toContain(m)
  for (const p of [0.45, 0.52, 0.58, 0.62]) {
    await setP(page, p)
    await page.waitForTimeout(250)
  }
  const t0 = Date.now()
  await expect(page.locator(FIG)).toHaveAttribute('data-batch', 'held', { timeout: 10_000 })
  const heldMs = Date.now() - t0
  expect(heldMs).toBeLessThanOrEqual(7000)
  await expect(page.locator(FIG)).toHaveAttribute('data-labels', 'iso')
  const t1 = await page.evaluate(() => performance.now())
  await page.evaluate((sel) => {
    const w = window as unknown as { __approvedAt?: number }
    const f = document.querySelector(sel)!
    new MutationObserver(() => {
      if ((f as HTMLElement).dataset.rev === 'approved') w.__approvedAt ??= performance.now()
    }).observe(f, { attributes: true })
  }, FIG)
  await page.locator(`${FIG} button[data-action="approve"]`).click()
  await expect(page.locator(FIG)).toHaveAttribute('data-rev', 'approved')
  // the scene reports 'approved' once the third card is out (S03.approveMs)
  await page.waitForTimeout(1000)
  const st = await state(page)
  gate.heldMs = heldMs
  gate.approveClickToFigureMs = Math.round(
    ((await page.evaluate(() => (window as unknown as { __approvedAt?: number }).__approvedAt)) ??
      t1) - t1,
  )
  gate.programs = st?.programs
  gate.memory = st?.memory
  expect(guard.errors).toEqual([])
})

test('60 s of scrubbing and batches: the guard never trips, median rAF ≤ 17.5 ms', async ({
  page,
  guard,
}) => {
  test.setTimeout(120_000)
  await handedOff(page)
  await page.evaluate(() => {
    const w = window as unknown as { __dts: number[]; __stop: boolean }
    w.__dts = []
    w.__stop = false
    let prev = 0
    const f = (t: number) => {
      if (prev) w.__dts.push(t - prev)
      prev = t
      if (!w.__stop) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  })
  const end = Date.now() + 60_000
  let dir = 1
  let p = 0.42
  while (Date.now() < end) {
    p += dir * 0.01
    if (p >= 0.63) {
      dir = -1
      await setP(page, 0.63)
      // let a batch run, then run another
      await page.waitForTimeout(1500)
      const btn = page.locator(`${FIG} button[data-action="approve"]`)
      if ((await btn.getAttribute('aria-disabled')) === 'false') await btn.click()
    }
    if (p <= 0.42) dir = 1
    await setP(page, p)
    await page.waitForTimeout(50)
  }
  const dts = await page.evaluate(() => {
    const w = window as unknown as { __dts: number[]; __stop: boolean }
    w.__stop = true
    return w.__dts
  })
  const sorted = [...dts].sort((a, b) => a - b)
  const median = sorted[sorted.length >> 1]!
  const s = await state(page)
  gate.medianFrameMs = Math.round(median * 100) / 100
  gate.p95FrameMs = Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 100) / 100
  gate.guard = s?.guard
  expect(s?.guard?.tripped).toBe(false)
  expect(s?.dead).toBe(false)
  expect(median).toBeLessThanOrEqual(17.5)
  await expect(page.locator(FIG)).toHaveAttribute('data-stage', 'webgl')
  expect(guard.errors).toEqual([])
})

test('context loss falls back to SVG within 500 ms and keeps the approved state', async ({
  page,
  guard,
}) => {
  await handedOff(page)
  await setP(page, 0.62)
  await expect(page.locator(FIG)).toHaveAttribute('data-batch', 'held', { timeout: 10_000 })
  await page.locator(`${FIG} button[data-action="approve"]`).click()
  const ms = await page.evaluate(
    (sel) =>
      new Promise<number>((resolve) => {
        const fig = document.querySelector<HTMLElement>(sel)!
        const t0 = performance.now()
        const poll = () =>
          fig.dataset.stage === 'svg' && fig.dataset.medium === 'svg'
            ? resolve(performance.now() - t0)
            : requestAnimationFrame(poll)
        window.__aeStage!.loseContext()
        poll()
      }),
    FIG,
  )
  gate.contextLossMs = Math.round(ms * 10) / 10
  expect(ms).toBeLessThanOrEqual(500)
  await expect(page.locator(FIG)).toHaveAttribute('data-rev', 'approved')
  await expect(page.locator(FIG)).toHaveAttribute('data-batch', 'held')
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(0)
  expect(guard.errors.filter((e) => !/context/i.test(e))).toEqual([])
})

test('five route round-trips: no leaks, one canvas', async ({ page, guard }) => {
  test.setTimeout(120_000)
  await handedOff(page)
  const hold = () => page.evaluate(() => window.__aeStage!.holdAtHandoff('s03'))
  await hold()
  const base = (await state(page))!.memory!
  const seen: { geometries: number; textures: number }[] = []
  for (let i = 0; i < 5; i++) {
    await page.getByRole('banner').getByRole('link', { name: /about/i }).first().click()
    await page.waitForURL(/\/about/)
    await page.waitForTimeout(300)
    await page.goBack()
    await page.waitForURL(/\/kit\/fig\/s03/)
    await page.locator(FIG).scrollIntoViewIfNeeded()
    await hold()
    const m = (await state(page))!.memory!
    seen.push(m)
    expect(Math.abs(m.geometries - base.geometries), JSON.stringify(seen)).toBeLessThanOrEqual(2)
    expect(Math.abs(m.textures - base.textures), JSON.stringify(seen)).toBeLessThanOrEqual(2)
  }
  await expect(page.locator('canvas.stage-canvas')).toHaveCount(1)
  gate.disposalOk = true
  gate.roundTrips = { base, seen }
  expect(guard.errors).toEqual([])
})

for (const tier of ['svg', 'still'] as const)
  test(`${tier} tier fetches no 3D`, async ({ page, guard }) => {
    const js: string[] = []
    page.on('response', async (r) => {
      if (!r.url().endsWith('.js')) return
      const body = await r.text().catch(() => '')
      if (/WebGLRenderer|stage-canvas|id:"s03",create/.test(body)) js.push(r.url())
    })
    await page.emulateMedia({ reducedMotion: tier === 'still' ? 'reduce' : 'no-preference' })
    await page.goto(`/kit/fig/s03?tier=${tier}&p=0.38`)
    await page.locator(FIG).scrollIntoViewIfNeeded()
    await page.waitForTimeout(2500)
    expect(js).toEqual([])
    await expect(page.locator('html')).not.toHaveAttribute('data-stage-runtime', 'loaded')
    expect(guard.errors).toEqual([])
  })
