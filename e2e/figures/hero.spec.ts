import { gzipSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures'
import { gotoTier } from '../helpers/tier'
import { freezeAt } from '../helpers/freeze'

/**
 * The hero (D2 A, lane w2/hero): the words, the one H1, the inline drawing's weight, the
 * storyboard states (frozen at storyboard ms), the reduced-motion still, Pause, the mobile
 * entry gate, label sizes and Run again. Desktop and mobile projects; never the GPU.
 */

const FIG = '#fig-hero'

const visible = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return false
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return cs.visibility === 'visible' && cs.display !== 'none' && r.width > 0 && r.height > 0
  }, sel)

test('home has exactly one H1, in the hero, with the sign-off line right under it', async ({
  page,
  guard,
}) => {
  await gotoTier(page, '/', 'svg')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('#hero h1')).toHaveCount(1)
  const next = await page.evaluate(() => document.querySelector('#hero h1')?.nextElementSibling)
  expect(next).not.toBeNull()
  expect(await page.locator('#hero h1 + p').innerText()).toContain('sign off')
  expect(guard.errors).toEqual([])
})

test('the LCP element is the H1 or the deck, never the figure', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: string[] }
    w.__lcp = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { element?: Element })[]) {
        const el = e.element
        w.__lcp.push(
          el ? `${el.tagName.toLowerCase()}${el.closest('figure') ? ' in-figure' : ''}` : 'none',
        )
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await gotoTier(page, '/', 'svg')
  await page.waitForTimeout(1500)
  // LCP stops at the first input; read the last candidate
  const lcp = await page.evaluate(() => (window as unknown as { __lcp: string[] }).__lcp)
  const last = lcp[lcp.length - 1] ?? ''
  expect(last, JSON.stringify(lcp)).not.toContain('in-figure')
  expect(['h1', 'p', 'div']).toContain(last.split(' ')[0])
})

test('the inline drawing (both families) stays under 15 KB gzip', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const html = await page.evaluate((s) => {
    const f = document.querySelector(s)!
    return f.querySelector('.drawing')!.outerHTML + f.querySelector('.still-wrap')!.outerHTML
  }, FIG)
  const kb = gzipSync(html, { level: 9 }).length / 1024
  test.info().annotations.push({ type: 'heroInlineGzKB', description: kb.toFixed(2) })
  expect(kb).toBeLessThanOrEqual(15)
})

test('storyboard: sketch, scan, REV 1 at the decision, the mechanism, then the idle print', async ({
  page,
  isMobile,
}) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const chip = async () =>
    page.evaluate(
      (s) =>
        [...document.querySelectorAll<HTMLElement>(`${s} [data-chip]`)]
          .filter((c) => getComputedStyle(c).visibility === 'visible')
          .map((c) => c.dataset.chip),
      FIG,
    )
  await freezeAt(page, 0)
  expect(await chip()).toEqual(['asFound'])
  await freezeAt(page, 3000)
  expect(await chip()).toEqual(['rewired'])
  await freezeAt(page, 9000)
  expect(await chip()).toEqual(['running'])
  expect(
    await visible(page, `${FIG} .drawing svg.l-pkt[data-family="${isMobile ? 'tall' : 'wide'}"]`),
  ).toBe(true)
  await freezeAt(page, 25000)
  expect(await chip()).toEqual(['done'])
  await expect(fig.locator('[data-action="again"]')).toBeVisible()
  const iso = fig.locator(`.drawing svg.l-iso[data-family="${isMobile ? 'tall' : 'wide'}"]`)
  await expect(iso).toHaveCSS('opacity', '1')
})

test('people, lines and tools come from the graph: 3 people, at most 3 hand notes', async ({
  page,
  isMobile,
}) => {
  await gotoTier(page, '/', 'svg')
  const fam = isMobile ? 'tall' : 'wide'
  const svg = page.locator(`${FIG} .drawing svg.l-pencil[data-family="${fam}"]`)
  await expect(svg.locator('g.k-person')).toHaveCount(3)
  await expect(svg.locator('g.k-box')).toHaveCount(isMobile ? 6 : 7)
  await expect(svg.locator('g.k-line')).toHaveCount(isMobile ? 8 : 9)
  // finish standard A4: the AS FOUND sketch carries at most 3 notes
  expect(await page.locator(`${FIG} .note`).count()).toBeLessThanOrEqual(3)
  expect(await page.locator(`${FIG} svg text`).count()).toBe(0)
})

test('the ERASE ghost lives only in the scan beat: gone by REV 2', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const ghost = () =>
    page.evaluate(
      (s) =>
        [...document.querySelectorAll(`${s} .drawing svg.l-pencil`)]
          .filter((v) => v.checkVisibility())
          .map((v) => Number(getComputedStyle(v).opacity)),
      FIG,
    )
  await freezeAt(page, 2400)
  expect(Math.max(...(await ghost()))).toBeGreaterThan(0)
  await freezeAt(page, 3700)
  expect(Math.max(...(await ghost()))).toBe(0)
})

test('every tool box is at least 104 × 36 CSS px at 520 px (wide) and 360 px (tall)', async ({
  page,
}) => {
  await gotoTier(page, '/kit/fig/hero', 'svg')
  for (const [w, fam] of [
    [520, 'wide'],
    [360, 'tall'],
  ] as const) {
    await page.evaluate((w) => {
      const f = document.getElementById('fig-hero')!
      // the container (the figure's content box) is w px wide
      f.style.boxSizing = 'content-box'
      f.style.inlineSize = `${w}px`
    }, w)
    await page.waitForTimeout(150)
    const sizes = await page.evaluate((fam) => {
      const s = document.querySelector(`#fig-hero .drawing svg.l-pencil[data-family="${fam}"]`)!
      return [...s.querySelectorAll('.k-box path.f-paper')].map((p) => {
        const r = p.getBoundingClientRect()
        return [r.width, r.height]
      })
    }, fam)
    expect(sizes.length).toBeGreaterThan(0)
    for (const [bw, bh] of sizes) {
      expect(bw).toBeGreaterThanOrEqual(104)
      expect(bh).toBeGreaterThanOrEqual(36)
    }
  }
})

test('reduced motion: the iso print, AS FOUND inset and Play the drawing; nothing runs, no canvas', async ({
  page,
}) => {
  const chunks: string[] = []
  page.on('request', (r) => {
    if (/three|runtime|scenes/.test(r.url())) chunks.push(r.url())
  })
  await gotoTier(page, '/', 'still')
  const fig = page.locator(FIG)
  await expect(fig).toHaveAttribute('data-phase', 'still')
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const running = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === 'running').length,
    FIG,
  )
  expect(running).toBe(0)
  await expect(page.locator(`${FIG} canvas.stage-canvas`)).toHaveCount(0)
  await expect(fig.locator('.still-wrap')).toBeVisible()
  await expect(fig.locator('.still-wrap svg').first()).toBeAttached()
  await expect(fig.locator('[data-action="play"]')).toBeVisible()
  await expect(fig.locator('[data-action="again"]')).toBeHidden()
  const iso = await page.evaluate((s) => {
    const svgs = [...document.querySelectorAll<SVGElement>(`${s} .drawing svg.l-iso`)]
    return svgs.some(
      (v) => getComputedStyle(v).display !== 'none' && getComputedStyle(v).opacity === '1',
    )
  }, FIG)
  expect(iso).toBe(true)
  // Play the drawing runs the figure (figure-scoped; nothing is stored)
  await fig.locator('[data-action="play"]').click()
  await expect(fig).toHaveAttribute('data-user-play', '')
  const stored = await page.evaluate(() => localStorage.getItem('ae:motion'))
  expect(stored).toBeNull()
  expect(chunks).toEqual([])
})

/**
 * The visible text of each hero label (its own text, plus children not hidden or faded), box
 * relative, with its line count; and the AS FOUND inset when it shows.
 */
async function labelBoxes(page: Page, sel: string) {
  return page.evaluate((s) => {
    const fig = document.querySelector<HTMLElement>(s)!
    const box = fig.querySelector('.box')!.getBoundingClientRect()
    const shown = (el: Element) => {
      for (let n: Element | null = el; n && n !== fig; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.display === 'none' || cs.visibility !== 'visible') return false
        if (cs.opacity === '0' || /opacity\(0\)/.test(cs.filter)) return false
      }
      return true
    }
    const rel = (r: { left: number; top: number; right: number; bottom: number }) =>
      [r.left - box.left, r.top - box.top, r.right - box.left, r.bottom - box.top].map(
        (v) => Math.round(v * 10) / 10,
      )
    const out: { what: string; at: number[]; lines: number }[] = []
    for (const el of fig.querySelectorAll<HTMLElement>('.labels > [data-anchor]')) {
      if (!shown(el)) continue
      const rects: DOMRect[] = []
      let lines = 0
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
          const r = document.createRange()
          r.selectNodeContents(n)
          rects.push(r.getBoundingClientRect())
          lines += r.getClientRects().length
        } else if (n instanceof HTMLElement && shown(n) && n.offsetWidth) {
          rects.push(n.getBoundingClientRect())
          lines += 1
        }
      }
      if (!rects.length) continue
      out.push({
        what: el.dataset.anchor!,
        lines,
        at: rel({
          left: Math.min(...rects.map((r) => r.left)),
          top: Math.min(...rects.map((r) => r.top)),
          right: Math.max(...rects.map((r) => r.right)),
          bottom: Math.max(...rects.map((r) => r.bottom)),
        }),
      })
    }
    const inset = fig.querySelector('.box [class*="inset"]')
    const ir = inset && shown(inset) ? rel(inset.getBoundingClientRect()) : null
    return { labels: out, inset: ir, box: [box.width, box.height] }
  }, sel)
}

const hits = (a: number[], b: number[]) =>
  Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!) > 0.5 &&
  Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!) > 0.5

/** craft-8: in the tall viewBox every iso label is one line, inside the frame, clear of the
 * others and of the AS FOUND inset. */
for (const [tier, width] of [
  ['still', 360],
  ['still', 390],
  ['svg', 390],
] as const) {
  test(`tall iso print @${width} (${tier}): labels one line, inside, apart, clear of the inset`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await gotoTier(page, '/', tier)
    const fig = page.locator(FIG)
    await fig.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    if (tier === 'svg') {
      await page.waitForTimeout(300)
      await freezeAt(page, 25000)
    } else await expect(fig).toHaveAttribute('data-phase', 'still')
    const { labels, inset, box } = await labelBoxes(page, FIG)
    expect(labels.length).toBeGreaterThanOrEqual(8)
    const bad: string[] = []
    for (const [i, a] of labels.entries()) {
      if (a.lines > 1) bad.push(`${a.what}: ${a.lines} lines`)
      if (
        a.at[0]! < -0.5 ||
        a.at[1]! < -0.5 ||
        a.at[2]! > box[0]! + 0.5 ||
        a.at[3]! > box[1]! + 0.5
      )
        bad.push(`${a.what}: outside`)
      if (inset && hits(a.at, inset)) bad.push(`${a.what}: on the inset`)
      for (const b of labels.slice(i + 1)) if (hits(a.at, b.at)) bad.push(`${a.what} × ${b.what}`)
    }
    expect(bad).toEqual([])
  })
}

/** craft-13 (W4 finish): REV 2 at 1280 and 1440 (svg): every tool's name sits inside its box on
 * one line (the file name never breaks), the report's name is dark on its orange box, no two
 * labels touch, and APPROVED clears every tool box and the sign-off label. */
for (const width of [1280, 1440])
  test(`REV 2 mechanism @${width}: names inside their boxes, labels apart, APPROVED clear`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoTier(page, '/', 'svg')
    const fig = page.locator(FIG)
    await fig.scrollIntoViewIfNeeded()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.waitForTimeout(300)
    await freezeAt(page, 4000)
    const r = await page.evaluate((s) => {
      const fig = document.querySelector<HTMLElement>(s)!
      const rect = (el: Element | Range) => {
        const q = el.getBoundingClientRect()
        return [q.left, q.top, q.right, q.bottom]
      }
      const text = (el: Element) => {
        const rg = document.createRange()
        rg.selectNodeContents(el.firstChild ?? el)
        return { at: rect(rg), lines: rg.getClientRects().length }
      }
      const svg = [...fig.querySelectorAll('.drawing svg.l-cad')].find((v) => v.checkVisibility())!
      const boxes = [...svg.querySelectorAll('.k-frame path[class^="f-"]')]
        .filter((p) =>
          /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+Z$/.test(
            p.getAttribute('d') ?? '',
          ),
        )
        .map((p) => ({ orange: p.classList.contains('f-orange'), at: rect(p) }))
      const shown = [...fig.querySelectorAll<HTMLElement>('.labels > span')].filter(
        (el) => getComputedStyle(el).visibility === 'visible' && el.textContent?.trim(),
      )
      const tools = [...fig.querySelectorAll<HTMLElement>('.labels [data-anchor^="tool."]')].map(
        (el) => ({ key: el.dataset.anchor!, ...text(el) }),
      )
      const approved = fig.querySelector('.labels [class*="approved"]')!
      const signoff = fig.querySelector('.labels [data-anchor="sym.valve"]')!
      const name = fig.querySelector('.labels [data-anchor="tool.report"]')!
      return {
        boxes,
        tools,
        labels: shown.map((el) => ({ what: el.textContent!.trim(), at: rect(el) })),
        approved: rect(approved),
        signoff: rect(signoff),
        nameColor: getComputedStyle(name).color,
      }
    }, FIG)
    const hit = (a: number[], b: number[]) =>
      Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!) > 0.5 &&
      Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!) > 0.5
    const inside = (a: number[], b: number[]) =>
      a[0]! >= b[0]! - 0.5 && a[1]! >= b[1]! - 0.5 && a[2]! <= b[2]! + 0.5 && a[3]! <= b[3]! + 0.5
    expect(r.boxes.length).toBeGreaterThanOrEqual(7)
    // the label-on-deep tone is light; on orange the name must be the dark ink
    const [cr, cg, cb] = r.nameColor.match(/\d+/g)!.map(Number)
    expect(0.2126 * cr! + 0.7152 * cg! + 0.0722 * cb!).toBeLessThan(100)
    const bad: string[] = []
    for (const t of r.tools) {
      if (!r.boxes.some((b) => inside(t.at, b.at))) bad.push(`${t.key}: outside its box`)
      if (t.key === 'tool.estimate' && t.lines > 1) bad.push(`${t.key}: breaks`)
      if (t.key === 'tool.report' && !inside(t.at, r.boxes.find((b) => b.orange)!.at))
        bad.push('report name off its box')
    }
    for (const [i, a] of r.labels.entries())
      for (const b of r.labels.slice(i + 1)) if (hit(a.at, b.at)) bad.push(`${a.what} × ${b.what}`)
    expect(bad).toEqual([])
    expect(r.boxes.filter((b) => hit(r.approved, b.at))).toEqual([])
    expect(hit(r.approved, r.signoff)).toBe(false)
  })

test('Pause stops every hero animation', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await fig.locator('input[data-motion-switch]').check()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused')
  const states = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .filter((a) => a instanceof CSSAnimation)
        .map((a) => a.playState),
    FIG,
  )
  expect(states.length).toBeGreaterThan(0)
  expect(states.filter((x) => x === 'running')).toEqual([])
  await fig.locator('input[data-motion-switch]').uncheck()
})

test('phones wait for the figure to be 40% visible before it starts', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the entry gate holds below 1024 px')
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  const gate = () =>
    page.evaluate(
      (s) => getComputedStyle(document.querySelector(s)!).getPropertyValue('--gate'),
      FIG,
    )
  await expect(fig).toHaveAttribute('data-armed', '')
  if ((await fig.getAttribute('data-inview')) === null) expect(await gate()).toBe('paused')
  await fig.scrollIntoViewIfNeeded()
  await expect(fig).toHaveAttribute('data-inview', '')
  expect(await gate()).toBe('running')
})

test('Run again replays the mechanism, not the sketch', async ({ page }) => {
  await gotoTier(page, '/', 'svg')
  const fig = page.locator(FIG)
  await fig.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await freezeAt(page, 25000)
  await fig.locator('[data-action="again"]').click()
  const t = await page.evaluate(
    (s) =>
      document
        .querySelector(s)!
        .getAnimations({ subtree: true })
        .find((a) => a instanceof CSSAnimation)?.currentTime,
    FIG,
  )
  expect(Number(t)).toBeGreaterThan(2900)
  expect(Number(t)).toBeLessThan(4000)
  await expect(fig.locator('[data-action="again"]')).toBeHidden()
})
