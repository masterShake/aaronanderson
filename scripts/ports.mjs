/**
 * Port guard: refuses a port that another checkout's process is listening on,
 * so a lane never tests someone else's build. Uses lsof to find the listener
 * and its working directory.
 *
 *   node scripts/ports.mjs [port ...]     (default: this lane's PORT and DEV_PORT)
 */
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { FORBIDDEN_PORTS, ROOT, laneEnv } from './lib/lane-env.mjs'

const lsof = (args) => {
  try {
    return execFileSync('lsof', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

/** PIDs listening on the port, each with its working directory. */
export function listeners(port) {
  const pids = lsof(['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split('\n')
    .filter(Boolean)
  return pids.map((pid) => {
    const cwd = /^n(.*)$/m.exec(lsof(['-a', '-p', pid, '-d', 'cwd', '-Fn']))?.[1] ?? ''
    return { pid: Number(pid), cwd }
  })
}

/** Throws unless the port is allowed and free (or held only by this checkout). */
export function checkPort(port) {
  if (FORBIDDEN_PORTS.includes(port)) throw new Error(`Port ${port} is reserved; never use it.`)
  const root = realpathSync(ROOT).replace(/\/$/, '')
  for (const l of listeners(port)) {
    const cwd = l.cwd ? realpathSync(l.cwd).replace(/\/$/, '') : '(unknown)'
    if (cwd !== root)
      throw new Error(
        `Port ${port} is held by pid ${l.pid} in ${cwd}, not this checkout (${root}).`,
      )
    throw new Error(
      `Port ${port} is already in use by pid ${l.pid} in this checkout. Stop it first.`,
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = laneEnv()
  const ports = process.argv.slice(2).map(Number)
  let bad = 0
  for (const p of ports.length ? ports : [env.PORT, env.DEV_PORT]) {
    try {
      checkPort(p)
      console.log(`port ${p}: free`)
    } catch (e) {
      bad++
      console.error(`port ${p}: ${e.message}`)
    }
  }
  process.exit(bad ? 1 : 0)
}
