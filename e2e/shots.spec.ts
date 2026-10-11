import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ROUTES, TIERS, pick, type Tier } from './routes'
import { gotoTier } from './helpers/tier'
import { fontsReady } from './helpers/freeze'
import { artifactsDir, mergeParts, writePart } from './helpers/budgets'

/**
 * Review screenshots (shots project): every route × width (360, 390, 768,
 * 1280, 1440) × tier (still, svg), full page; the header alone at 375; the
 * first viewport at 1280×800 and 390×844. Each full-page shot is cut into
 * viewport-high slices and the share of orange pixels in each is measured in
 * the page (D7: orange covers at most 5% of any viewport) → orange.json.
 * Narrow it with ROUTES, WIDTHS and TIERS. Output: $ARTIFACTS_DIR/shots/.
 */

const ORANGE_MAX = 0.05
/** The two oranges in tokens.css (orange and orange-hover). */
const ORANGES = [
  [0xff, 0x6b, 0x1a],
  [0xff, 0x8a, 0x4c],
]

const paths: string[] = pick(
  ROUTES.map((x) => x.path as string),
  process.env.ROUTES,
  (s) => s,
)
const widths = pick([360, 375, 390, 768, 1280, 1440], process.env.WIDTHS, Number).filter(
  (w) => w !== 375,
)
const headerWidth = pick([375], process.env.WIDTHS ?? '375', Number).length > 0
const tiers = pick(TIERS, process.env.TIERS ?? 'still,svg', (s) => s as Tier).filter(
  (t) => t !== 'webgl',
)
const slug = (p: string) => (p === '/' ? 'home' : p.slice(1).replace(/\//g, '_'))
const dir = () => artifactsDir('shots')

test.afterAll(() => {
  mergeParts('shots', 'orange.json')
})

async function open(page: Page, path: string, tier: Tier) {
  await gotoTier(page, path, tier)
  await fontsReady(page)
  await page.waitForTimeout(tier === 'still' ? 200 : 1200)
}

/** Share of orange pixels per viewport-high slice of a PNG, measured on a canvas in the page. */
async function orangeSlices(page: Page, png: Buffer, sliceH: number) {
  return page.evaluate(
    async ({ b64, sliceH, oranges }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const out: number[] = []
      for (let y = 0; y < c.height; y += sliceH) {
        const h = Math.min(sliceH, c.height - y)
        const d = ctx.getImageData(0, y, c.width, h).data
        let n = 0
        for (let i = 0; i < d.length; i += 4)
          if (
            oranges.some(
              ([r, g, b]) =>
                Math.abs(d[i] - r) <= 24 &&
                Math.abs(d[i + 1] - g) <= 24 &&
                Math.abs(d[i + 2] - b) <= 24,
            )
          )
            n++
        out.push(Math.round((n / (c.width * h)) * 10000) / 10000)
      }
      return out
    },
    { b64: png.toString('base64'), sliceH, oranges: ORANGES },
  )
}

for (const tier of tiers) {
  for (const width of widths) {
    test.describe(`${tier} @${width}`, () => {
      const height = width < 768 ? 844 : 800
      test.use({ viewport: { width, height } })
      for (const path of paths) {
        test(`shot ${path} ${tier} @${width}`, async ({ page, guard }) => {
          await open(page, path, tier)
          const name = `${slug(path)}-${width}-${tier}`
          const png = await page.screenshot({
            path: join(dir(), `${name}.png`),
            fullPage: true,
            animations: 'disabled',
          })
          const slices = await orangeSlices(page, png, height)
          const max = Math.max(0, ...slices)
          writePart('shots', name, { route: path, tier, width, max, slices })
          if (width === 1280 || width === 390) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
            await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({
              path: join(dir(), `${name}-first.png`),
              animations: 'disabled',
            })
          }
          expect(guard.errors).toEqual([])
          expect(
            slices.map((s, i) => [i, s]).filter(([, s]) => s > ORANGE_MAX),
            `orange over ${ORANGE_MAX * 100}% in a viewport slice [slice, share]`,
          ).toEqual([])
        })
      }
    })
  }
}

if (headerWidth)
  test.describe('header @375', () => {
    test.use({ viewport: { width: 375, height: 812 } })
    for (const tier of tiers)
      for (const path of paths)
        test(`header ${path} ${tier} @375`, async ({ page }) => {
          await open(page, path, tier)
          await page
            .locator('header')
            .first()
            .screenshot({ path: join(dir(), `${slug(path)}-375-${tier}-header.png`) })
          const w = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(w, 'no sideways scroll at 375').toBeLessThanOrEqual(375)
        })
  })
