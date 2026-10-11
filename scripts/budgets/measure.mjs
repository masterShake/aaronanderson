/**
 * The byte-budget measurements of PLAN Appendix B §B10, shared by
 * e2e/budgets.spec.ts (through e2e/helpers/budgets.ts) and scripts/budgets/check.mjs.
 *
 * - Initial JS: gzip-9 sum of every same-origin JS response fetched before the
 *   load event + 2 s, on ?tier=still (reduced motion, so no 3D and no figure JSON).
 * - Preloaded fonts: the summed bytes of every <link rel=preload as=font>.
 */
import { gzipSync } from 'node:zlib'

const isJs = (res) => {
  const type = res.request().resourceType()
  const ct = res.headers()['content-type'] ?? ''
  return type === 'script' || /javascript/.test(ct)
}

/**
 * Opens `route` on the still tier in `page` and returns the initial JS.
 * @param {import('@playwright/test').Page} page
 * @param {string} url absolute or baseURL-relative path
 * @param {{ settleMs?: number }} [opts]
 */
export async function initialJs(page, url, opts = {}) {
  const settleMs = opts.settleMs ?? 2000
  /** @type {Promise<{ href: string, raw: number, gzip: number } | null>[]} */
  const pending = []
  let open = true
  const onResponse = (res) => {
    if (!open || !isJs(res)) return
    const href = res.url()
    pending.push(
      res
        .body()
        .then((b) => ({ href, raw: b.length, gzip: gzipSync(b, { level: 9 }).length }))
        .catch(() => null),
    )
  }
  page.on('response', onResponse)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const sep = url.includes('?') ? '&' : '?'
  const target = `${url}${sep}tier=still`
  const res = await page.goto(target, { waitUntil: 'load' })
  const origin = new URL(page.url()).origin
  await page.waitForTimeout(settleMs)
  open = false
  page.off('response', onResponse)
  /** @type {Map<string, { url: string, raw: number, gzip: number }>} */
  const seen = new Map()
  for (const f of await Promise.all(pending)) {
    if (!f) continue
    const u = new URL(f.href)
    if (u.origin === origin && !seen.has(u.pathname))
      seen.set(u.pathname, { url: u.pathname, raw: f.raw, gzip: f.gzip })
  }
  const files = [...seen.values()].sort((a, b) => b.gzip - a.gzip)
  return {
    status: res?.status() ?? 0,
    gzipBytes: files.reduce((s, f) => s + f.gzip, 0),
    rawBytes: files.reduce((s, f) => s + f.raw, 0),
    files,
  }
}

/**
 * The fonts the current page preloads, with their sizes.
 * @param {import('@playwright/test').Page} page
 */
export async function preloadedFonts(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(
      (l) => /** @type {HTMLLinkElement} */ (l).href,
    ),
  )
  const files = []
  for (const href of [...new Set(hrefs)]) {
    const r = await page.request.get(href)
    files.push({ url: new URL(href).pathname, bytes: (await r.body()).length })
  }
  return { bytes: files.reduce((s, f) => s + f.bytes, 0), files }
}
