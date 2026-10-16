import { test, expect } from '../fixtures'

/**
 * The sign-off detail on the /kit/fig harness: layers load, it plays once on
 * entry and ends on its final frame (APPROVED and five logbook lines), Replay
 * restarts it for this figure only, and reduced motion rests on the final
 * frame with Play the drawing.
 */

const URL = '/kit/fig/valve?tier=svg'

test('plays once on entry and ends approved, with six log lines', async ({ page, guard }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect(fig).toHaveAttribute('data-inview', '')
  expect(await fig.locator('svg text').count()).toBe(0)
  await expect(fig.locator('[data-part="pk.4"]')).toHaveCount(1)
  // the opening line, then one line per record
  await expect(fig.locator('[data-line]')).toHaveCount(6)
  // let the sequence finish (VALVE.total, about 7.8 s) and check the final frame
  await page.waitForTimeout(8400)
  for (const line of await fig.locator('[data-line]').all())
    await expect.poll(() => line.evaluate((e) => getComputedStyle(e).opacity)).toBe('1')
  await expect(fig.locator('[data-label="approved"]')).toBeVisible()
  expect(guard.errors).toEqual([])
})

test('Replay restarts the sequence for this figure only', async ({ page }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await fig.getByRole('button', { name: 'Replay' }).click()
  await expect(fig).toHaveAttribute('data-user-play', '')
  // early in the replay the last log line has not printed yet
  const last = fig.locator('[data-line="5"]')
  expect(Number(await last.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1)
  const stored = await page.evaluate(() => localStorage.getItem('ae:motion'))
  expect(stored).toBeNull()
})

/**
 * W4b: no blank frame. Before the gate opens the panel already shows the structure (faint), and
 * the logbook carries its header and opening line from the moment its card is there; the
 * record lines wait for their records.
 */
test('before and early in the play: structure and the logbook header show', async ({ page }) => {
  await page.goto(URL)
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await fig.getByRole('button', { name: 'Replay' }).click()
  // freeze the restarted sequence at its first frame
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = 0
    }
  })
  const opacity = (sel: string) =>
    fig
      .locator(sel)
      .first()
      .evaluate((e) => Number(getComputedStyle(e).opacity))
  for (const part of ['tray.box', 'cabinet', 'logbook.card', 'valve.body'])
    expect(await opacity(`svg.l-cad path[data-part="${part}"]`)).toBeGreaterThan(0.3)
  expect(await opacity('[data-label="logbook"]')).toBeGreaterThan(0.3)
  expect(await opacity('[data-line="0"]')).toBe(1)
  expect(await opacity('[data-line="1"]')).toBe(0)
})

test('Pause motion (still tier) shows every label and log line', async ({ page }) => {
  await page.goto('/kit/fig/valve?tier=still')
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-phase', 'still')
  for (const k of ['incoming', 'approved', 'logbook'])
    await expect
      .poll(() => fig.locator(`[data-label="${k}"]`).evaluate((e) => getComputedStyle(e).opacity))
      .toBe('1')
  for (const line of await fig.locator('[data-line]').all())
    await expect.poll(() => line.evaluate((e) => getComputedStyle(e).opacity)).toBe('1')
})

/**
 * craft-14: on the final frame every label sits apart from the others and inside the drawing;
 * IN RANGE and APPROVED stay on one line; the LOGBOOK card fits inside the panel. The still
 * tier (reduced motion) rests on that frame, so no waiting.
 */
for (const [path, width] of [
  ['/how-it-works', 1280],
  ['/how-it-works', 1440],
  ['/kit/fig/valve', 768],
] as const) {
  test(`final frame @${width} ${path}: labels apart, inside, logbook fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${path}?tier=still`)
    const fig = page.locator('#fig-valve')
    await fig.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await expect(fig).toHaveAttribute('data-phase', 'still')
    const { labels, box } = await fig.evaluate((f) => {
      const b = f.querySelector('.box')!.getBoundingClientRect()
      const labels = [...f.querySelectorAll<HTMLElement>('[data-label]')]
        .filter((el) => el.checkVisibility({ visibilityProperty: true }))
        .map((el) => {
          const r = el.getBoundingClientRect()
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 16
          const pad = parseFloat(getComputedStyle(el).paddingTop) * 2
          return {
            k: el.dataset.label!,
            at: [r.left - b.left, r.top - b.top, r.right - b.left, r.bottom - b.top],
            rows: Math.round((r.height - pad) / lh),
          }
        })
      return { labels, box: [b.width, b.height] }
    })
    const bad: string[] = []
    for (const [i, a] of labels.entries()) {
      if (
        a.at[0]! < -0.5 ||
        a.at[1]! < -0.5 ||
        a.at[2]! > box[0]! + 0.5 ||
        a.at[3]! > box[1]! + 0.5
      )
        bad.push(`${a.k}: outside the drawing`)
      if ((a.k === 'inRange' || a.k === 'approved') && a.rows > 1) bad.push(`${a.k}: wraps`)
      for (const b of labels.slice(i + 1)) {
        const x = Math.min(a.at[2]!, b.at[2]!) - Math.max(a.at[0]!, b.at[0]!)
        const y = Math.min(a.at[3]!, b.at[3]!) - Math.max(a.at[1]!, b.at[1]!)
        // labels in one row read as one unless 12 px apart
        if (x > -12 && y > 0.5) bad.push(`${a.k} × ${b.k}`)
      }
    }
    // at desktop sizes the short log lines print on one row each (the held line may wrap)
    if (width >= 1280) {
      const rows = await fig.locator('[data-line]').evaluateAll((els) =>
        els.map((el) => {
          const r = document.createRange()
          r.selectNodeContents(el)
          const ys = new Set([...r.getClientRects()].map((q) => Math.round(q.top)))
          return [el.getAttribute('data-line'), ys.size] as const
        }),
      )
      expect(rows.filter(([n, c]) => n !== '4' && c > 1)).toEqual([])
    }
    expect(bad).toEqual([])
  })
}

test('reduced motion rests on the final frame and offers Play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/kit/fig/valve')
  const fig = page.locator('#fig-valve')
  await expect(fig).toHaveAttribute('data-phase', 'still')
  await expect(fig.locator('img.still-img:visible')).toHaveCount(1)
  await expect(fig.locator('[data-label="approved"]')).toBeVisible()
  // one button at a time: Play on the still, Replay once it has played
  await expect(fig.getByRole('button', { name: 'Replay' })).toBeHidden()
  const play = fig.getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeVisible()
  await play.click()
  await expect(fig).toHaveAttribute('data-layers', 'ready')
  await expect(fig).toHaveAttribute('data-user-play', '')
  await expect(fig.getByRole('button', { name: 'Replay' })).toBeVisible()
  await expect(play).toBeHidden()
})
