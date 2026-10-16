import { test, expect } from '../fixtures'

/**
 * The ticket figure on the /kit/fig harness: its layers load, each revision
 * shows its own CAD group, labels and chip, the drawing has no text and no
 * vector-effect, and the still tier shows the matching still.
 */

const URL = '/kit/fig/ticket?tier=svg'

test('layers load and carry no text or vector-effect', async ({ page, guard }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-ticket')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  expect(await fig.locator('svg.l-pencil path').count()).toBeGreaterThan(0)
  expect(await fig.locator('svg.l-cad g[data-rev]').count()).toBe(4)
  expect(await fig.locator('svg text').count()).toBe(0)
  const markup = await fig.locator('.drawing').innerHTML()
  expect(markup).not.toContain('vector-effect')
  expect(guard.errors).toEqual([])
})

for (const rev of ['rev1', 'rev2', 'rev3', 'rev4']) {
  test(`${rev} shows its own group, chip and labels`, async ({ page }) => {
    await page.goto(`${URL}&state=${rev}`)
    const fig = page.locator('#fig-ticket')
    await expect(fig).toHaveAttribute('data-rev', rev)
    await expect(fig).toHaveAttribute('data-layers', 'ready')
    await expect(fig.locator(`svg.l-cad g[data-rev="${rev}"]`)).toBeVisible()
    await expect(fig.locator(`svg.l-cad g[data-rev]:not([data-rev="${rev}"])`).first()).toBeHidden()
    await expect(fig.locator('[data-rev-chip]')).toContainText(`REV ${rev.slice(3)}`)
    // labels fade between revisions; once settled, only this revision's show
    await expect
      .poll(() =>
        fig
          .locator('.labels [data-revs]')
          .evaluateAll(
            (els, r) =>
              els
                .filter((e) => getComputedStyle(e).visibility !== 'hidden')
                .every((e) => (e as HTMLElement).dataset.revs!.split(' ').includes(r)),
            rev,
          ),
      )
      .toBe(true)
  })
}

/**
 * W4b: the parallel run at REV 2 is the old tools themselves (glyph and name), never bare
 * dashed boxes; only the hand-offs between them are dashed.
 */
test('rev2: the parallel run shows the old tools by name, with their glyphs', async ({ page }) => {
  await page.goto(`${URL}&state=rev2`)
  const fig = page.locator('#fig-ticket')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  const group = fig.locator('svg.l-cad g[data-rev="rev2"] [data-part="parallel"]')
  for (const id of ['pm', 'inbox', 'office', 'po', 'accounting', 'jobCost']) {
    await expect(group.locator(`path[data-part="old.${id}"]`)).toHaveCount(1)
    await expect(group.locator(`path[data-part="old.${id}"].d-hidden`)).toHaveCount(0)
    expect(await group.locator(`path[data-part="old.${id}.glyph"]`).count()).toBeGreaterThan(0)
    await expect(fig.locator(`.labels [data-label="${id}"]`)).toBeVisible()
  }
})

test('the strip keeps one row on phones', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(`${URL}&state=rev2`)
    const strip = page.locator('#fig-ticket .strip')
    await expect(page.locator('#fig-ticket [data-rev-chip]')).toContainText('REV 2')
    expect(await strip.evaluate((e) => e.getBoundingClientRect().height)).toBeLessThan(56)
  }
})

test('the still tier shows the still of the current revision', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/kit/fig/ticket?state=rev2')
  const fig = page.locator('#fig-ticket')
  await expect(fig).toHaveAttribute('data-rev', 'rev2')
  const visible = fig.locator('img.still-img:visible')
  await expect(visible).toHaveCount(1)
  await expect(visible).toHaveAttribute('data-rev', 'rev2')
})

test('drawing files are static and text-free', async ({ request }) => {
  for (const fam of ['wide', 'tall']) {
    const res = await request.get(`/drawings/ticket.${fam}.json`)
    expect(res.status()).toBe(200)
    const b = await res.json()
    for (const markup of Object.values(b.layers as Record<string, string>))
      expect(markup).not.toMatch(/<text|vector-effect/)
    for (let i = 0; i < 5; i++) {
      const still = await request.get(`/drawings/ticket.${fam}.rev${i}.still.svg`)
      expect(still.headers()['content-type']).toContain('image/svg+xml')
    }
  }
})
