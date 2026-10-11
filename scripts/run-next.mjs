/**
 * Starts Next on this lane's port, bound to 127.0.0.1:
 *   node scripts/run-next.mjs dev     next dev   -H 127.0.0.1 -p $DEV_PORT
 *   node scripts/run-next.mjs start   next start -H 127.0.0.1 -p $PORT
 * Ports come from .lane.env (explicit env vars win). Refuses a port another
 * checkout is using. Extra arguments pass through to next.
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { ROOT, laneEnv } from './lib/lane-env.mjs'
import { checkPort } from './ports.mjs'

const [mode, ...rest] = process.argv.slice(2)
if (mode !== 'dev' && mode !== 'start') {
  console.error('usage: node scripts/run-next.mjs dev|start [next args]')
  process.exit(2)
}
const env = laneEnv()
const port = mode === 'dev' ? env.DEV_PORT : env.PORT
try {
  checkPort(port)
} catch (e) {
  console.error(`run-next: ${e.message}`)
  process.exit(1)
}

console.log(`run-next: next ${mode} on http://127.0.0.1:${port} (lane ${env.LANE})`)
const child = spawn(
  process.execPath,
  [
    join(ROOT, 'node_modules/next/dist/bin/next'),
    mode,
    '-H',
    '127.0.0.1',
    '-p',
    String(port),
    ...rest,
  ],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: String(port) } },
)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => child.kill(sig))
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
