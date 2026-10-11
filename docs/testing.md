# Testing

_Skeleton from W0; the platform lane completes it._

All browser tests run in real Chrome through Playwright (`channel: 'chrome'`). Never run
`npx playwright install`.

## Projects

| Project | What runs                         | Notes                                                          |
| ------- | --------------------------------- | -------------------------------------------------------------- |
| desktop | `e2e/**` at 1280×800              | not a11y, stage, seam, perf, shots or frames                   |
| mobile  | `e2e/**` on Pixel 7               | same filter                                                    |
| a11y    | `e2e/a11y.spec.ts`                | axe, `wcag22aa`                                                |
| gpu     | `e2e/{stage,seam,perf}.spec.ts`   | `--use-angle=metal --ignore-gpu-blocklist`; judge 3D only here |
| shots   | `e2e/{shots,frames}.spec.ts`      | screenshots for review                                         |
| unit    | `src/**/__tests__/*.unit.spec.ts` | no browser                                                     |

## Ports and servers

- `playwright.config.ts` reads `PORT` from `.lane.env` and starts `next start` itself
  (build first). It never reuses a running server.
- Set `PLAYWRIGHT_BASE_URL` to test a server you started yourself.
- `PW_WORKERS` sets the worker count (default 2).

## Network guard

`e2e/fixtures.ts` aborts every request that is not to 127.0.0.1 and records it, unless
`E2E_NETWORK=1`. Import `test` and `expect` from `./fixtures`, not from `@playwright/test`.

## The gates

- `npm run verify:quick`: lint (0 warnings), typecheck, content check, unit tests.
- `npm run verify`: adds a build under `scripts/with-lock.mjs` (at most three at once),
  `scripts/checks/static-routes.mjs` and the smoke suite. `VERIFY_FULL=1` adds a11y, figures
  and budgets.

## W0 baselines (stub site, M1 Max)

Full numbers: `/Users/buttbuddy/.claude/plans/actualengineer/results/w0/baseline.json`.

| Measure              | Method                                                  | Stub site                                     | Budget                      |
| -------------------- | ------------------------------------------------------- | --------------------------------------------- | --------------------------- |
| Initial JS           | gzip-9, same-origin JS before load + 2 s, `?tier=still` | 139.6 KB on every route (framework about 135) | 160 KB                      |
| Preloaded fonts      | the three preloaded files                               | 63.3 KB                                       | 75 KB                       |
| HTML                 | brotli per route                                        | 7.6 to 12.2 KB                                | 60 KB                       |
| 3D probe             | `/kit/stage?probe=1` extra JS, gzip-9                   | 145.8 KB (no alias needed)                    | 165 KB                      |
| Lighthouse `/` at 4× | median of 3                                             | LCP 2632 ms, TBT 13 ms, CLS 0.115             | LCP 2500, TBT 200, CLS 0.05 |
| Lighthouse `/` at 7× | median of 3 (benchmarkIndex 3028)                       | LCP 2689 ms, TBT 41 ms, CLS 0.115             | same                        |

**Lighthouse gating rule:** the calibrated TBT (41 ms) is under 100 ms, so Lighthouse gates on
the calibrated multiplier, `--throttling.cpuSlowdownMultiplier=7` (Appendix B §B10).
