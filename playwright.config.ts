import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Playwright for every suite. All projects run real Chrome (channel 'chrome');
 * never `npx playwright install`. The port comes from .lane.env (PORT), so
 * each worktree tests its own build. webServer only starts `next start` (build
 * first); it never reuses a server, and is skipped when PLAYWRIGHT_BASE_URL is
 * set or when only the unit project runs.
 */

function lanePort(): number {
  if (process.env.PORT) return Number(process.env.PORT)
  const file = join(__dirname, '.lane.env')
  if (existsSync(file)) {
    const m = /^\s*PORT\s*=\s*(\d+)\s*$/m.exec(readFileSync(file, 'utf8'))
    if (m) return Number(m[1])
  }
  return 3100
}

const PORT = lanePort()
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`
const projectsAsked = process.argv
  .flatMap((a, i, all) =>
    a === '--project' ? [all[i + 1]] : a.startsWith('--project=') ? [a.slice(10)] : [],
  )
  .filter(Boolean)
const UNIT_ONLY = projectsAsked.length > 0 && projectsAsked.every((p) => p === 'unit')
const chrome = { channel: 'chrome' as const }

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: Number(process.env.PW_WORKERS ?? 2),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: BASE, trace: 'retain-on-failure', ...chrome },
  webServer:
    process.env.PLAYWRIGHT_BASE_URL || UNIT_ONLY
      ? undefined
      : {
          command: 'node scripts/run-next.mjs start',
          url: BASE,
          reuseExistingServer: false,
          timeout: 120_000,
          env: { PORT: String(PORT) },
        },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1280, height: 800 } },
      testIgnore: /(a11y|stage|seam|perf|shots|frames)\.spec\.ts$/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...chrome },
      testIgnore: /(a11y|stage|seam|perf|shots|frames)\.spec\.ts$/,
    },
    {
      name: 'a11y',
      use: { ...devices['Desktop Chrome'], ...chrome },
      testMatch: /a11y\.spec\.ts$/,
    },
    {
      name: 'gpu',
      use: {
        ...devices['Desktop Chrome'],
        ...chrome,
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] },
      },
      testMatch: /(stage|seam|perf)\.spec\.ts$/,
    },
    {
      name: 'shots',
      use: { ...devices['Desktop Chrome'], ...chrome },
      testMatch: /(shots|frames)\.spec\.ts$/,
    },
    {
      name: 'unit',
      testDir: 'src',
      testMatch: /\.unit\.spec\.ts$/,
    },
  ],
})
