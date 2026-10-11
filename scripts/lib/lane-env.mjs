/**
 * Reads this checkout's .lane.env (PORT, DEV_PORT, LANE). Explicit env vars
 * win, then .lane.env, then the main checkout's defaults. Never reads .env*.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export function laneEnv() {
  const file = join(ROOT, '.lane.env')
  const vals = {}
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z_]+)\s*=\s*(\S*)\s*$/.exec(line)
      if (m) vals[m[1]] = m[2]
    }
  }
  return {
    PORT: Number(process.env.PORT || vals.PORT || 3100),
    DEV_PORT: Number(process.env.DEV_PORT || vals.DEV_PORT || 3120),
    LANE: process.env.LANE || vals.LANE || 'main',
  }
}

/** Ports no agent may ever use. */
export const FORBIDDEN_PORTS = [3000, 4000, 5000, 5001, 5173, 5176, 5432, 7000]
