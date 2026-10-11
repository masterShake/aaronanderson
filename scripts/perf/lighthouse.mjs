/**
 * Lighthouse 13.5 (mobile, performance only), median of N runs per route,
 * against a running `next start` (PLAN Appendix B §B10). Gate it on a
 * production-mode build (VERCEL_ENV=production) so no HOLD clouds are measured.
 *
 *   npm run perf:lh -- [--base URL] [--routes /,/services] [--runs 5] [--calibrate]
 *                      [--multiplier 7] [--tier svg|still|webgl|none] [--preset desktop] [--gate]
 *                      [--method simulate|devtools]
 *   npm run perf:lh -- --webgl-gate [--method devtools] [--runs 5]   (the WebGL Cost gate)
 *   npm run perf:lh -- --check-3d <report.json,…>                   (no Lighthouse run)
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
 * --webgl-gate the WebGL quality gate's Cost check (TBT on ?tier=webgl ≤ the fail line). The
 *              mobile preset never measures 3D: on a coarse pointer the hero waits until it is
 *              30% visible, which a Pixel-size viewport only reaches after a scroll, so the
 *              runtime chunk is never fetched. This mode forces --preset desktop (fine pointer:
 *              the hero loads after load and idle), --tier webgl, and a hardware renderer
 *              (--use-angle=metal --ignore-gpu-blocklist), measures / and /services#s-02 unless
 *              --routes or ROUTES says otherwise, writes under lighthouse/webgl-gate[-devtools],
 *              and fails a run whose network-requests lack the 3D runtime chunk (the chunk
 *              carrying the "stage-canvas" marker, as in scripts/check-3d-bundle.mjs). Implies --gate.
 *              Its TBT is not the D9 HERO_TOUCH_3D input (that is the gpu project's hero.stage
 *              4x window); never use the mobile default-vs-svg delta for that.
 * --check-3d <report.json,…>  no Lighthouse run: applies the webgl gate's 3D check to saved
 *              reports (chunk bodies from the report's URLs, else this checkout's .next) and
 *              exits 1 when any lacks the runtime chunk.
 *
 * Writes <out>/summary.json (per route: medians of LCP, TBT, CLS, FCP, SI and
 * score, plus the runs) with the multiplier and benchmarkIndex; <out> is
 * $ARTIFACTS_DIR/lighthouse/<preset> or .lighthouse/<preset>. Uses CHROME_PATH
 * (default: the installed Google Chrome). Starts `next start` on this lane's
 * PORT when nothing is serving. Env: LH_RUNS, ROUTES, PLAYWRIGHT_BASE_URL.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  ROOT,
  arg,
  baseUrl,
  budgets,
  ensureServer,
  flag,
  list as commaList,
  median,
  outDir,
  routes,
  writeJson,
} from '../budgets/lib.mjs'

const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const LH = join(ROOT, 'node_modules/lighthouse/cli/index.js')
const base = baseUrl()

/** The 3D runtime chunk's marker (scripts/check-3d-bundle.mjs) and a scene chunk's. */
const RUNTIME_MARKER = 'stage-canvas'
const SCENE_RE = /id:"(hero|s0\d)",create/

/**
 * A chunk's text: this checkout's .next by file name (Turbopack names chunks by content hash),
 * else fetched from the base being measured. Never fetches from any other origin.
 */
const chunkText = new Map()
async function readChunk(url) {
  if (chunkText.has(url)) return chunkText.get(url)
  const u = new URL(url)
  const local = join(ROOT, '.next/static/chunks', basename(u.pathname))
  let text = existsSync(local) ? readFileSync(local, 'utf8') : ''
  if (!text && u.origin === new URL(base).origin) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (r.ok) text = await r.text()
    } catch {}
  }
  chunkText.set(url, text)
  return text
}

/** Which 3D chunks a Lighthouse report fetched: { runtime, scenes, runtimeUrls }. */
async function threeIn(report) {
  const items = report.audits?.['network-requests']?.details?.items ?? []
  const urls = [
    ...new Set(
      items
        .map((x) => x.url)
        .filter((u) => /\/_next\/static\/chunks\/[^/?]+\.js(\?|$)/.test(u ?? '')),
    ),
  ]
  const runtimeUrls = []
  const scenes = new Set()
  for (const u of urls) {
    const t = await readChunk(u)
    if (t.includes(RUNTIME_MARKER)) runtimeUrls.push(u)
    const m = SCENE_RE.exec(t)
    if (m) scenes.add(m[1])
  }
  return { runtime: runtimeUrls.length > 0, runtimeUrls, scenes: [...scenes].sort() }
}

const check3d = arg('--check-3d')
if (check3d) {
  let bad = 0
  for (const file of commaList(check3d)) {
    const r = await threeIn(JSON.parse(readFileSync(file, 'utf8')))
    if (!r.runtime) bad++
    console.log(
      `${r.runtime ? 'ok  ' : 'FAIL'} ${file}: runtime ${r.runtime ? r.runtimeUrls.map((u) => basename(u)).join(',') : 'not fetched'} · scenes [${r.scenes.join(',')}]`,
    )
  }
  console.log(
    `check-3d: ${bad ? `${bad} report(s) measured no 3D` : 'every report fetched the 3D runtime'}`,
  )
  process.exit(bad ? 1 : 0)
}

const webglGate = flag('--webgl-gate')
const runs = Math.max(1, Number(arg('--runs', process.env.LH_RUNS ?? 5)))
const preset = webglGate ? 'desktop' : arg('--preset', 'mobile')
const tier = webglGate ? 'webgl' : arg('--tier', 'svg')
const calibrate = flag('--calibrate')
const gate = webglGate || flag('--gate')
const method = arg('--method', 'simulate')
if (method !== 'simulate' && method !== 'devtools') {
  console.error(`lighthouse: --method must be simulate or devtools, not ${method}`)
  process.exit(2)
}
if (webglGate && (arg('--preset') ?? 'desktop') !== 'desktop')
  console.warn('lighthouse: --webgl-gate measures with the desktop preset; --preset ignored')
if (webglGate && (arg('--tier') ?? 'webgl') !== 'webgl')
  console.warn('lighthouse: --webgl-gate measures ?tier=webgl; --tier ignored')
const lab = budgets().lab
const name = webglGate ? 'webgl-gate' : preset
const sub = method === 'simulate' ? name : `${name}-${method}`
const out = outDir(join('lighthouse', sub), join('.lighthouse', sub))
const chromeFlags = [
  '--headless=new',
  ...(webglGate ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : []),
]

if (!existsSync(CHROME_PATH)) {
  console.error(`lighthouse: no Chrome at ${CHROME_PATH}; set CHROME_PATH`)
  process.exit(2)
}

const calibratedMultiplier = (bi) => Math.min(10, Math.max(4, Math.round((4 * bi) / 1750)))

const slug = (route) =>
  route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/#]/g, '_') || 'home'
/** The tier query goes before any #fragment. */
const urlFor = (route) => {
  const [path, hash] = route.split('#')
  const q = tier === 'none' ? '' : `${path.includes('?') ? '&' : '?'}tier=${tier}`
  return `${base}${path}${q}${hash === undefined ? '' : `#${hash}`}`
}
/**
 * --webgl-gate's routes when none are given. Lighthouse never scrolls and the service scenes
 * sit below the first screen, so /services opens at S-02's sheet (#s-02, the first service
 * scene shipping as 'webgl'); at the desktop screen that fetches the runtime and the s02 chunk.
 */
const WEBGL_GATE_ROUTES = ['/', '/services#s-02']

/** One Lighthouse run; returns the metrics read from its JSON report. */
function lighthouse(route, file, multiplier) {
  const args = [
    LH,
    urlFor(route),
    '--quiet',
    '--only-categories=performance',
    '--output=json',
    `--output-path=${file}`,
    `--chrome-flags=${chromeFlags.join(' ')}`,
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
  const list = webglGate && !arg('--routes') && !process.env.ROUTES ? WEBGL_GATE_ROUTES : routes()
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
    for (let i = 0; i < runs; i++) {
      const file = join(dir, `run-${i}.json`)
      const r = lighthouse(route, file, multiplier)
      if (webglGate) {
        const t = await threeIn(JSON.parse(readFileSync(file, 'utf8')))
        r.three = { runtime: t.runtime, scenes: t.scenes }
        if (!t.runtime) console.log(`${route} run ${i}: FAIL, the 3D runtime chunk was not fetched`)
      }
      res.push(r)
    }
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
      // the Cost gate only counts when every run fetched the 3D runtime
      ...(webglGate ? { runtime3d: res.every((x) => x.three?.runtime) ? 'pass' : 'fail' } : {}),
    }
    results[route] = { median: med, verdict: v, runs: res }
    console.log(
      `${route}: LCP ${Math.round(med.lcpMs)} ms (${v.lcp}) · TBT ${Math.round(med.tbtMs)} ms (${v.tbt}) · CLS ${med.cls?.toFixed(3)} (${v.cls})${webglGate ? ` · 3D runtime (${v.runtime3d})` : ''} · BI ${med.benchmarkIndex} · ×${multiplier} · ${method}`,
    )
  }
  const bi = median(allBi)
  summary = {
    at: new Date().toISOString(),
    base,
    preset,
    method,
    tier,
    webglGate,
    chromeFlags,
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
