/**
 * Every byte budget in one pass, outside the test runner (for reviewers and
 * the W3 evidence run): initial JS and preloaded fonts in real Chrome on a
 * Pixel 7 profile, plus HTML brotli, per route, against budgets.json.
 * Methods: PLAN Appendix B §B10 (scripts/budgets/measure.mjs).
 *
 *   node scripts/budgets/check.mjs [--base URL] [--routes /,/about] [--desktop]
 *
 * Env: PLAYWRIGHT_BASE_URL, ROUTES, ARTIFACTS_DIR (writes budgets/summary.json).
 * Starts `next start` on this lane's PORT when nothing is serving.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'
import {
  ROOT,
  baseUrl,
  budgets,
  ensureServer,
  flag,
  kb,
  outDir,
  routes,
  writeJson,
} from './lib.mjs'
import { initialJs, preloadedFonts } from './measure.mjs'

const require = createRequire(join(ROOT, 'package.json'))
const { chromium, devices } = require('@playwright/test')

const base = baseUrl()
const B = budgets().bytes
const server = await ensureServer(base)
const browser = await chromium.launch({ channel: 'chrome' })
const rows = []
try {
  const ctx = await browser.newContext(
    flag('--desktop')
      ? { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
      : devices['Pixel 7'],
  )
  for (const route of routes()) {
    const page = await ctx.newPage()
    const js = await initialJs(page, `${base}${route}`)
    const fonts = await preloadedFonts(page)
    await page.close()
    const html = Buffer.from(await (await fetch(`${base}${route}`)).arrayBuffer())
    const br = brotliCompressSync(html, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length
    rows.push({
      route,
      initialJsGzipKB: kb(js.gzipBytes),
      initialJsFiles: js.files.length,
      fontsPreloadKB: kb(fonts.bytes),
      htmlBrotliKB: kb(br),
      pass: {
        initialJs: js.gzipBytes <= B.initialJsGzip,
        fonts: fonts.bytes <= B.preloadFonts,
        html: br <= B.htmlBrotli,
      },
      js: js.files,
      fonts: fonts.files,
    })
  }
} finally {
  await browser.close()
  await server.stop()
}

const pass = rows.every((r) => Object.values(r.pass).every(Boolean))
const file = writeJson(join(outDir('budgets'), 'summary.json'), {
  at: new Date().toISOString(),
  base,
  limitsKB: {
    initialJsGzip: kb(B.initialJsGzip),
    preloadFonts: kb(B.preloadFonts),
    htmlBrotli: kb(B.htmlBrotli),
  },
  pass,
  routes: rows,
})
for (const r of rows)
  console.log(
    `${Object.values(r.pass).every(Boolean) ? 'ok  ' : 'FAIL'} ${r.route}: JS ${r.initialJsGzipKB} KB gz, fonts ${r.fontsPreloadKB} KB, HTML ${r.htmlBrotliKB} KB br`,
  )
console.log(`budgets: ${pass ? 'PASS' : 'FAIL'} (${file})`)
process.exit(pass ? 0 : 1)
