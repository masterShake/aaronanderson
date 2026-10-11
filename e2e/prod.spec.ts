import { test, expect } from './fixtures'
import { ROUTES } from './routes'
import { holdRegistry, isConfirm, isHold } from '../src/content/hold'
import { home } from '../src/content/pages/home'
import { site } from '../src/content/site'
import '../src/content/index'
import { isProductionBuild } from './helpers/budgets'

/**
 * Production mode (PLAN D11, final green): run against a VERCEL_ENV=production
 * build. No HOLD text or markers, no pending CONFIRM, no proof section, the
 * preview pages return 404, JSON-LD carries no HOLD field, and the CSP has no
 * 'unsafe-eval'. Against any other build every test skips with the reason.
 *
 *   VERCEL_ENV=production npm run build (through scripts/with-lock.mjs), then npm run test:prod
 */

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'test:prod runs in the desktop project')
  test.skip(
    !(await isProductionBuild(page)),
    'not a production-mode build (/punch-list answers): build with VERCEL_ENV=production',
  )
})

const all = holdRegistry()
/** HOLD notes long enough to be unmistakable in page text. */
const notes = all
  .filter(isHold)
  .map((h) => h.note)
  .filter((n) => n.length >= 12)
const pendingClaims = all
  .filter(isConfirm)
  .filter((c) => c.status === 'pending' && typeof c.value === 'string')
  .map((c) => c.value as string)
  .filter((v) => v.length >= 24)

for (const r of ROUTES) {
  test(`no placeholders on ${r.path}`, async ({ page, guard }) => {
    const res = await page.goto(r.path)
    expect(res?.status()).toBe(200)
    await expect(page.locator('[data-hold]')).toHaveCount(0)
    await expect(page.locator('[data-confirm]')).toHaveCount(0)
    const text = await page.locator('body').innerText()
    expect(text).not.toContain(site.marks.holdLabel)
    expect(text).not.toContain(site.marks.confirmLabel)
    for (const n of notes) expect(text, `HOLD note on the page: ${n}`).not.toContain(n)
    for (const v of pendingClaims)
      expect(text, `pending CONFIRM on the page: ${v}`).not.toContain(v)
    const html = await (await page.request.get(r.path)).text()
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const n of all.filter(isHold).map((h) => h.note))
        expect(m[1], `HOLD note in JSON-LD: ${n}`).not.toContain(n)
      expect(m[1]).not.toMatch(/"offers"/)
    }
    expect(guard.errors).toEqual([])
  })
}

// /contact only for now: /about's General notes (all pending CONFIRMs) is a W3 pages request
for (const r of ROUTES.filter((x) => x.path === '/contact')) {
  test(`no empty section on ${r.path}`, async ({ page }) => {
    await page.goto(r.path)
    // a section whose HOLD fell away must go with its heading (D11)
    const empty = await page.locator('main section:has(> * h2, > h2)').evaluateAll((els) =>
      els
        .filter((s) => {
          const h = s.querySelector('h2')
          const rest = (s as HTMLElement).innerText.replace(h?.innerText ?? '', '').trim()
          const media = s.querySelector('img, svg, canvas, form, a, button, input')
          return !rest && !media
        })
        .map((s) => s.id || s.querySelector('h2')?.textContent || '?'),
    )
    expect(empty, 'sections with a heading and nothing under it').toEqual([])
  })
}

test('no proof section on Home', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(`#${home.asBuilts.id}`)).toHaveCount(0)
})

test('preview pages and harnesses return 404', async ({ request }) => {
  for (const p of ['/kit', '/kit/stage', '/kit/fig/hero', '/punch-list'])
    expect((await request.get(p)).status(), p).toBe(404)
})

test('headers: CSP without unsafe-eval, indexable, security headers present', async ({
  request,
}) => {
  const h = (await request.get('/')).headers()
  const csp = h['content-security-policy'] ?? h['content-security-policy-report-only']
  expect(csp).toBeTruthy()
  expect(csp).not.toContain("'unsafe-eval'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(h['strict-transport-security']).toMatch(/max-age=\d+/)
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBeTruthy()
  expect(h['permissions-policy']).toBeTruthy()
  expect(h['x-robots-tag']).toBeUndefined()
})

test('the debug surface is gone', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => typeof window.__aeStage)).toBe('undefined')
})
