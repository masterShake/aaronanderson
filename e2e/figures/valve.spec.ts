import { test, expect } from '../fixtures'

/**
 * The sign-off detail on the /kit/fig harness: layers load, it plays once on
 * entry and ends on its final frame (APPROVED and five logbook lines), Replay
 * restarts it for this figure only, and reduced motion rests on the final
 * frame with Play the drawing.
 */

const URL = '/kit/fig/valve?tier=svg'

test('plays once on entry and ends approved, with five log lines', async ({ page, guard }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect(fig).toHaveAttribute('data-inview', '')
  expect(await fig.locator('svg text').count()).toBe(0)
  await expect(fig.locator('[data-part="pk.4"]')).toHaveCount(1)
  await expect(fig.locator('[data-line]')).toHaveCount(5)
  // let the sequence finish (4.6 s) and check the final frame
  await page.waitForTimeout(5200)
  for (const line of await fig.locator('[data-line]').all())
    await expect.poll(() => line.evaluate((e) => getComputedStyle(e).opacity)).toBe('1')
  await expect(fig.locator('[data-label="approved"]')).toBeVisible()
  expect(guard.errors).toEqual([])
})

test('Replay restarts the sequence for this figure only', async ({ page }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await fig.getByRole('button', { name: 'Replay' }).click()
  await expect(fig).toHaveAttribute('data-user-play', '')
  // early in the replay the last log line has not printed yet
  const last = fig.locator('[data-line="5"]')
  expect(Number(await last.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1)
  const stored = await page.evaluate(() => localStorage.getItem('ae:motion'))
  expect(stored).toBeNull()
})

test('reduced motion rests on the final frame and offers Play the drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/kit/fig/valve')
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-phase', 'still')
  await expect(fig.locator('img.still-img:visible')).toHaveCount(1)
  await expect(fig.locator('[data-label="approved"]')).toBeVisible()
  const play = fig.getByRole('button', { name: 'Play the drawing' })
  await expect(play).toBeVisible()
  await play.click()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect(fig).toHaveAttribute('data-user-play', '')
})
