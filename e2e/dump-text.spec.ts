import { test, expect } from './fixtures'
import { ROUTES, pick } from './routes'
import { gotoTier } from './helpers/tier'
import { isProductionBuild, isReviewBuild, writeArtifact } from './helpers/budgets'

/**
 * The visible text of every route, for the copy review: the heading outline
 * and the rendered text (still tier, desktop), written per route and build mode
 * to $ARTIFACTS_DIR/text/<route>.<mode>.txt plus text.<mode>.json. Fails on
 * leaked template or stub markers.
 */

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'the text dump runs in the desktop project')
})

const paths: string[] = pick(
  ROUTES.map((x) => x.path as string),
  process.env.ROUTES,
  (s) => s,
)
const LEAKS = [
  /⟦/,
  /\[object Object\]/,
  /\bundefined\b/,
  /\bNaN\b/,
  /\{[a-zA-Z]+\}/,
  /\[\[[^\]]+\]\]/,
]

test('dump the text of every route', async ({ page }) => {
  const mode = (await isProductionBuild(page))
    ? 'production'
    : (await isReviewBuild(page))
      ? 'review'
      : 'preview'
  const all: Record<string, { title: string; headings: string[]; words: number; text: string }> = {}
  for (const path of paths) {
    await gotoTier(page, path, 'still')
    const d = await page.evaluate(() => ({
      title: document.title,
      headings: [...document.querySelectorAll('h1, h2, h3, h4')].map(
        (h) =>
          `${'  '.repeat(Number(h.tagName[1]) - 1)}${h.tagName} ${(h as HTMLElement).innerText.trim()}`,
      ),
      text: document.body.innerText,
    }))
    const words = d.text.split(/\s+/).filter(Boolean).length
    all[path] = { ...d, words }
    const slug = path === '/' ? 'home' : path.slice(1)
    writeArtifact(
      'text',
      `${slug}.${mode}.txt`,
      `${d.title}\n\n# Outline\n${d.headings.join('\n')}\n\n# Text (${words} words)\n${d.text}\n`,
    )
  }
  writeArtifact('text', `text.${mode}.json`, all)
  const leaks = Object.entries(all).flatMap(([p, v]) =>
    LEAKS.filter((re) => re.test(v.text)).map((re) => `${p}: ${re} → ${v.text.match(re)?.[0]}`),
  )
  expect(leaks).toEqual([])
  for (const v of Object.values(all))
    expect(v.headings.filter((h) => /H1 /.test(h))).toHaveLength(1)
})
