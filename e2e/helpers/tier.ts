import type { Page } from '@playwright/test'
import type { Tier } from '../routes'

/**
 * Opens a path on a forced tier (?tier=still|svg|webgl). The still tier also
 * emulates reduced motion, as a real still visitor would have it.
 */
export async function gotoTier(page: Page, path: string, tier: Tier) {
  await page.emulateMedia({ reducedMotion: tier === 'still' ? 'reduce' : 'no-preference' })
  const sep = path.includes('?') ? '&' : '?'
  const [p, hash] = path.split('#')
  const res = await page.goto(`${p}${sep}tier=${tier}${hash ? `#${hash}` : ''}`)
  await page.waitForFunction(
    (t) => document.documentElement.dataset.tier === t || t === 'webgl',
    tier,
  )
  return res
}
