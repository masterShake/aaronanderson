/**
 * Runs a command holding one of three build slots, so at most three
 * `next build`s run at once across every worktree. Slots are mkdir locks in
 * $AE_LOCKS (default: the plan folder's locks/build-{1..3}); a lock older than
 * 15 minutes is stale and taken over.
 *
 *   node scripts/with-lock.mjs npm run build
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib/lane-env.mjs'

const LOCKS = process.env.AE_LOCKS ?? '/Users/buttbuddy/.claude/plans/actualengineer/locks'
const SLOTS = 3
const STALE_MS = 15 * 60 * 1000
const POLL_MS = 2000

const cmd = process.argv.slice(2)
if (!cmd.length) {
  console.error('usage: node scripts/with-lock.mjs <command> [args]')
  process.exit(2)
}

function tryAcquire() {
  mkdirSync(LOCKS, { recursive: true })
  for (let i = 1; i <= SLOTS; i++) {
    const dir = join(LOCKS, `build-${i}`)
    try {
      mkdirSync(dir)
      writeFileSync(join(dir, 'owner'), `${process.pid} ${ROOT} ${new Date().toISOString()}\n`)
      return dir
    } catch {
      try {
        if (Date.now() - statSync(dir).mtimeMs > STALE_MS) {
          rmSync(dir, { recursive: true, force: true })
          i--
        }
      } catch {}
    }
  }
  return null
}

let lock = tryAcquire()
const started = Date.now()
while (!lock) {
  if (Date.now() - started > 30 * 60 * 1000) {
    console.error('with-lock: waited 30 minutes for a build slot; giving up')
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, POLL_MS))
  lock = tryAcquire()
}
const release = () => {
  if (lock) rmSync(lock, { recursive: true, force: true })
  lock = null
}
console.log(`with-lock: holding ${lock}`)
const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: 'inherit', env: process.env })
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(sig, () => {
    child.kill(sig)
  })
child.on('exit', (code, signal) => {
  release()
  process.exit(code ?? (signal ? 1 : 0))
})
