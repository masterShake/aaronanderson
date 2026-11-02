/**
 * npm run shots — screenshots of the story at fixed progress stops, using the installed Chrome.
 *
 *   npm run build && npm run shots                 # starts `next start` on :3121
 *   BASE_URL=http://localhost:3120 npm run shots   # use a running dev server
 *   VIEWS=desktop CHAPTERS=construction STOPS=0.4,0.8 npm run shots   # subsets
 *   MOTION=no-preference,reduce OUT=artifacts/x npm run shots
 *   BASELINE=artifacts/baseline-r1 npm run shots   # also require chapter-1 shots to be byte-identical
 *
 * Writes artifacts/shots/<view>/<motion>/<chapter>-<p>.png and exits 1 on console errors, page
 * errors, requests to other origins (e.g. a font fallback fetched from a CDN) or baseline diffs.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright-core'

const PORT = 3121
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`
const OUT = process.env.OUT ?? 'artifacts/shots'

const ALL_VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: 'desktop1x', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  { name: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
]
/** Stops per chapter, in chapter progress. Construction stops sit on its beats (lib/framing/script.ts). */
const ALL_CHAPTERS = [
  {
    name: 'architects',
    stops: [0, 0.06, 0.12, 0.17, 0.22, 0.28, 0.33, 0.4, 0.47, 0.54, 0.61, 0.66, 0.71, 0.76, 0.8, 0.84, 0.88, 0.92, 0.96, 1],
  },
  {
    name: 'construction',
    stops: [
      0, 0.02, 0.035, 0.05, 0.07, 0.09, 0.11, 0.14, 0.17, 0.2, 0.23, 0.27, 0.3, 0.33, 0.365, 0.39, 0.415, 0.45,
      0.485, 0.51, 0.54, 0.56, 0.6, 0.64, 0.69, 0.72, 0.75, 0.78, 0.8, 0.83, 0.86, 0.9, 0.95, 1,
    ],
  },
  { name: 'agents', stops: [0.9] },
]

const pick = <T extends { name: string }>(all: T[], env?: string) =>
  env ? all.filter((v) => env.split(',').includes(v.name)) : all
const views = pick(ALL_VIEWS, process.env.VIEWS)
const chapters = pick(ALL_CHAPTERS, process.env.CHAPTERS)
const envStops = process.env.STOPS?.split(',').map(Number)
const motions = (process.env.MOTION ?? 'no-preference').split(',') as ('no-preference' | 'reduce')[]
const baseline = process.env.BASELINE

const problems: string[] = []

async function waitForServer(url: string, ms = 30_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Server did not start at ${url}`)
}

async function settle(page: Page) {
  await page.waitForSelector('[data-stage-state=settled], [data-stage-state=fallback]', { timeout: 30_000 })
  await page.evaluate(
    () => new Promise<void>((r) => document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))),
  )
}

let server: ChildProcess | undefined
if (!process.env.BASE_URL) {
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore' })
  await waitForServer(BASE)
}

const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED })
try {
  for (const view of views) {
    for (const reducedMotion of motions) {
      const dir = `${OUT}/${view.name}/${reducedMotion === 'reduce' ? 'reduced' : 'motion'}`
      mkdirSync(dir, { recursive: true })
      const context = await browser.newContext({ ...view, reducedMotion })
      const page = await context.newPage()
      const tag = `${view.name}/${reducedMotion}`
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') problems.push(`${tag} console.${m.type()}: ${m.text()}`)
      })
      page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`))
      page.on('request', (r) => {
        const url = r.url()
        if (/^https?:/.test(url) && !url.startsWith(BASE)) problems.push(`${tag} third-party request: ${url}`)
      })

      // `animations: 'disabled'` completes CSS transitions (e.g. the canvas fade-in) before capture.
      await page.goto(BASE, { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      await page.screenshot({ path: `${dir}/hero.png`, animations: 'disabled' })

      for (const chapter of chapters) {
        for (const p of envStops ?? chapter.stops) {
          const name = `${chapter.name}-${Number(p.toFixed(2)) === p ? p.toFixed(2) : p.toFixed(3)}.png`
          await page.goto(`${BASE}/?p=${chapter.name}:${p}`, { waitUntil: 'load' })
          await settle(page)
          await page.screenshot({ path: `${dir}/${name}`, animations: 'disabled' })
          // Chapter 1 must not change while later chapters are built on top of it.
          const before = `${baseline}${dir.slice(OUT.length)}/${name}`
          const same = () => readFileSync(before).equals(readFileSync(`${dir}/${name}`))
          if (baseline && chapter.name === 'architects' && existsSync(before) && !same())
            problems.push(`${tag} ${name} differs from ${before}`)
        }
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
  server?.kill()
}

mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, problems }, null, 2))
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Shots written to ${OUT}`)
