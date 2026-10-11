import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { S05_CREW } from '../../src/drawings/views/s05'

/**
 * S-05 THE CREW, TRAINED (paper only): its files are served, its layers load,
 * the crew and the new hire stay pencil, orange appears only on the handed
 * tools (an orange-pixel check on the figure crop), the still tier shows the
 * final still, and a phone plays it on entry to the end.
 */

const PENCIL = 'rgb(107, 112, 118)'
const pOf = (fig: import('@playwright/test').Locator) =>
  fig.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--p')))

test('drawing files are served', async ({ request }) => {
  for (const f of ['wide', 'tall']) {
    const json = await request.get(`/drawings/s05.${f}.json`)
    expect(json.status()).toBe(200)
    expect((await json.json()).v).toBe(1)
    const still = await request.get(`/drawings/s05.${f}.trained.still.svg`)
    expect(still.headers()['content-type']).toContain('image/svg+xml')
    const svg = await still.text()
    // paper only: no blueprint-deep panel anywhere
    expect(svg.toLowerCase()).not.toContain('#143a6b')
  }
})

test('the crew and the new hire stay pencil', async ({ page, guard }) => {
  await gotoTier(page, '/kit/fig/s05?p=1', 'svg')
  const fig = page.locator('#fig-s05')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  for (const part of [...S05_CREW.map((c) => c.person), 'hire']) {
    const strokes = await fig
      .locator(`svg.l-pencil g[data-part="${part}"] path[class*="i-"]`)
      .evaluateAll((ps) => [...new Set(ps.map((p) => getComputedStyle(p).stroke))])
    expect(strokes, part).toEqual([PENCIL])
    const fills = await fig
      .locator(`svg.l-pencil g[data-part="${part}"] path`)
      .evaluateAll((ps) => [...new Set(ps.map((p) => getComputedStyle(p).fill))])
    for (const f of fills) expect(['none', 'rgb(244, 242, 236)'], part).toContain(f)
  }
  expect(guard.errors).toEqual([])
})

test('orange appears only on the handed tools', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'pixel check at device scale 1')
  await gotoTier(page, '/kit/fig/s05?p=1', 'svg')
  const fig = page.locator('#fig-s05')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await page.waitForTimeout(300)
  const box = (await fig.boundingBox())!
  const tools = await fig.locator('svg.l-cad g[data-part^="tool."]').evaluateAll((gs) =>
    gs.map((g) => {
      const r = g.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
  expect(tools).toHaveLength(S05_CREW.length)
  const png = await fig.screenshot()
  const res = await page.evaluate(
    async ({ b64, tools, box }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const k = c.width / box.width
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      const inTool = (x: number, y: number) =>
        tools.some(
          (t) =>
            x >= (t.x - box.x - 3) * k &&
            x <= (t.x - box.x + t.w + 3) * k &&
            y >= (t.y - box.y - 3) * k &&
            y <= (t.y - box.y + t.h + 3) * k,
        )
      let inside = 0
      let outside = 0
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4
          const orange =
            Math.abs(d[i]! - 0xff) <= 24 &&
            Math.abs(d[i + 1]! - 0x6b) <= 24 &&
            Math.abs(d[i + 2]! - 0x1a) <= 24
          if (!orange) continue
          if (inTool(x, y)) inside++
          else outside++
        }
      return { inside, outside, share: (inside + outside) / (c.width * c.height) }
    },
    { b64: png.toString('base64'), tools, box },
  )
  await info.attach('s05-orange', { body: JSON.stringify(res), contentType: 'application/json' })
  expect(res.inside).toBeGreaterThan(0)
  expect(res.outside).toBe(0)
  expect(res.share).toBeLessThan(0.05)
})

test('still tier shows the final still', async ({ page }) => {
  await gotoTier(page, '/kit/fig/s05', 'still')
  const fig = page.locator('#fig-s05')
  await expect(fig).toHaveAttribute('data-phase', 'still')
  const img = fig.locator('img.still-img').filter({ visible: true }).first()
  await expect(img).toBeVisible()
  await expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true)
  expect(await pOf(fig)).toBe(1)
})

test('a phone plays it on entry, to the end', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'play mode on the phone')
  await gotoTier(page, '/services', 'svg')
  const fig = page.locator('#fig-s05')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-phase', 'done', { timeout: 10_000 })
  expect(await pOf(fig)).toBe(1)
})
