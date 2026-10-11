import type { Page } from '@playwright/test'

/**
 * Freezes every CSS and Web animation at `ms` from its start (for storyboard
 * frames), and asks the Stage to seek there too when its debug hook exists.
 */
export async function freezeAt(page: Page, ms: number, scene?: string) {
  await page.evaluate(
    ({ ms, scene }) => {
      for (const a of document.getAnimations()) {
        a.pause()
        a.currentTime = ms
      }
      if (scene) window.__aeStage?.seek(scene as never, { ms })
    },
    { ms, scene },
  )
}

/** Waits for web fonts so screenshots never catch the fallback face. */
export async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}
