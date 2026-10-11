/**
 * Reviewer screenshots without the test runner: every route × width × tier as
 * full-page PNGs plus an index.html contact sheet. `npm run shots` (e2e/shots.spec.ts)
 * is the gated version with first-viewport shots and the orange ratio.
 *
 *   node scripts/screenshots.mjs [--base URL] [--routes /,/about] [--widths 390,1280]
 *                                [--tiers still,svg] [--at 0,1500,2950]
 *
 * --at freezes every animation at those milliseconds (svg tier only) and takes one
 * shot per time. Output: $ARTIFACTS_DIR/screenshots/<stamp>/ or artifacts/screenshots/<stamp>/.
 * Env: PLAYWRIGHT_BASE_URL, ROUTES, WIDTHS, TIERS. Starts `next start` on this lane's
 * PORT when nothing is serving. Real Chrome only (channel 'chrome').
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, arg, baseUrl, ensureServer, list, outDir, routes } from './budgets/lib.mjs'

const require = createRequire(join(ROOT, 'package.json'))
const { chromium } = require('@playwright/test')

const base = baseUrl()
const widths = list(arg('--widths') ?? process.env.WIDTHS ?? '360,390,768,1280,1440').map(Number)
const tiers = list(arg('--tiers') ?? process.env.TIERS ?? 'still,svg')
const at = list(arg('--at', '')).map(Number)
const dir = join(outDir('screenshots'), new Date().toISOString().replace(/[:.]/g, '-'))
mkdirSync(dir, { recursive: true })

const server = await ensureServer(base)
const browser = await chromium.launch({ channel: 'chrome' })
const cells = []
try {
  for (const tier of tiers) {
    for (const w of widths) {
      const page = await browser.newPage({
        viewport: { width: w, height: 900 },
        reducedMotion: tier === 'still' ? 'reduce' : 'no-preference',
      })
      for (const r of routes()) {
        await page.goto(`${base}${r}${r.includes('?') ? '&' : '?'}tier=${tier}`, {
          waitUntil: 'load',
        })
        await page.evaluate(() => document.fonts.ready.then(() => undefined))
        await page.waitForTimeout(tier === 'still' ? 200 : 1000)
        for (const t of at.length && tier === 'svg' ? at : [null]) {
          if (t !== null)
            await page.evaluate((ms) => {
              for (const a of document.getAnimations()) {
                a.pause()
                a.currentTime = ms
              }
            }, t)
          const name = `${r === '/' ? 'home' : r.slice(1).replace(/\//g, '_')}-${w}-${tier}${t !== null ? `-${t}ms` : ''}.png`
          await page.screenshot({
            path: join(dir, name),
            fullPage: true,
            animations: t === null ? 'disabled' : 'allow',
          })
          cells.push(name)
        }
      }
      await page.close()
    }
  }
} finally {
  await browser.close()
  await server.stop()
}
writeFileSync(
  join(dir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>shots</title><body style="font:12px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${cells
    .map(
      (c) => `<figure><img src="${c}" width="100%" alt=""><figcaption>${c}</figcaption></figure>`,
    )
    .join('')}</body>`,
)
console.log(`${cells.length} shots → ${join(dir, 'index.html')}`)
