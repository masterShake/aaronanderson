import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures'

/**
 * Stage performance on the gpu project (real GPU only; a SwiftShader run is
 * never a pass). Frames (§B10): the guard never trips in 60 s of running and
 * the median rAF interval is ≤17.5 ms. The env (`3d:env`) and init → ready
 * are measured at 4× CPU (stage-hero §5.2); over 80 ms, ENV.size drops to 64.
 *
 *   npm run test:stage -- e2e/perf.spec.ts
 */

const DEMO = '#fig-stage-demo'
type GuardState = { tripped: boolean; medians: number[]; dpr: number }

const save = (name: string, body: string | Buffer) => {
  const dir = process.env.ARTIFACTS_DIR
  if (!dir) return
  mkdirSync(join(dir, 'perf'), { recursive: true })
  writeFileSync(join(dir, 'perf', name), body)
}

test('frames: 60 s of the demo, guard never trips, median rAF ≤ 17.5 ms', async ({
  page,
  guard,
}) => {
  test.setTimeout(150_000)
  await page.goto('/kit/stage?tier=webgl')
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'webgl', { timeout: 20_000 })
  const deltas = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const out: number[] = []
        let last = 0
        const end = performance.now() + 60_000
        const tick = (t: number) => {
          if (last) out.push(t - last)
          last = t
          if (t < end) requestAnimationFrame(tick)
          else resolve(out)
        }
        requestAnimationFrame(tick)
      }),
  )
  const sorted = [...deltas].sort((a, b) => a - b)
  const median = sorted[sorted.length >> 1]!
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!
  const s = (await page.evaluate(() => window.__aeStage!.state())) as {
    guard: GuardState
    renderer: string
    dead: boolean
  }
  const report = { median, p95, frames: deltas.length, guard: s.guard, renderer: s.renderer }
  save('frames.json', JSON.stringify(report, null, 2))
  test.info().annotations.push({ type: 'frames', description: JSON.stringify(report) })
  expect(s.renderer).not.toMatch(/swiftshader|llvmpipe|software/i)
  expect(s.dead).toBe(false)
  expect(s.guard.tripped).toBe(false)
  await expect(page.locator(DEMO)).toHaveAttribute('data-stage', 'webgl')
  expect(median).toBeLessThanOrEqual(17.5)
  expect(guard.errors).toEqual([])
})

test('env and init → ready at 4× CPU', async ({ page, guard }) => {
  test.setTimeout(90_000)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto('/kit/stage?tier=webgl')
  await page.waitForFunction(
    () => performance.getEntriesByName('3d:ready:_demo').length > 0,
    null,
    {
      timeout: 60_000,
    },
  )
  const m = await page.evaluate(() => {
    const one = (n: string) => performance.getEntriesByName(n)[0]
    const init = one('3d:init')!.startTime
    return {
      envMs: one('3d:env')!.duration,
      buildMs: one('3d:build:_demo')!.duration,
      compileMs: one('3d:compile:_demo')!.duration,
      initToReadyMs: one('3d:ready:_demo')!.startTime - init,
    }
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  save('cpu4x.json', JSON.stringify(m, null, 2))
  test.info().annotations.push({ type: 'cpu4x', description: JSON.stringify(m) })
  expect(m.envMs, '3d:env at 4× CPU (over 80 ms: ENV.size → 64)').toBeLessThanOrEqual(80)
  expect(guard.errors).toEqual([])
})

test('craft shots: hand-off frame and iso', async ({ page, guard }) => {
  await page.goto('/kit/stage?tier=webgl')
  await page.evaluate(() => window.__aeStage!.holdAtHandoff('_demo'))
  const box = page.locator(`${DEMO} .box`)
  for (const ms of [0, 1200, 4000]) {
    await page.evaluate((t) => window.__aeStage!.seek('_demo', { ms: t }), ms)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    save(`demo-${ms}ms.png`, await box.screenshot({ animations: 'disabled' }))
  }
  expect(guard.errors).toEqual([])
})
