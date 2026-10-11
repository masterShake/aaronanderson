/**
 * The 3D bundle budget (D9, §B10), measured on the last `next build`:
 *   runtime group ≤165 KB gzip-9 (three + the Line2 family + RoomEnvironment + runtime + kit),
 *   each scene chunk ≤6 KB, each route's 3D total ≤180 KB.
 *
 * Turbopack loads an async chunk group with
 *   Promise.all(["static/chunks/a.js", …].map(load)).then(() => require(id))
 * so the runtime group is the list that contains the runtime chunk (marker
 * "stage-canvas"), and a scene's chunks are the list whose chunk carries
 * `id:"<scene>",create`, less anything already in the runtime group.
 * `next experimental-analyze --output` attributes bytes inside a chunk.
 *
 *   npm run perf:3d            (ARTIFACTS_DIR=… also writes 3d-bundle.json)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '../..')
const NEXT = join(ROOT, '.next')
const CHUNKS = join(NEXT, 'static/chunks')
const KB = 1024
const BUDGET = { runtime: 165, scene: 6, route: 180 }
/** Which scenes each route can load (worst case: every scene on the page). */
const ROUTES = { '/': ['hero'], '/services': ['s02', 's03', 's04', 's06'], '/kit/stage': ['_demo'] }
/** Measured and reported, never gated: the W0 bundle probe (preview only, ?probe=1). */
const UNGATED = new Set(['_probe'])

if (!existsSync(CHUNKS)) {
  console.error('perf:3d: no .next/static/chunks; run a build first (npm run build)')
  process.exit(2)
}

const files = readdirSync(CHUNKS).filter((f) => f.endsWith('.js'))
const body = new Map(files.map((f) => [`static/chunks/${f}`, readFileSync(join(CHUNKS, f))]))
const gz = new Map([...body].map(([k, v]) => [k, gzipSync(v, { level: 9 }).length]))
const text = (k) => body.get(k)?.toString('utf8') ?? ''
const sum = (list) => list.reduce((s, k) => s + (gz.get(k) ?? 0), 0)

const lists = []
const re = /Promise\.all\(\[((?:"static\/chunks\/[^"]+\.js",?)+)\]\.map/g
for (const k of body.keys()) {
  for (const m of text(k).matchAll(re)) lists.push(m[1].split(',').map((s) => s.slice(1, -1)))
}

const runtimeChunk = [...body.keys()].find((k) => text(k).includes('stage-canvas'))
const runtime = runtimeChunk ? lists.find((l) => l.includes(runtimeChunk)) : undefined
if (!runtime) {
  console.error('perf:3d: could not find the runtime chunk group (marker "stage-canvas")')
  process.exit(1)
}
const inRuntime = new Set(runtime)

const sceneRe = /id:"(_demo|_probe|hero|s0\d)",create/
const scenes = {}
for (const l of lists) {
  for (const k of l) {
    const m = sceneRe.exec(text(k))
    if (!m) continue
    const own = l.filter((c) => !inRuntime.has(c))
    const prev = scenes[m[1]]
    if (!prev || sum(own) > sum(prev)) scenes[m[1]] = own
  }
}

const kb = (b) => Math.round((b / KB) * 10) / 10
const report = {
  measuredAt: new Date().toISOString(),
  method: 'gzip-9 of the built chunks; groups from Turbopack async loaders',
  budgetKB: BUDGET,
  runtime: { kb: kb(sum(runtime)), chunks: runtime.map((k) => [k, kb(gz.get(k) ?? 0)]) },
  scenes: Object.fromEntries(
    Object.entries(scenes).map(([id, l]) => [id, { kb: kb(sum(l)), chunks: l }]),
  ),
  routes: {},
  failures: [],
}
if (report.runtime.kb > BUDGET.runtime)
  report.failures.push(`runtime group ${report.runtime.kb} KB > ${BUDGET.runtime} KB`)
for (const [id, s] of Object.entries(report.scenes))
  if (!UNGATED.has(id) && s.kb > BUDGET.scene)
    report.failures.push(`scene ${id} ${s.kb} KB > ${BUDGET.scene} KB`)
for (const [route, ids] of Object.entries(ROUTES)) {
  const all = new Set(runtime)
  for (const id of ids) for (const c of scenes[id] ?? []) all.add(c)
  const total = kb(sum([...all]))
  report.routes[route] = total
  if (total > BUDGET.route) report.failures.push(`route ${route} ${total} KB > ${BUDGET.route} KB`)
}

console.log(`3D runtime group: ${report.runtime.kb} KB gzip (budget ${BUDGET.runtime})`)
for (const [k, v] of report.runtime.chunks) console.log(`  ${k}  ${v} KB`)
for (const [id, s] of Object.entries(report.scenes))
  console.log(`scene ${id}: ${s.kb} KB${UNGATED.has(id) ? ' (not gated)' : ''}`)
for (const [r, v] of Object.entries(report.routes)) console.log(`route ${r}: ${v} KB 3D total`)
if (process.env.ARTIFACTS_DIR) {
  mkdirSync(process.env.ARTIFACTS_DIR, { recursive: true })
  writeFileSync(join(process.env.ARTIFACTS_DIR, '3d-bundle.json'), JSON.stringify(report, null, 2))
}
if (report.failures.length) {
  console.error(`perf:3d: FAIL\n  ${report.failures.join('\n  ')}`)
  process.exit(1)
}
console.log('perf:3d: PASS')
