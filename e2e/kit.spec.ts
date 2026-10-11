import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ROUTES } from './routes'
import { gotoTier } from './helpers/tier'
import { isProductionBuild } from './helpers/budgets'
import { site } from '../src/content/site'
import { notFound } from '../src/content/pages/not-found'

/**
 * Kit lane checks (W1): header fit, the menu popover, motion state before
 * hydration, focus ring, view-transition CSS, color and spacing rules, the
 * /kit sheet, axe on /kit and the five sheets, and layout shift on /.
 * Screenshots and numbers go to $ARTIFACTS_DIR (default test-results/kit).
 * Every test pins its own viewport, so it runs once, in the desktop project.
 */

const ART = process.env.ARTIFACTS_DIR ?? join(__dirname, '../test-results/kit')
mkdirSync(ART, { recursive: true })
const record = (name: string, data: unknown) =>
  writeFileSync(join(ART, `${name}.json`), JSON.stringify(data, null, 2))

const BOOK = site.cta.book
const MENU = site.header.menu

test.skip(({ isMobile }) => isMobile, 'viewports are pinned per test; desktop project only')

// ── 1. Header fit ────────────────────────────────────────────────────────────
test('header fits at 360, 375 and 390 with Book a call on one line, 44 px tall', async ({
  page,
}) => {
  const out: Record<number, { overflowPx: number; bookH: number; bookW: number }> = {}
  for (const w of [360, 375, 390]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const m = await page.evaluate(() => {
      const h = document.querySelector('header')!
      const bar = h.firstElementChild as HTMLElement
      const right = Math.max(...[...bar.children].map((c) => c.getBoundingClientRect().right))
      return {
        overflowPx: Math.max(
          0,
          h.scrollWidth - h.clientWidth,
          document.documentElement.scrollWidth - innerWidth,
          Math.ceil(
            right -
              (bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight)),
          ),
        ),
      }
    })
    const book = page.getByRole('banner').getByRole('link', { name: BOOK })
    const box = (await book.boundingBox())!
    const lineH = await book.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
    const pad = await book.evaluate((el) => {
      const s = getComputedStyle(el)
      return (
        parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.borderTopWidth) * 2
      )
    })
    out[w] = { overflowPx: m.overflowPx, bookH: box.height, bookW: box.width }
    expect(m.overflowPx, `overflow at ${w}`).toBe(0)
    expect(box.height).toBeGreaterThanOrEqual(44)
    // One line: the text box holds a single line.
    expect(box.height - pad).toBeLessThan(lineH * 1.9)
    await expect(page.getByRole('button', { name: MENU })).toBeVisible()
    await page.screenshot({
      path: join(ART, `header-${w}.png`),
      clip: { x: 0, y: 0, width: w, height: 120 },
    })
  }
  record('header', out)
})

test('Book a call is at least 24 by 24 at 1280 and the header has no view-transition name', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const box = (await page.getByRole('banner').getByRole('link', { name: BOOK }).boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(24)
  expect(box.height).toBeGreaterThanOrEqual(24)
  const vtn = await page
    .locator('header')
    .first()
    .evaluate((el) => getComputedStyle(el).viewTransitionName)
  expect(vtn).toBe('none')
  await page.screenshot({
    path: join(ART, 'header-1280.png'),
    clip: { x: 0, y: 0, width: 1280, height: 120 },
  })
})

test('desktop header: sheet chip and the switch words show on one row, 1024 to 1440', async ({
  page,
}) => {
  const out: Record<number, { rowH: number; chip: boolean; words: boolean }> = {}
  for (const w of [1024, 1100, 1280, 1365, 1366, 1440]) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto('/services')
    await page.evaluate(() => document.fonts.ready)
    const m = await page.evaluate(() => {
      const h = document.querySelector('header')!
      const bar = h.firstElementChild as HTMLElement
      const shown = (el: Element | null) => {
        const r = el?.getBoundingClientRect()
        return Boolean(
          r && r.width > 4 && r.height > 4 && getComputedStyle(el!).clipPath === 'none',
        )
      }
      return {
        rowH: Math.round(bar.getBoundingClientRect().height),
        minH: parseFloat(getComputedStyle(bar).minHeight),
        chip: shown(h.querySelector('a[href="/"] > :last-child')),
        words: shown(h.querySelector('label[data-variant="header"] > span:last-child')),
      }
    })
    out[w] = { rowH: m.rowH, chip: m.chip, words: m.words }
    expect(m.rowH, `one row at ${w}`).toBeLessThanOrEqual(m.minH + 1)
  }
  record('header-desktop', out)
  for (const [w, m] of Object.entries(out)) {
    expect(m.chip, `sheet chip shows at ${w}`).toBe(true)
    expect(m.words, `switch words show at ${w}`).toBe(true)
  }
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.screenshot({
    path: join(ART, 'header-1024.png'),
    clip: { x: 0, y: 0, width: 1024, height: 120 },
  })
})

// ── 2. Menu ──────────────────────────────────────────────────────────────────
for (const js of [false, true]) {
  test(`menu popover works ${js ? 'with' : 'without'} JS`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: js,
      baseURL: test.info().project.use.baseURL,
    })
    const page = await ctx.newPage()
    await page.goto('/services')
    const button = page.getByRole('button', { name: MENU })
    const dialog = page.locator('#site-menu')
    // The dialog follows its button in DOM order.
    expect(
      await button.evaluate(
        (b) =>
          !!(
            b.compareDocumentPosition(document.getElementById('site-menu')!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true)
    await button.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link').first()).toBeFocused()
    // Not a trap: Tab moves on through the menu.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
    // Light dismiss.
    await button.click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(4, 820)
    await expect(dialog).toBeHidden()
    if (!js) await page.screenshot({ path: join(ART, 'menu-nojs-closed.png') })
    await ctx.close()
  })
}

test('choosing a sheet in the menu closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: MENU }).click()
  await page.screenshot({ path: join(ART, 'menu-390.png') })
  await page
    .locator('#site-menu')
    .getByRole('link', { name: /services/i })
    .click()
  await expect(page).toHaveURL(/\/services$/)
  await expect(page.locator('#site-menu')).toBeHidden()
})

// ── 3–4. Motion state ────────────────────────────────────────────────────────
test('with JS off the switch pauses CSS animations through :has()', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: false,
    baseURL: test.info().project.use.baseURL,
  })
  const page = await ctx.newPage()
  await page.goto('/')
  const state = () => page.evaluate(() => getComputedStyle(document.body).animationPlayState)
  expect(await state()).toBe('running')
  await page.locator('header input[data-motion-switch]').filter({ visible: true }).check()
  expect(await state()).toBe('paused')
  await ctx.close()
})

test('a stored pause applies before first paint, and data-motion is only run or paused', async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('kit-seeded')) {
        localStorage.setItem('ae:motion', 'paused')
        sessionStorage.setItem('kit-seeded', '1')
      }
    } catch {}
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  // Read the attribute from the first parsed <body>, before any paint can happen.
  await page.addInitScript(() => {
    document.addEventListener(
      'readystatechange',
      () => {
        ;(window as unknown as { __m0?: string }).__m0 ??= document.documentElement.dataset.motion
      },
      { once: true },
    )
  })
  await page.goto('/')
  expect(await page.evaluate(() => (window as unknown as { __m0?: string }).__m0)).toBe('paused')
  const sw = page.locator('header input[data-motion-switch]').filter({ visible: true })
  await expect(sw).toBeChecked()
  const seen = new Set<string>()
  for (let i = 0; i < 3; i++) {
    await sw.click()
    seen.add((await page.locator('html').getAttribute('data-motion')) ?? '')
  }
  expect([...seen].every((v) => v === 'run' || v === 'paused')).toBe(true)
  // Turning motion back on brings the svg tier back without a reload.
  await sw.check()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  await page.locator('header input[data-motion-switch]').filter({ visible: true }).uncheck()
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'svg')
})

// ── 5. Focus ring ────────────────────────────────────────────────────────────
test('focus ring is 3 px with a 3 px offset, asphalt on paper and paper on dark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.keyboard.press('Tab') // skip link
  await page.keyboard.press('Tab') // wordmark
  const ring = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement!)
    return { w: s.outlineWidth, o: s.outlineOffset, c: s.outlineColor, st: s.outlineStyle }
  })
  expect(ring).toEqual({ w: '3px', o: '3px', c: 'rgb(42, 44, 46)', st: 'solid' })
  const dark = await page
    .locator('footer a')
    .first()
    .evaluate((el) => {
      ;(el as HTMLElement).focus({ focusVisible: true } as FocusOptions)
      return getComputedStyle(el).getPropertyValue('--c-focus').trim()
    })
  expect(dark.toLowerCase()).toMatch(/f4f2ec|var\(--c-paper\)/)
  // CAD grips on buttons: the ::after grip layer exists on Book a call.
  const grips = await page
    .getByRole('banner')
    .getByRole('link', { name: BOOK })
    .evaluate((el) => getComputedStyle(el, '::after').backgroundImage)
  expect(grips).toContain('linear-gradient')
})

// ── 7. View transitions ─────────────────────────────────────────────────────
test('view-transition rules: no pointer events, root never animates, 420 ms print, off for reduced motion', async ({
  page,
}) => {
  await page.goto('/')
  const css = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText)
        } catch {
          return []
        }
      })
      .join('\n'),
  )
  expect(css).toMatch(/::view-transition\s*\{\s*pointer-events:\s*none/)
  expect(css).toMatch(/::view-transition-group\(root\)[^{]*\{[^}]*\bnone\b/)
  expect(css).toMatch(/::view-transition-new\(\*?\.sheet-print\)/)
  expect(css).toMatch(/@keyframes ae-vt-ltr/)
  expect(css).toMatch(/inset\(0px 100% 0px 0px\)|inset\(0 100% 0 0\)/)
  expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*::view-transition-group\(\*\)/)
  const dur = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--dur-sheet').trim(),
  )
  expect(dur).toBe('420ms')
})

// ── 8–9. Color and spacing ───────────────────────────────────────────────────
async function colorAudit(page: Page) {
  return page.evaluate(() => {
    const rgb = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).map(Number)
    const isGreen = (s: string) => {
      const [r, g, b, a = 1] = rgb(s)
      return a > 0 && g! > r! + 40 && g! > b! + 40
    }
    const isOrange = (s: string) => {
      const [r, g, b, a = 1] = rgb(s)
      return a > 0 && r! > 230 && g! > 90 && g! < 150 && b! < 90
    }
    const green: string[] = []
    const orange: string[] = []
    const radius: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('svg, .fig, [aria-hidden="true"], script, style')) continue
      const s = getComputedStyle(el)
      for (const c of [s.color, s.backgroundColor, s.borderTopColor, s.outlineColor])
        if (isGreen(c)) green.push(el.tagName + '.' + el.className)
      if (isOrange(s.backgroundColor) || isOrange(s.color)) {
        const book = el.closest('[data-variant="book"]')
        if (!book) orange.push(el.tagName + '.' + el.className)
      }
      if (s.borderTopLeftRadius !== '0px' && el.tagName !== 'INPUT')
        radius.push(el.tagName + '.' + el.className)
    }
    return { green, orange, radius }
  })
}

test('no green, orange only on Book a call outside figures, radius 0', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const path of ['/', '/kit', '/how-it-works']) {
    await page.goto(path)
    const a = await colorAudit(page)
    expect(a.green, path).toEqual([])
    expect(a.orange, path).toEqual([])
    expect(a.radius, path).toEqual([])
  }
})

test('margins, section padding and max width follow the tokens', async ({ page }) => {
  for (const [w, margin, pad] of [
    [390, 16, 48],
    [1280, 51.2, 76.8],
    [1920, 56, 96],
  ] as const) {
    await page.setViewportSize({ width: w, height: 800 })
    await page.goto('/how-it-works')
    const m = await page.evaluate(() => {
      const wrap = document.querySelector('main .wrap') as HTMLElement
      const sec = [...document.querySelectorAll('main section')].find(
        (s) => !s.classList.length || s.className.includes('wrap'),
      ) as HTMLElement
      return {
        margin: parseFloat(getComputedStyle(wrap).paddingLeft),
        max: parseFloat(getComputedStyle(wrap).maxWidth),
        pad: parseFloat(getComputedStyle(sec ?? wrap).paddingTop),
      }
    })
    expect(m.margin).toBeCloseTo(margin, 0)
    expect(m.max).toBe(1440)
    expect(m.pad).toBeCloseTo(pad, 0)
  }
})

// ── 10. /kit ─────────────────────────────────────────────────────────────────
test('/kit renders every group and is noindex in preview', async ({ page, guard }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const res = await page.goto('/kit')
  const prod = process.env.SITE_PROD === '1'
  if (prod) {
    expect(res?.status()).toBe(404)
    return
  }
  expect(res?.status()).toBe(200)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  for (const id of [
    'chrome',
    'buttons',
    'motion',
    'holds',
    'type',
    'marks',
    'dimensions',
    'tables',
    'legend',
    'figure',
  ])
    await expect(page.locator(`#kit-${id}`)).toBeVisible()
  await page.screenshot({ path: join(ART, 'kit-1280.png'), fullPage: true })
  expect(guard.errors).toEqual([])
})

// ── 404 and errors ───────────────────────────────────────────────────────────
test('404 sheet: one H1, links to all five sheets, Book a call, static cloud', async ({ page }) => {
  for (const w of [390, 1280]) {
    await page.setViewportSize({ width: w, height: 900 })
    const res = await page.goto('/no-such-sheet')
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(notFound.h1)
    const nav = page.getByRole('navigation', { name: notFound.links })
    for (const it of site.nav) await expect(nav.locator(`a[href="${it.href}"]`)).toBeVisible()
    await expect(nav.getByRole('link', { name: BOOK })).toBeVisible()
    await expect(page.locator('#fig-not-found')).toBeVisible()
    await page.screenshot({ path: join(ART, `404-${w}.png`), fullPage: true })
  }
})

// ── Intent prefetch (§B10 initial JS, W2 handover #1) ────────────────────────
test('footer and 404 sheet lists put the plain label before the sheet number', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/no-such-sheet')
  const lists = [
    page.getByRole('contentinfo').getByRole('navigation', { name: site.titleBlock.sheetIndex }),
    page.getByRole('navigation', { name: notFound.links }),
  ]
  for (const nav of lists)
    for (const it of site.nav) {
      const text = (await nav.locator(`a[href="${it.href}"]`).innerText()).trim().toUpperCase()
      expect(text.startsWith(it.label.toUpperCase()), `"${text}" starts with ${it.label}`).toBe(
        true,
      )
      expect(text).toContain(it.sheet.toUpperCase())
    }
})

test('production footer leaves out a contact cell with no value (D11)', async ({ page }) => {
  test.skip(!(await isProductionBuild(page)), 'needs a VERCEL_ENV=production build')
  await page.goto('/')
  const cells = page.getByRole('contentinfo').locator('dl > div')
  const n = await cells.count()
  for (let i = 0; i < n; i++) {
    const dd = (await cells.nth(i).locator('dd').innerText()).trim()
    const dt = (await cells.nth(i).locator('dt').innerText()).trim()
    expect(dd, `${dt} has a value`).not.toBe('')
  }
})

test('links to other sheets prefetch on intent, never on viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const prefetched: string[] = []
  page.on('request', (r) => {
    if (r.headers()['next-router-prefetch']) prefetched.push(new URL(r.url()).pathname)
  })
  await page.goto('/about', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  expect(prefetched, 'nothing prefetched before load + 2.5 s').toEqual([])
  await page.locator('header').getByRole('link', { name: BOOK }).hover()
  await expect.poll(() => prefetched.some((p) => p.startsWith('/contact'))).toBe(true)
  await page.locator('header nav a[href="/services"]').filter({ visible: true }).first().focus()
  await expect.poll(() => prefetched.some((p) => p.startsWith('/services'))).toBe(true)
})

// ── Term toggletip (WCAG 1.4.13) ─────────────────────────────────────────────
test('term toggletip is hoverable, persistent and dismissible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/services')
  const term = page.locator('button[data-term]').first()
  await term.scrollIntoViewIfNeeded()
  await term.hover()
  const tip = page.locator('[role="tooltip"]:visible')
  await expect(tip).toHaveCount(1)
  const box = (await tip.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await expect(tip).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(0)
  await term.focus()
  await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(1)
})

// ── 11. axe ──────────────────────────────────────────────────────────────────
test('axe: no serious or critical issues on /kit and the five sheets', async ({ page }) => {
  test.setTimeout(240_000)
  const results: Record<string, { serious: number; critical: number; ids: string[] }> = {}
  const paths = [...ROUTES.map((r) => r.path), ...(process.env.SITE_PROD === '1' ? [] : ['/kit'])]
  for (const path of paths)
    for (const w of [390, 1280])
      for (const tier of ['still', 'svg'] as const) {
        await page.setViewportSize({ width: w, height: 900 })
        await gotoTier(page, path, tier)
        const r = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        const key = `${path}@${w}/${tier}`
        results[key] = {
          serious: bad.filter((v) => v.impact === 'serious').length,
          critical: bad.filter((v) => v.impact === 'critical').length,
          ids: bad.map(
            (v) =>
              `${v.id}: ${v.nodes
                .map((n) => n.target.join(' '))
                .slice(0, 3)
                .join(' | ')}`,
          ),
        }
      }
  record('axe', results)
  const failing = Object.entries(results).filter(([, v]) => v.serious + v.critical > 0)
  expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
})

// ── Mono fallback (D7) ───────────────────────────────────────────────────────
test('mono labels stay monospace when Martian Mono misses a cold visit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  // display: optional gives up on a font that is not ready at first paint; never serving it
  // reproduces that cold visit.
  await page.route(/martian-mono-semicondensed.*\.woff2$/, (r) => r.abort())
  await page.goto('/services')
  const chip = page.locator('header > div > a[href="/"] > :last-child')
  await expect(chip).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: 'header > div > a[href="/"] > :last-child',
  })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  const used = fonts.map((f) => f.familyName)
  record('mono-fallback', { used })
  expect(used.join(', ')).not.toMatch(/arial|helvetica/i)
})

// ── 12. Layout shift ─────────────────────────────────────────────────────────
test('CLS on / at 390 (still tier, fonts arriving late) stays at or under 0.05', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number }
    w.__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & {
        value: number
        hadRecentInput: boolean
      })[])
        if (!e.hadRecentInput) w.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  // A slow phone: fonts land a second after the HTML.
  await page.route(/\.woff2$/, async (r) => {
    await new Promise((res) => setTimeout(res, 1000))
    await r.continue()
  })
  await page.goto('/?tier=still', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
  record('cls', { path: '/?tier=still', width: 390, fontDelayMs: 1000, cls })
  expect(cls).toBeLessThanOrEqual(0.05)
})
