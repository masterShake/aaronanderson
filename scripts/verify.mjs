/**
 * The full local gate:
 *   verify:quick (lint, typecheck, check:content, unit tests)
 *   then a build under the shared build lock, the static-route check and the smoke tests.
 * VERIFY_FULL=1 adds the a11y, figure-contract and budget suites.
 * With ARTIFACTS_DIR set, writes $ARTIFACTS_DIR/verify.json and build.log.
 *
 *   npm run verify
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ROOT } from './lib/lane-env.mjs'

const ART = process.env.ARTIFACTS_DIR
const logDir = ART ?? join(tmpdir(), 'ae-verify')
mkdirSync(logDir, { recursive: true })
const buildLog = join(logDir, 'build.log')
const results = []

function run(name, cmd, args, { capture } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    console.log(`\n▶ ${name}: ${[cmd, ...args].join(' ')}`)
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: process.env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let out = ''
    if (capture) {
      child.stdout.on('data', (d) => {
        out += d
        process.stdout.write(d)
      })
      child.stderr.on('data', (d) => {
        out += d
        process.stderr.write(d)
      })
    }
    child.on('exit', (code) => {
      if (capture) writeFileSync(capture, out)
      const pass = code === 0
      results.push({ name, cmd: [cmd, ...args].join(' '), pass, ms: Date.now() - t0 })
      resolve(pass)
    })
  })
}

const steps = [
  ['lint', 'npm', ['run', 'lint']],
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['check:content', 'npm', ['run', 'check:content']],
  ['test:unit', 'npm', ['run', 'test:unit']],
  ['build', 'node', ['scripts/with-lock.mjs', 'npm', 'run', 'build'], { capture: buildLog }],
  ['check:static', 'node', ['scripts/checks/static-routes.mjs', '--log', buildLog]],
  ['test:smoke', 'npm', ['run', 'test:smoke']],
]
if (process.env.VERIFY_FULL === '1')
  steps.push(
    ['test:a11y', 'npm', ['run', 'test:a11y']],
    ['test:figures', 'npm', ['run', 'test:figures']],
    ['perf:budgets', 'npm', ['run', 'perf:budgets']],
  )

let ok = true
for (const [name, cmd, args, opts] of steps) {
  if (!(await run(name, cmd, args, opts))) {
    ok = false
    break
  }
}

const summary = { pass: ok, at: new Date().toISOString(), steps: results }
if (ART) writeFileSync(join(ART, 'verify.json'), JSON.stringify(summary, null, 2))
console.log(`\nverify: ${ok ? 'PASS' : 'FAIL'}`)
for (const r of results)
  console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.name} (${(r.ms / 1000).toFixed(1)} s)`)
process.exit(ok ? 0 : 1)
