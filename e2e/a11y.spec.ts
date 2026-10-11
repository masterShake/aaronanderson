import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { ROUTES, TIERS, WIDTHS, pick, type Tier } from './routes'
import { gotoTier } from './helpers/tier'
import { axe, describe, failing, STRICT, type Finding } from './helpers/axe'
import { writeArtifact } from './helpers/budgets'

/**
 * The a11y matrix: routes × tiers (still and svg; webgl only in the gpu project)
 * × widths 390 and 1280 × UI states (menu open, callout open, form errors, FAQ
 * open, toggles flipped). A state that a page does not have yet is recorded as
 * not applicable. Narrow it with ROUTES, TIERS and WIDTHS (comma lists).
 * Reports go to $ARTIFACTS_DIR/a11y/.
 */

const paths: string[] = pick(
  ROUTES.map((x) => x.path as string),
  process.env.ROUTES,
  (s) => s,
)
const routes = ROUTES.filter((r) => paths.includes(r.path))
const widths = pick(WIDTHS, process.env.WIDTHS ?? '390,1280', Number)
/** still and svg by default; TIERS=webgl adds the webgl tier, which runs only in the gpu project. */
const tiers = pick(TIERS, process.env.TIERS ?? 'still,svg', (s) => s as Tier)

type State = {
  name: string
  /** Puts the page into the state; false when the page has nothing to put in it. */
  apply(page: Page, width: number): Promise<boolean>
}

const firstVisible = async (page: Page, selector: string) => {
  const all = page.locator(selector)
  const n = await all.count()
  for (let i = 0; i < n; i++) if (await all.nth(i).isVisible()) return all.nth(i)
  return null
}

const STATES: State[] = [
  {
    name: 'menu-open',
    async apply(page) {
      const btn = await firstVisible(page, 'header button[popovertarget]')
      if (!btn) return false
      await btn.click()
      await page.locator('[popover]:popover-open').first().waitFor({ timeout: 2000 })
      return true
    },
  },
  {
    name: 'callout-open',
    async apply(page) {
      const btn = await firstVisible(page, 'main button[aria-expanded="false"]')
      if (!btn) return false
      await btn.click()
      await page.waitForTimeout(250)
      return true
    },
  },
  {
    name: 'form-errors',
    async apply(page) {
      const submit = await firstVisible(
        page,
        'main form button[type="submit"], main form input[type="submit"]',
      )
      if (!submit) return false
      await submit.click()
      await page.waitForTimeout(500)
      return true
    },
  },
  {
    name: 'faq-open',
    async apply(page) {
      const n = await page.locator('main details:not([open])').count()
      if (!n) return false
      await page
        .locator('main details:not([open])')
        .evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)))
      await page.waitForTimeout(150)
      return true
    },
  },
  {
    name: 'toggles-flipped',
    async apply(page) {
      const groups = page.locator('main [role="group"]:has(> [aria-pressed])')
      const n = await groups.count()
      let flipped = 0
      for (let i = 0; i < n; i++) {
        const off = groups.nth(i).locator('> [aria-pressed="false"]').first()
        if ((await off.count()) && (await off.isVisible())) {
          await off.click()
          flipped++
        }
      }
      if (!flipped) return false
      await page.waitForTimeout(300)
      return true
    },
  },
]

for (const r of routes) {
  for (const width of widths) {
    test.describe(`${r.path} @${width}`, () => {
      test.use({ viewport: { width, height: width < 768 ? 844 : 800 } })
      for (const tier of tiers) {
        test(`axe ${r.path} ${tier} @${width}`, async ({ page }, info) => {
          test.skip(
            tier === 'webgl' && info.project.name !== 'gpu',
            'the webgl tier is judged only in the gpu project (real GPU)',
          )
          const settle = tier === 'still' ? 300 : tier === 'svg' ? 1500 : 4000
          // 1 + STATES loads, each settling, plus axe: webgl alone is about 31 s
          test.setTimeout(tier === 'webgl' ? 120_000 : 60_000)
          const report: Record<string, Finding[] | 'not applicable'> = {}
          const load = async () => {
            await gotoTier(page, r.path, tier)
            await page.evaluate(() => document.fonts.ready.then(() => undefined))
            await page.waitForTimeout(settle)
          }
          await load()
          report.default = await axe(page)
          for (const s of STATES) {
            await load()
            report[s.name] = (await s.apply(page, width)) ? await axe(page) : 'not applicable'
          }
          const slug = `${r.path === '/' ? 'home' : r.path.slice(1)}-${tier}-${width}`
          writeArtifact('a11y', `${slug}.json`, {
            route: r.path,
            tier,
            width,
            strict: STRICT,
            report,
          })
          const bad = Object.entries(report).flatMap(([state, f]) =>
            f === 'not applicable' ? [] : describe(failing(f)).map((l) => `[${state}] ${l}`),
          )
          expect(bad, `axe findings that fail ${STRICT ? 'strict mode' : 'W1'}`).toEqual([])
        })
      }
    })
  }
}
