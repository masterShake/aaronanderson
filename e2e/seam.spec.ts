import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { DEMO_VIEWBOX, demoProbes } from '../src/app/kit/stage/demo-plan'

/**
 * The seam (stage-hero §5.1, §B10): at the hand-off frame the WebGL canvas
 * must draw what the SVG draws. Only at 1440@2 and 1280@1, on the gpu project.
 *   strict: pixels with max |ΔRGB| > 24          ≤ 0.60% of the art box
 *   tolerant: no pixel within 24 in the other image's 3×3 neighbourhood  ≤ 0.05%
 *   line-centre probes ≤ 6 per channel; panel probes ≤ 2
 * W2 scene lanes add their scenes to SCENES below.
 *
 *   npm run seam      (ARTIFACTS_DIR=… also keeps the PNGs and seam.json)
 */

const SIZES = [
  { name: '1440@2', viewport: { width: 1440, height: 900 }, dpr: 2 },
  { name: '1280@1', viewport: { width: 1280, height: 800 }, dpr: 1 },
] as const

const SCENES = [
  {
    scene: '_demo',
    path: '/kit/stage',
    figure: '#fig-stage-demo',
    viewBox: DEMO_VIEWBOX,
    probes: demoProbes(),
  },
] as const

const LIMIT = { strict: 0.006, tolerant: 0.0005, line: 6, panel: 2 }

interface Metrics {
  w: number
  h: number
  strict: number
  tolerant: number
  line: number
  panel: number
}

async function measure(
  page: Page,
  a: Buffer,
  b: Buffer,
  pts: {
    lines: readonly (readonly [number, number])[]
    panel: readonly (readonly [number, number])[]
  },
  k: number,
): Promise<Metrics> {
  return page.evaluate(
    async ({ a, b, lines, panel, k }) => {
      const load = async (b64: string) => {
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const c = new OffscreenCanvas(bm.width, bm.height)
        const g = c.getContext('2d')!
        g.drawImage(bm, 0, 0)
        return g.getImageData(0, 0, bm.width, bm.height)
      }
      const A = await load(a)
      const B = await load(b)
      const w = Math.min(A.width, B.width)
      const h = Math.min(A.height, B.height)
      const at = (I: ImageData, x: number, y: number) => (y * I.width + x) * 4
      const diff = (I: ImageData, i: number, J: ImageData, j: number) =>
        Math.max(
          Math.abs(I.data[i]! - J.data[j]!),
          Math.abs(I.data[i + 1]! - J.data[j + 1]!),
          Math.abs(I.data[i + 2]! - J.data[j + 2]!),
        )
      let strict = 0
      let tolA = 0
      let tolB = 0
      const near = (I: ImageData, J: ImageData, x: number, y: number) => {
        const i = at(I, x, y)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            if (diff(I, i, J, at(J, xx, yy)) <= 24) return true
          }
        return false
      }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (diff(A, at(A, x, y), B, at(B, x, y)) <= 24) continue
          strict++
          if (!near(A, B, x, y)) tolA++
          if (!near(B, A, x, y)) tolB++
        }
      const probe = (pts: readonly (readonly [number, number])[]) => {
        let worst = 0
        for (const [px, py] of pts) {
          const x = Math.min(w - 1, Math.round(px * k))
          const y = Math.min(h - 1, Math.round(py * k))
          worst = Math.max(worst, diff(A, at(A, x, y), B, at(B, x, y)))
        }
        return worst
      }
      const n = w * h
      return {
        w,
        h,
        strict: strict / n,
        tolerant: Math.max(tolA, tolB) / n,
        line: probe(lines),
        panel: probe(panel),
      }
    },
    { a: a.toString('base64'), b: b.toString('base64'), lines: pts.lines, panel: pts.panel, k },
  )
}

const results: Record<string, Record<string, Metrics>> = {}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, deviceScaleFactor: size.dpr })
    for (const sc of SCENES) {
      test(`seam ${sc.scene} at ${size.name}`, async ({ page, guard }) => {
        await page.goto(`${sc.path}?tier=webgl`)
        await page.evaluate((s) => window.__aeStage!.holdAtHandoff(s as never), sc.scene)
        const box = page.locator(`${sc.figure} .box`)
        await box.scrollIntoViewIfNeeded()
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        const shot = async (medium: 'svg' | 'webgl') => {
          await page.evaluate(
            ([s, m]) => window.__aeStage!.show(s as never, m as 'svg' | 'webgl'),
            [sc.scene, medium] as const,
          )
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          )
          return box.screenshot({ animations: 'disabled' })
        }
        const a = await shot('svg')
        const b = await shot('webgl')
        // B really is the canvas: it is shown and every CAD layer is hidden.
        await expect(page.locator(`${sc.figure} canvas.stage-canvas`)).toHaveCSS('opacity', '1')
        for (const svg of await page.locator(`${sc.figure} .drawing svg.l-cad`).all())
          await expect(svg).toHaveCSS('visibility', 'hidden')
        const cssW = (await box.boundingBox())!.width
        const k = (cssW / sc.viewBox[2]) * size.dpr
        const m = await measure(page, a, b, sc.probes, k)
        ;(results[sc.scene] ??= {})[size.name] = m
        const dir = process.env.ARTIFACTS_DIR
        if (dir) {
          const out = join(dir, 'seam')
          mkdirSync(out, { recursive: true })
          writeFileSync(join(out, `${sc.scene}-${size.name}-svg.png`), a)
          writeFileSync(join(out, `${sc.scene}-${size.name}-webgl.png`), b)
          writeFileSync(join(out, `${sc.scene}-${size.name}.json`), JSON.stringify(m, null, 2))
        }
        test.info().annotations.push({ type: 'seam', description: JSON.stringify(m) })
        expect(m.strict, 'strict').toBeLessThanOrEqual(LIMIT.strict)
        expect(m.tolerant, 'tolerant').toBeLessThanOrEqual(LIMIT.tolerant)
        expect(m.line, 'line-centre probes').toBeLessThanOrEqual(LIMIT.line)
        expect(m.panel, 'panel probes').toBeLessThanOrEqual(LIMIT.panel)
        expect(guard.errors).toEqual([])
      })
    }
  })
}

test.afterAll(() => {
  const dir = process.env.ARTIFACTS_DIR
  if (!dir || !Object.keys(results).length) return
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `seam-${process.pid}.json`), JSON.stringify(results, null, 2))
})
