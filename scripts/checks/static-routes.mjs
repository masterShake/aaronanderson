/**
 * Static-route check, after `next build`: the five pages and /_not-found are
 * prerendered (○), /drawings/[file] is prerendered from generateStaticParams
 * with no fallback (●), and nothing renders on demand (ƒ). Pass the build log
 * with --log <file> to also scan the route table for ƒ.
 *
 *   node scripts/checks/static-routes.mjs [--log build.log]
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../lib/lane-env.mjs'

const STATIC = ['/', '/services', '/how-it-works', '/about', '/contact', '/_not-found']
const SSG = ['/drawings/[file]']
const errors = []

const manifestPath = join(ROOT, '.next/prerender-manifest.json')
if (!existsSync(manifestPath)) {
  console.error('static-routes: no .next/prerender-manifest.json; run the build first')
  process.exit(1)
}
const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
const routes = Object.keys(m.routes ?? {})
for (const r of STATIC) if (!routes.includes(r)) errors.push(`${r} is not prerendered (expected ○)`)
for (const r of SSG) {
  const d = m.dynamicRoutes?.[r]
  if (!d) errors.push(`${r} has no generateStaticParams entry (expected ●)`)
  else if (d.fallback !== false) errors.push(`${r} has a fallback (expected dynamicParams = false)`)
  const prefix = r.replace(/\[[^\]]+\]$/, '')
  if (!routes.some((x) => x.startsWith(prefix))) errors.push(`${r} prerendered no files`)
}

const i = process.argv.indexOf('--log')
if (i > 0) {
  const log = readFileSync(process.argv[i + 1], 'utf8')
  for (const line of log.split('\n'))
    if (/^\s*[┌├└│]?\s*ƒ\s/.test(line)) errors.push(`dynamic route in build: ${line.trim()}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(
  `static-routes: ${STATIC.length} static pages ○, ${SSG.length} SSG route ● (${routes.filter((r) => r.startsWith('/drawings/')).length} files)`,
)
