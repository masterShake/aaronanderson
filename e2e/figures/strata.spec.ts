import { test, expect } from '../fixtures'
import { STRATA_REV } from '../../src/drawings/views/strata'

/**
 * The strata (About, DETAIL 1 / G-02): static, and drawn inline on the server
 * (both families), so the finished section is in the first paint at every tier
 * with nothing to fetch: no layer bundle and no still image (W4b A1: a lazy
 * still was /about's LCP element on phones). No draw-on, no controls, labels
 * inside the box. The served files stay valid for any other reader.
 */

const STRATA_FILES = /\/drawings\/strata\./

test('strata files are served and text-free', async ({ request }) => {
  for (const fam of ['wide', 'tall']) {
    const json = await request.get(`/drawings/strata.${fam}.json`)
    expect(json.status()).toBe(200)
    for (const m of Object.values((await json.json()).layers as Record<string, string>))
      expect(m).not.toContain('<text')
    const still = await request.get(`/drawings/strata.${fam}.${STRATA_REV}.still.svg`)
    expect(still.headers()['content-type']).toContain('image/svg+xml')
  }
})

test('the drawing is in the server HTML, both families, text-free', async ({ request }) => {
  const html = await (await request.get('/about')).text()
  const at = html.indexOf('id="fig-strata"')
  expect(at).toBeGreaterThan(-1)
  const fig = html.slice(at, html.indexOf('</figure>', at))
  for (const fam of ['wide', 'tall'])
    expect(fig, fam).toMatch(new RegExp(`<svg[^>]*data-family="${fam}"[^>]*>\\s*<g data-layer`))
  for (const part of ['outline', 'dim', 'cut', 'code', 'office', 'field'])
    expect(fig, part).toContain(`data-part="${part}"`)
  const drawing = fig.slice(fig.indexOf('class="drawing'), fig.indexOf('class="labels'))
  expect(drawing).not.toContain('<text')
  expect(drawing).not.toContain('<img')
})

for (const width of [390, 1280]) {
  test(`static: no draw-on, no controls, labels inside the box @${width}`, async ({ page }) => {
    const fetched: string[] = []
    page.on('request', (q) => {
      if (STRATA_FILES.test(q.url())) fetched.push(q.url())
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/about?tier=svg')
    const fig = page.locator('#fig-strata')
    await fig.scrollIntoViewIfNeeded()
    // one family shows, and it is drawn
    const shown = fig.locator('.drawing svg').filter({ visible: true })
    await expect(shown).toHaveCount(1)
    await expect(shown).toHaveAttribute('data-family', width < 600 ? 'tall' : 'wide')
    expect(await shown.locator('path').count()).toBeGreaterThan(0)
    expect(await fig.locator('.drawing .draw').count()).toBe(0)
    // a finished section: outline with break lines, a dimension chain, the A–A cut
    for (const part of ['outline', 'dim', 'cut', 'code', 'office', 'field'])
      expect(await shown.locator(`path[data-part="${part}"]`).count(), part).toBeGreaterThan(0)
    await expect(fig.locator('.controls button')).toHaveCount(0)
    const bad = await fig.evaluate((el) => {
      const box = el.querySelector('.box')!.getBoundingClientRect()
      return [...el.querySelectorAll<HTMLElement>('.labels > *')]
        .filter((l) => {
          const r = l.getBoundingClientRect()
          return r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1
        })
        .map((l) => l.textContent)
    })
    expect(bad).toEqual([])
    await page.waitForTimeout(300)
    expect(fetched).toEqual([])
  })
}

test('still tier: the drawing shows as it is, and nothing is fetched', async ({ page }) => {
  const fetched: string[] = []
  page.on('request', (q) => {
    if (STRATA_FILES.test(q.url())) fetched.push(q.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/about?tier=still')
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'still')
  const fig = page.locator('#fig-strata')
  await fig.scrollIntoViewIfNeeded()
  const shown = fig.locator('.drawing svg').filter({ visible: true })
  await expect(shown).toHaveCount(1)
  expect(await shown.locator('path[data-part="outline"]').count()).toBeGreaterThan(0)
  await expect(fig.locator('img')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(fetched).toEqual([])
})

test('print: the drawing prints', async ({ page }) => {
  await page.goto('/about?tier=svg')
  await page.emulateMedia({ media: 'print' })
  const fig = page.locator('#fig-strata')
  await expect(fig.locator('.drawing svg').filter({ visible: true })).toHaveCount(1)
})
