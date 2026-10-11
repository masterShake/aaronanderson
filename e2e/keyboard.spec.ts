import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ROUTES, pick } from './routes'
import { artifactsDir, writeArtifact } from './helpers/budgets'

/**
 * Keyboard and the WCAG checks axe cannot make (desktop project; narrow cases
 * set their own viewport): the skip link, the menu, 2.4.11 focus not obscured
 * by the sticky header, roving tabindex, toggletips (1.4.13), reflow at 320 px
 * (1.4.10) and text spacing (1.4.12). A widget a page does not have yet is
 * skipped with the reason. ROUTES narrows the routes.
 */

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'the keyboard suite runs in the desktop project')
})

const paths: string[] = pick(
  ROUTES.map((x) => x.path as string),
  process.env.ROUTES,
  (s) => s,
)
const routes = ROUTES.filter((r) => paths.includes(r.path))

/** Visits every route and returns the first that has `selector`, or null. */
async function findRoute(page: Page, selector: string) {
  for (const r of routes) {
    await page.goto(r.path)
    if (await page.locator(selector).count()) return r.path
  }
  return null
}

test('skip link is the first stop and moves focus to main', async ({ page }) => {
  for (const r of routes) {
    await page.goto(r.path)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const a = document.activeElement
          const main = document.querySelector('main')
          return Boolean(main && a && (a === main || main.contains(a)))
        }),
      )
      .toBe(true)
  }
})

test.describe('menu', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('opens from the keyboard, closes on Esc and returns focus', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('header button[popovertarget]').filter({ visible: true }).first()
    test.skip(!(await button.count()), 'no menu button at 390 px yet')
    await button.focus()
    await page.keyboard.press('Enter')
    const menu = page.locator('[popover]:popover-open')
    await expect(menu).toHaveCount(1)
    const links = menu.getByRole('link')
    expect(await links.count()).toBeGreaterThanOrEqual(5)
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest('[popover]'))),
      'Tab moves into the open menu',
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(button).toBeFocused()
  })
})

/** 2.4.11: tab through the page; no focused element may sit fully under the sticky header. */
async function walkFocus(page: Page, key: 'Tab' | 'Shift+Tab', max = 150) {
  const hidden: string[] = []
  const seen = new Set<string>()
  if (key === 'Tab')
    await page.evaluate(() => {
      ;(document.activeElement as HTMLElement | null)?.blur()
      scrollTo(0, 0)
    })
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key)
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const header = document.querySelector('header')
      const key = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} ${(el.textContent ?? '').trim().slice(0, 40)}`
      if (!header || header.contains(el) || el.closest('[popover]')) return { key, hidden: false }
      const e = el.getBoundingClientRect()
      if (e.width === 0 || e.height === 0) return { key, hidden: false }
      // Fully hidden = every sample point inside the element's box (clipped to
      // the viewport) hits the header rather than the element.
      const x0 = Math.max(e.left + 1, 0)
      const x1 = Math.min(e.right - 1, innerWidth - 1)
      const y0 = Math.max(e.top + 1, 0)
      const y1 = Math.min(e.bottom - 1, innerHeight - 1)
      // Visually hidden (1 px) or off-screen elements are not the header's doing.
      if (x1 < x0 || y1 < y0) return { key: `${key} (off screen)`, hidden: false }
      const pts = [
        [(x0 + x1) / 2, (y0 + y1) / 2],
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ]
      const covered = pts.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y)
        return Boolean(hit && header.contains(hit) && !el.contains(hit))
      })
      return { key: `${key} @${Math.round(e.top)}`, hidden: covered }
    })
    if (!r) continue
    if (r.hidden) hidden.push(r.key)
    if (seen.has(r.key) && i > 5) break
    seen.add(r.key)
  }
  return { hidden, stops: seen.size }
}

for (const width of [1280, 390]) {
  test.describe(`2.4.11 @${width}`, () => {
    test.use({ viewport: { width, height: width < 768 ? 844 : 800 } })
    test(`focus is never fully hidden by the sticky header @${width}`, async ({ page }) => {
      const out: Record<string, { hidden: string[]; stops: number }> = {}
      for (const r of routes) {
        await page.goto(r.path)
        // Forward, then back up from wherever the forward walk ended: going
        // backwards is when content scrolls in under a sticky header.
        const fwd = await walkFocus(page, 'Tab')
        const back = await walkFocus(page, 'Shift+Tab')
        out[r.path] = { hidden: [...fwd.hidden, ...back.hidden], stops: fwd.stops }
      }
      writeArtifact('keyboard', `focus-walk-${width}.json`, out)
      const bad = Object.entries(out).flatMap(([p, v]) => v.hidden.map((h) => `${p}: ${h}`))
      expect(bad).toEqual([])
    })
  })
}

test('roving tabindex: one stop per widget, arrows move, Home and End jump', async ({ page }) => {
  const SEL =
    '[role="toolbar"], [role="tablist"], [role="radiogroup"], [role="listbox"], [role="grid"], [data-roving]'
  const path = await findRoute(page, `main :is(${SEL}) [tabindex="-1"]`)
  test.skip(!path, 'no roving-tabindex widget on any route yet (W2 adds the schematics)')
  const group = page.locator(`main :is(${SEL}):has([tabindex="-1"])`).first()
  const items = group.locator('[tabindex="0"], [tabindex="-1"]')
  await expect(group.locator('[tabindex="0"]')).toHaveCount(1)
  await group.locator('[tabindex="0"]').focus()
  const label = () => page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
  const first = await label()
  await page.keyboard.press('ArrowRight')
  if ((await label()) === first) await page.keyboard.press('ArrowDown')
  const second = await label()
  expect(second, 'an arrow key moves focus inside the widget').not.toBe(first)
  expect(
    await page.evaluate(() => document.activeElement?.getAttribute('tabindex')),
    'the focused item becomes the tab stop',
  ).toBe('0')
  await page.keyboard.press('End')
  const last = await items.last().evaluate((el) => el.outerHTML.slice(0, 120))
  expect(await label()).toBe(last)
  await page.keyboard.press('Home')
  expect(await label()).toBe(await items.first().evaluate((el) => el.outerHTML.slice(0, 120)))
})

test('toggletips: focus or hover opens, hoverable, Esc dismisses (1.4.13)', async ({ page }) => {
  const path = await findRoute(page, 'main button[data-term]')
  test.skip(!path, 'no glossary toggletip on any route yet')
  const btn = page.locator('main button[data-term]').filter({ visible: true }).first()
  const tipFor = async () => {
    const id = await btn.getAttribute('aria-describedby')
    return id ? page.locator(`[id="${id}"]`) : page.locator('main [role="tooltip"]:visible').first()
  }
  await btn.focus()
  await expect(await tipFor()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('main [role="tooltip"]:visible')).toHaveCount(0)
  await expect(btn).toBeFocused()
  await btn.hover()
  const tip = await tipFor()
  await expect(tip).toBeVisible()
  const box = await tip.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 })
    await expect(tip, 'the tip stays while the pointer is on it').toBeVisible()
  }
})

test.describe('reflow at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } })
  test('no horizontal scroll, with the menu closed and open (1.4.10)', async ({ page }) => {
    const wide: string[] = []
    for (const r of routes) {
      await page.goto(r.path)
      const w = await page.evaluate(() => document.documentElement.scrollWidth)
      if (w > 320) wide.push(`${r.path}: ${w}px`)
      const menu = page.locator('header button[popovertarget]').filter({ visible: true }).first()
      if (await menu.count()) {
        await menu.click()
        const m = await page.evaluate(() => document.documentElement.scrollWidth)
        if (m > 320) wide.push(`${r.path} (menu open): ${m}px`)
        await page.keyboard.press('Escape')
      }
    }
    expect(wide).toEqual([])
  })
})

const SPACING = `*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}`

for (const width of [1280, 390]) {
  test.describe(`text spacing @${width}`, () => {
    test.use({ viewport: { width, height: width < 768 ? 844 : 800 } })
    test(`1.4.12 text spacing clips no text @${width}`, async ({ page }) => {
      const out: Record<string, string[]> = {}
      for (const r of routes) {
        await page.goto(r.path)
        await page.addStyleTag({ content: SPACING })
        await page.waitForTimeout(100)
        out[r.path] = await page.evaluate(() => {
          const clipped: string[] = []
          const vw = document.documentElement.clientWidth
          if (document.documentElement.scrollWidth > vw + 1)
            clipped.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px`)
          /** The element's rendered text: text nodes outside noscript, script, style and svg. */
          const text = (el: HTMLElement) => {
            let s = ''
            const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
              acceptNode: (n) =>
                n.parentElement?.closest('noscript, script, style, svg, template')
                  ? NodeFilter.FILTER_REJECT
                  : NodeFilter.FILTER_ACCEPT,
            })
            while (w.nextNode()) s += w.currentNode.textContent ?? ''
            return s.trim()
          }
          for (const el of document.querySelectorAll<HTMLElement>('header *, main *, footer *')) {
            if (!el.childNodes.length || !text(el)) continue
            if (el.clientWidth <= 1 || el.clientHeight <= 1) continue
            const cs = getComputedStyle(el)
            if (cs.visibility === 'hidden' || cs.display === 'none') continue
            if (el.closest('svg, [aria-hidden="true"], [hidden], [popover]:not(:popover-open)'))
              continue
            const clipX = /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1
            const clipY = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
            if (clipX || clipY)
              clipped.push(
                `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''} "${text(el).slice(0, 40)}"`,
              )
          }
          return clipped
        })
        await page.screenshot({
          path: join(
            artifactsDir('keyboard'),
            `text-spacing-${r.path === '/' ? 'home' : r.path.slice(1)}-${width}.png`,
          ),
          fullPage: true,
        })
      }
      writeArtifact('keyboard', `text-spacing-${width}.json`, out)
      const bad = Object.entries(out).flatMap(([p, v]) => v.map((x) => `${p}: ${x}`))
      expect(bad).toEqual([])
    })
  })
}
