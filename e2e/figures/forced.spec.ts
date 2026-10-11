import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'

/**
 * Forced colors drop background colors, so a pressed button that differs only by its fill
 * looks the same as one that is not pressed (D7, WCAG 1.4.1 / 4.1.2). Each pressed control
 * in a figure must still differ from its unpressed sibling in what forced colors keep:
 * outline, border or system colors.
 *   npx playwright test e2e/figures/forced.spec.ts --project=desktop
 */

/** What forced colors leave visible on a control. */
const look = (el: Locator) =>
  el.evaluate((n) => {
    const c = getComputedStyle(n)
    return [
      c.outlineStyle === 'none' ? 'none' : `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`,
      `${c.borderTopStyle} ${c.borderTopWidth}`,
      c.backgroundColor,
      c.color,
    ].join(' | ')
  })

async function forced(page: Page) {
  await page.emulateMedia({ forcedColors: 'active' })
}

test('Home schematic: the pressed As found / Rewired segment shows in forced colors', async ({
  page,
}) => {
  await forced(page)
  await gotoTier(page, '/', 'svg')
  await page.locator('#fig-firm [data-state-value]').first().scrollIntoViewIfNeeded()
  const on = page.locator('#fig-firm [data-state-value][aria-pressed="true"]')
  const off = page.locator('#fig-firm [data-state-value][aria-pressed="false"]').first()
  await expect(on).toHaveCount(1)
  // no focus ring in play: the difference must be the pressed state's own
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  expect(await look(on)).not.toBe(await look(off))
})

test('S-04: the pressed question chip shows in forced colors', async ({ page }) => {
  await forced(page)
  await gotoTier(page, '/kit/fig/s04', 'svg')
  const chips = page.locator('#fig-s04 button[data-q]')
  await chips.first().scrollIntoViewIfNeeded()
  await chips.nth(1).click()
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')
  expect(await look(chips.nth(1))).not.toBe(await look(chips.nth(0)))
  expect(await look(chips.nth(1))).not.toBe(await look(chips.nth(2)))
})
