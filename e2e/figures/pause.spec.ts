import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'

/**
 * WCAG 2.2.2 (Pause, Stop, Hide): a figure whose motion can run past 5 s carries the motion
 * switch in its own strip, where it plays, not only in the header or footer. The lens
 * measured these at 390 (touch plays on entry): hero ~22 s, S-02 ~22 s, S-03 ~8.5 s,
 * S-04 ~5.2 s, S-06 ~11 s.
 *   npx playwright test e2e/figures/pause.spec.ts --project=mobile
 */

const LONG: [string, string][] = [
  ['/', 'hero'],
  ['/services', 's02'],
  ['/services', 's03'],
  ['/services', 's04'],
  ['/services', 's06'],
]

for (const [path, id] of LONG) {
  test(`${id} shows a Pause switch in its strip`, async ({ page }) => {
    await gotoTier(page, path, 'svg')
    const fig = page.locator(`#fig-${id}`)
    await fig.scrollIntoViewIfNeeded()
    await expect(fig.locator('input[data-motion-switch]')).toHaveCount(1)
    await expect(fig.locator('label:has(input[data-motion-switch])')).toBeVisible()
  })
}
