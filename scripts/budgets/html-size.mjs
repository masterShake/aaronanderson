/**
 * HTML budget (PLAN Appendix B §B10): the brotli size (quality 11) of each
 * route's HTML, against budgets.json bytes.htmlBrotli. Second half of
 * `npm run perf:budgets`; starts `next start` on this lane's PORT itself when
 * nothing is serving (the build must exist).
 *
 *   node scripts/budgets/html-size.mjs [--base URL] [--routes /,/about] [--json]
 *
 * Env: PLAYWRIGHT_BASE_URL, ROUTES, ARTIFACTS_DIR (writes budgets/html.json).
 */
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { baseUrl, budgets, ensureServer, flag, kb, outDir, routes, writeJson } from './lib.mjs'

const base = baseUrl()
const max = budgets().bytes.htmlBrotli
const server = await ensureServer(base)
const rows = []
try {
  for (const route of routes()) {
    const res = await fetch(`${base}${route}`)
    const html = Buffer.from(await res.arrayBuffer())
    const br = brotliCompressSync(html, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length
    rows.push({
      route,
      status: res.status,
      rawBytes: html.length,
      gzipBytes: gzipSync(html, { level: 9 }).length,
      brotliBytes: br,
      brotliKB: kb(br),
      maxKB: kb(max),
      pass: res.status === 200 && br <= max,
    })
  }
} finally {
  await server.stop()
}

const pass = rows.every((r) => r.pass)
const file = writeJson(join(outDir('budgets', 'artifacts/budgets'), 'html.json'), {
  at: new Date().toISOString(),
  base,
  budgetBytes: max,
  pass,
  routes: rows,
})
if (flag('--json')) console.log(JSON.stringify(rows, null, 2))
else
  for (const r of rows)
    console.log(
      `${r.pass ? 'ok  ' : 'FAIL'} ${r.route} html brotli ${r.brotliKB} KB (max ${r.maxKB} KB)${r.status === 200 ? '' : ` status ${r.status}`}`,
    )
console.log(`html-size: ${pass ? 'PASS' : 'FAIL'} (${file})`)
process.exit(pass ? 0 : 1)
