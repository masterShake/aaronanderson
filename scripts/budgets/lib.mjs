/**
 * Shared helpers for the measurement scripts (scripts/budgets/**, scripts/perf/**,
 * scripts/screenshots.mjs): flags, budgets.json, the artifacts folder, and a
 * `next start` on this lane's PORT when nothing is serving yet.
 *
 * The server is only ever started through scripts/run-next.mjs (which refuses a
 * port another checkout holds) and only the child it started is stopped.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, laneEnv } from '../lib/lane-env.mjs'

export { ROOT }

/** `--key value` (or `--key=value`); a bare `--key` reads as 'true'. */
export function arg(name, fallback) {
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === name) {
      const next = argv[i + 1]
      return next === undefined || next.startsWith('--') ? 'true' : next
    }
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1)
  }
  return fallback
}

export const flag = (name) => arg(name, 'false') !== 'false'

/** Comma list to array, dropping blanks. */
export const list = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export const budgets = () => JSON.parse(readFileSync(join(ROOT, 'budgets.json'), 'utf8'))

/** The base URL: --base, then PLAYWRIGHT_BASE_URL, then this lane's PORT on 127.0.0.1. */
export const baseUrl = () =>
  (
    arg('--base') ??
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${laneEnv().PORT}`
  ).replace(/\/$/, '')

/** Routes: --routes, then ROUTES, then budgets.json. */
export const routes = () => {
  const r = list(arg('--routes') ?? process.env.ROUTES)
  return r.length ? r : budgets().routes
}

/** $ARTIFACTS_DIR/<sub> when set, else <repo>/<fallback> (default artifacts/<sub>, gitignored); created. */
export function outDir(sub, fallback) {
  const dir = process.env.ARTIFACTS_DIR
    ? join(process.env.ARTIFACTS_DIR, sub)
    : join(ROOT, fallback ?? join('artifacts', sub))
  mkdirSync(dir, { recursive: true })
  return dir
}

export function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  return file
}

export const kb = (n) => Math.round((n / 1024) * 10) / 10

export const median = (a) => {
  const s = [...a].filter((v) => typeof v === 'number' && !Number.isNaN(v)).sort((x, y) => x - y)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function up(base) {
  try {
    const r = await fetch(base, { redirect: 'manual', signal: AbortSignal.timeout(2000) })
    return r.status > 0
  } catch {
    return false
  }
}

/**
 * Makes sure something serves `base`. When nothing does and `base` is this
 * lane's own port, starts `next start` (the build must exist) and returns a
 * stop() for it; otherwise stop() does nothing.
 */
export async function ensureServer(base) {
  if (await up(base)) return { started: false, stop: async () => {} }
  const port = laneEnv().PORT
  const own = new URL(base)
  if (!['127.0.0.1', 'localhost'].includes(own.hostname) || Number(own.port) !== port)
    throw new Error(`nothing serves ${base}, and it is not this lane's port ${port}`)
  if (!existsSync(join(ROOT, '.next/BUILD_ID')))
    throw new Error('no build in .next; run the build (through scripts/with-lock.mjs) first')
  const child = spawn(process.execPath, [join(ROOT, 'scripts/run-next.mjs'), 'start'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PORT: String(port) },
  })
  let exited = false
  child.on('exit', () => (exited = true))
  const t0 = Date.now()
  while (!(await up(base))) {
    if (exited) throw new Error('next start exited before serving')
    if (Date.now() - t0 > 60_000) {
      child.kill('SIGTERM')
      throw new Error(`next start did not serve ${base} within 60 s`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  console.log(`(started next start on ${base}, pid ${child.pid})`)
  return {
    started: true,
    stop: () =>
      new Promise((resolve) => {
        if (exited) return resolve()
        child.once('exit', () => resolve())
        child.kill('SIGTERM')
        setTimeout(() => {
          if (!exited) child.kill('SIGKILL')
        }, 5000)
      }),
  }
}
