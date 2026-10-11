import { join } from 'node:path'
import { test, expect } from './fixtures'
import { gotoTier } from './helpers/tier'
import { fontsReady, freezeAt } from './helpers/freeze'
import { artifactsDir } from './helpers/budgets'

/**
 * Storyboard frames (shots project) for the craft review:
 * - the hero on `/` (svg tier) frozen at each storyboard time, at 1280×800 and 390×844;
 * - each service figure on the /kit/fig/<id> harness at p = 0, .25, .5, .75 and 1
 *   (until the pages merge in W2).
 * A target that is still a W0 stub, or a harness that is not merged yet, is
 * skipped with the reason. FIGURES narrows the service figures (s01,s03).
 * Output: $ARTIFACTS_DIR/frames/.
 */

const HERO_MS = [0, 600, 1320, 1700, 2400, 2950, 3070, 4000, 4670, 9000, 18500, 25000]
const PROGRESS = [0, 0.25, 0.5, 0.75, 1]
const SERVICE_FIGS = ['s01', 's02', 's03', 's04', 's05', 's06']
const figs = process.env.FIGURES
  ? process.env.FIGURES.split(',').filter((f) => SERVICE_FIGS.includes(f))
  : SERVICE_FIGS
const dir = () => artifactsDir('frames')

for (const [width, height] of [
  [1280, 800],
  [390, 844],
] as const) {
  test.describe(`hero @${width}`, () => {
    test.use({ viewport: { width, height } })
    test(`hero storyboard @${width}`, async ({ page }) => {
      await gotoTier(page, '/', 'svg')
      const fig = page.locator('#fig-hero')
      test.skip(!(await fig.count()), 'the hero figure (#fig-hero) is not on / yet')
      const layers = await page.locator('#fig-hero [class*="l-"] path').count()
      test.skip(layers === 0, 'the hero is still the W0 stub (no drawn layers); frames come in W2')
      await fontsReady(page)
      await fig.scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      for (const ms of HERO_MS) {
        await freezeAt(page, ms, 'hero')
        await page.waitForTimeout(50)
        await fig.screenshot({
          path: join(dir(), `hero-${width}-${String(ms).padStart(5, '0')}ms.png`),
        })
      }
      expect(HERO_MS.length).toBe(12)
    })
  })
}

for (const id of figs) {
  test(`service figure ${id} at p = 0 … 1`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const res = await gotoTier(page, `/kit/fig/${id}`, 'svg')
    test.skip(res?.status() === 404, `/kit/fig/${id} is not there yet (drawings lane harness)`)
    const fig = page.locator(`#fig-${id}`)
    test.skip(!(await fig.count()), `#fig-${id} is not rendered by the harness yet`)
    await fontsReady(page)
    for (const p of PROGRESS) {
      await gotoTier(page, `/kit/fig/${id}?p=${p}`, 'svg')
      await page.evaluate(
        ({ id, p }) => {
          const el = document.getElementById(`fig-${id}`)
          el?.style.setProperty('--p', String(p))
          window.__aeStage?.seek(id as never, { p })
        },
        { id, p },
      )
      await page.waitForTimeout(300)
      await fig.screenshot({ path: join(dir(), `${id}-p${p.toFixed(2)}.png`) })
    }
  })
}
