/**
 * Lighthouse 13.5 (mobile, performance only), median of N runs per route,
 * against a running `next start` (PLAN Appendix B §B10). Gate it on a
 * production-mode build (VERCEL_ENV=production) so no HOLD clouds are measured.
 *
 *   npm run perf:lh -- [--base URL] [--routes /,/services] [--runs 5] [--calibrate]
 *                      [--multiplier 7] [--tier svg|still|webgl|none] [--preset desktop] [--gate]
 *                      [--method simulate|devtools]
 *
 * --method     Lighthouse's throttling method (default simulate). Against localhost the
 *              simulated LCP charges every request that finished before the observed paint
 *              (all the framework JS and fonts) to the LCP estimate, so it reads far slower
 *              than a throttled load: in W1, simulated LCP on / was about 3.0 s while devtools
 *              throttling (the same slow-4G network and CPU multiplier, applied for real)
 *              measured 1.6 s. Gate LCP on devtools and report simulate alongside it.
 *              devtools results go to <out>-devtools so the two never overwrite each other.
 * --calibrate  one calibration run on the first route reads Lighthouse's
 *              environment.benchmarkIndex (BI); the CPU multiplier for the real
 *              runs is clamp(round(4 × BI / 1750), 4, 10).
 * --multiplier sets the multiplier directly (default 4, Lighthouse's own).
 * --tier       appended as ?tier=… (default svg, so the 3D chunk stays out; none = no query).
 * --gate       exit 1 when a median is past its budgets.json fail line.
 *
 * Writes <out>/summary.json (per route: medians of LCP, TBT, CLS, FCP, SI and
 * score, plus the runs) with the multiplier and benchmarkIndex; <out> is
 * $ARTIFACTS_DIR/lighthouse/<preset> or .lighthouse/<preset>. Uses CHROME_PATH
 * (default: the installed Google Chrome). Starts `next start` on this lane's
 * PORT when nothing is serving. Env: LH_RUNS, ROUTES, PLAYWRIGHT_BASE_URL.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  arg,
  baseUrl,
  budgets,
  ensureServer,
  flag,
  median,
  outDir,
  routes,
  writeJson,
} from '../budgets/lib.mjs'

const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LH = join(ROOT, 'node_modules/lighthouse/cli/index.js')
const base = baseUrl()
const runs = Math.max(1, Number(arg('--runs', process.env.LH_RUNS ?? 5)))
const preset = arg('--preset', 'mobile')
const tier = arg('--tier', 'svg')
const calibrate = flag('--calibrate')
const gate = flag('--gate')
const method = arg('--method', 'simulate')
if (method !== 'simulate' && method !== 'devtools') {
  console.error(`lighthouse: --method must be simulate or devtools, not ${method}`)
  process.exit(2)
}
const lab = budgets().lab
const sub = method === 'simulate' ? preset : `${preset}-${method}`
const out = outDir(join('lighthouse', sub), join('.lighthouse', sub))

if (!existsSync(CHROME_PATH)) {
  console.error(`lighthouse: no Chrome at ${CHROME_PATH}; set CHROME_PATH`)
  process.exit(2)
}

const calibratedMultiplier = (bi) => Math.min(10, Math.max(4, Math.round((4 * bi) / 1750)))

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_'))
const urlFor = (route) =>
  `${base}${route}${tier === 'none' ? '' : `${route.includes('?') ? '&' : '?'}tier=${tier}`}`

/** One Lighthouse run; returns the metrics read from its JSON report. */
function lighthouse(route, file, multiplier) {
  const args = [
    LH,
    urlFor(route),
    '--quiet',
    '--only-categories=performance',
    '--output=json',
    `--output-path=${file}`,
    '--chrome-flags=--headless=new',
    `--throttling-method=${method}`,
    ...(preset === 'desktop' ? ['--preset=desktop'] : []),
    ...(multiplier !== null ? [`--throttling.cpuSlowdownMultiplier=${multiplier}`] : []),
  ]
  const r = spawnSync(process.execPath, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, CHROME_PATH },
  })
  if (r.status !== 0) throw new Error(`lighthouse exited ${r.status} on ${route}`)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  const a = j.audits
  return {
    lcpMs: a['largest-contentful-paint']?.numericValue ?? null,
    tbtMs: a['total-blocking-time']?.numericValue ?? null,
    cls: a['cumulative-layout-shift']?.numericValue ?? null,
    fcpMs: a['first-contentful-paint']?.numericValue ?? null,
    siMs: a['speed-index']?.numericValue ?? null,
    score: j.categories?.performance?.score ?? null,
    benchmarkIndex: j.environment?.benchmarkIndex ?? null,
    multiplier: j.configSettings?.throttling?.cpuSlowdownMultiplier ?? multiplier,
  }
}

const verdict = (v, target, fail) =>
  v === null ? 'n/a' : v > fail ? 'fail' : target !== null && v > target ? 'amber' : 'pass'

const server = await ensureServer(base)
let summary
try {
  const list = routes()
  let multiplier = arg('--multiplier') ? Number(arg('--multiplier')) : 4
  let calibration = null
  if (calibrate) {
    const dir = join(out, 'calibration')
    mkdirSync(dir, { recursive: true })
    const c = lighthouse(list[0], join(dir, `${slug(list[0])}.json`), 4)
    multiplier = calibratedMultiplier(c.benchmarkIndex)
    calibration = { route: list[0], benchmarkIndex: c.benchmarkIndex, multiplier }
    console.log(
      `calibration: benchmarkIndex ${c.benchmarkIndex} → multiplier clamp(round(4×BI/1750), 4, 10) = ${multiplier}`,
    )
  }
  const results = {}
  const allBi = []
  for (const route of list) {
    const dir = join(out, slug(route))
    mkdirSync(dir, { recursive: true })
    const res = []
    for (let i = 0; i < runs; i++)
      res.push(lighthouse(route, join(dir, `run-${i}.json`), multiplier))
    const m = (k) => median(res.map((x) => x[k]))
    const med = {
      lcpMs: m('lcpMs'),
      tbtMs: m('tbtMs'),
      cls: m('cls'),
      fcpMs: m('fcpMs'),
      siMs: m('siMs'),
      score: m('score'),
      benchmarkIndex: m('benchmarkIndex'),
    }
    allBi.push(...res.map((x) => x.benchmarkIndex))
    const v = {
      lcp: verdict(med.lcpMs, lab.lcpTargetMs, lab.lcpFailMs),
      tbt: verdict(med.tbtMs, lab.tbtTargetMs, lab.tbtFailMs),
      cls: verdict(med.cls, null, lab.clsFail),
    }
    results[route] = { median: med, verdict: v, runs: res }
    console.log(
      `${route}: LCP ${Math.round(med.lcpMs)} ms (${v.lcp}) · TBT ${Math.round(med.tbtMs)} ms (${v.tbt}) · CLS ${med.cls?.toFixed(3)} (${v.cls}) · BI ${med.benchmarkIndex} · ×${multiplier} · ${method}`,
    )
  }
  const bi = median(allBi)
  summary = {
    at: new Date().toISOString(),
    base,
    preset,
    method,
    tier,
    runs,
    multiplier,
    benchmarkIndex: bi,
    calibratedMultiplier: bi === null ? null : calibratedMultiplier(bi),
    calibration,
    limits: lab,
    pass: Object.values(results).every((r) => Object.values(r.verdict).every((x) => x !== 'fail')),
    routes: results,
  }
} finally {
  await server.stop()
}

const file = writeJson(join(out, 'summary.json'), summary)
console.log(`lighthouse: ${summary.pass ? 'within fail lines' : 'past a fail line'} → ${file}`)
process.exit(gate && !summary.pass ? 1 : 0)
