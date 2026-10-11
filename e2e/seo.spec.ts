import { test, expect } from './fixtures'
import { ROUTES } from './routes'
import { site } from '../src/content/site'
import { seo } from '../src/content/seo'
import { holdRegistry, isHold } from '../src/content/hold'
import '../src/content/index'
import { isProductionBuild, pngSize } from './helpers/budgets'

/**
 * The SEO surface (PLAN D12): per-page metadata and OG images, JSON-LD,
 * sitemap, robots, manifest and icons. Device-independent, so it runs in the
 * desktop project only.
 */

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'the SEO checks run in the desktop project')
})

const KEY = {
  '/': 'home',
  '/services': 'services',
  '/how-it-works': 'how-it-works',
  '/about': 'about',
  '/contact': 'contact',
} as const
const PREVIEW = ['/kit', '/punch-list']
const abs = (p: string) => (p === '/' ? site.url : `${site.url}${p}`)

/** Every HOLD note, so JSON-LD can be checked for placeholder text. */
const holdNotes = () =>
  holdRegistry()
    .filter(isHold)
    .map((h) => h.note)

/** The JSON-LD blocks of a page, raw and parsed. */
async function jsonLd(html: string) {
  const blocks = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ]
  return blocks.map((m) => ({ raw: m[1], data: JSON.parse(m[1]) as Record<string, unknown> }))
}

const graphTypes = (data: Record<string, unknown>) =>
  ((data['@graph'] as { '@type': string }[] | undefined) ?? []).map((n) => n['@type'])

for (const r of ROUTES) {
  test(`metadata and OG image ${r.path}`, async ({ page, request }) => {
    const s = seo[KEY[r.path]]
    await page.goto(r.path)
    const meta = (sel: string) => page.locator(sel).first().getAttribute('content')
    expect(await page.title()).toContain(s.title)
    expect(await meta('meta[name="description"]')).toBe(s.description)
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(abs(r.path))
    expect(await meta('meta[property="og:title"]')).toBe(s.og.title)
    expect(await meta('meta[property="og:locale"]')).toBe('en_US')
    expect(await meta('meta[property="og:site_name"]')).toBe(site.name)
    expect(await meta('meta[property="og:image:alt"]')).toBe(s.og.alt)
    expect(await meta('meta[property="og:image:width"]')).toBe('1200')
    expect(await meta('meta[property="og:image:height"]')).toBe('630')
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

    const og = (await meta('meta[property="og:image"]')) ?? ''
    expect(og.startsWith(`${abs(r.path === '/' ? '' : r.path)}/opengraph-image`)).toBe(true)
    const img = await request.get(new URL(og).pathname + new URL(og).search)
    expect(img.status()).toBe(200)
    expect(img.headers()['content-type']).toBe('image/png')
    expect(pngSize(await img.body())).toEqual({ width: 1200, height: 630 })
  })

  test(`JSON-LD ${r.path}`, async ({ request }) => {
    const html = await (await request.get(r.path)).text()
    const blocks = await jsonLd(html)
    expect(blocks.length).toBeGreaterThan(0)
    const notes = holdNotes()
    for (const b of blocks) {
      expect(b.raw, 'every < is escaped').not.toContain('<')
      expect(b.raw).not.toMatch(/"offers"/)
      expect(b.raw).not.toMatch(/\bHOLD\b/)
      for (const n of notes) expect(b.raw, `HOLD text in JSON-LD: ${n}`).not.toContain(n)
    }
    const site = blocks.find((b) => graphTypes(b.data).includes('Organization'))
    expect(site, 'Organization and WebSite in one @graph').toBeTruthy()
    expect(graphTypes(site!.data)).toEqual(['Organization', 'WebSite'])
    if (r.path === '/services') {
      const svc = blocks.find((b) => graphTypes(b.data).includes('Service'))
      expect(svc).toBeTruthy()
      const types = graphTypes(svc!.data)
      expect(types.filter((t) => t === 'Service')).toHaveLength(6)
      expect(types).toContain('BreadcrumbList')
    } else {
      expect(blocks.some((b) => graphTypes(b.data).includes('Service'))).toBe(false)
    }
  })
}

test('sitemap lists exactly the five sheets', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  expect(locs.sort()).toEqual(ROUTES.map((r) => abs(r.path)).sort())
})

test('robots disallows the preview pages and points at the sitemap', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text()
  for (const p of PREVIEW) expect(txt).toMatch(new RegExp(`^Disallow: ${p}$`, 'm'))
  expect(txt).toMatch(new RegExp(`^Sitemap: ${site.url}/sitemap\\.xml$`, 'm'))
  expect(txt).not.toMatch(/^Disallow: \/$/m)
})

test('manifest and icons', async ({ page, request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json()
  expect(m.name).toBe(site.name)
  expect(m.icons.length).toBeGreaterThan(0)
  for (const i of m.icons as { src: string; type: string }[]) {
    const r = await request.get(i.src)
    expect(r.status(), i.src).toBe(200)
    expect(r.headers()['content-type'], i.src).toContain(i.type)
  }
  for (const p of ['/favicon.ico', '/icon.svg', '/apple-icon', '/brand/logo-512.png'])
    expect((await request.get(p)).status(), p).toBe(200)
  await page.goto('/')
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /icon/)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
})

test('indexing follows the build: production indexable, everything else noindex', async ({
  page,
  request,
}) => {
  const prod = await isProductionBuild(page)
  const res = await request.get('/')
  const robotsHeader = res.headers()['x-robots-tag']
  await page.goto('/')
  const metaRobots = await page.locator('meta[name="robots"]').getAttribute('content')
  if (prod) {
    expect(robotsHeader).toBeUndefined()
    expect(metaRobots).toMatch(/^index/)
  } else {
    expect(robotsHeader).toMatch(/noindex/)
    expect(metaRobots).toMatch(/noindex/)
  }
  for (const p of PREVIEW) {
    const r = await request.get(p)
    if (prod) expect(r.status(), p).toBe(404)
    else {
      expect(r.status(), p).toBe(200)
      expect(await r.text(), p).toMatch(/<meta name="robots" content="noindex/)
    }
  }
})
