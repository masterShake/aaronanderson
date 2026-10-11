# Testing

Every browser test runs in real Chrome through Playwright (`channel: 'chrome'`). Never run
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

Specs that only make sense in one project skip themselves elsewhere, with the reason
(`seo`, `keyboard`, `dump-text` and `prod` run in desktop; `budgets` in mobile). So
`npm run test:e2e` runs each check once.

## Servers and ports

- `playwright.config.ts` reads `PORT` from `.lane.env` and starts `next start` itself. Build
  first. It never reuses a running server, so stop yours before a run, or set
  `PLAYWRIGHT_BASE_URL` to test a server you started.
- The scripts in `scripts/perf/`, `scripts/budgets/` and `scripts/screenshots.mjs` use a
  server already on `PORT`, or start `next start` there themselves and stop it after.
- Builds go through `node scripts/with-lock.mjs npm run build` (at most three at once across
  worktrees). `npm run verify` does this for you.

## Network guard

`e2e/fixtures.ts` aborts every request that is not to 127.0.0.1 and records it, unless
`E2E_NETWORK=1`. Import `test` and `expect` from `./fixtures`, not from `@playwright/test`.

## Every script

| Script                                | What it checks                                                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:quick`                | lint (0 warnings), typecheck, content check, unit tests                                                                                                                                                    |
| `npm run verify`                      | the above, a locked build, the static-route check and the smoke suite. `VERIFY_FULL=1` adds a11y, figures and budgets                                                                                      |
| `npm run test:smoke`                  | each sheet: one H1, one main, skip link, Book a call, no console errors or CSP reports; motion switch; static build                                                                                        |
| `npm run test:e2e`                    | every spec in the desktop and mobile projects (pass one file after `--` to narrow it)                                                                                                                      |
| `npm run test:a11y`                   | axe on routes × tiers (still, svg) × widths (390, 1280) × states (menu open, callout open, form errors, FAQ open, toggles flipped). Fails on serious or critical; `A11Y_STRICT=1` fails on any             |
| `npm run test:keyboard`               | skip link; menu by keyboard; focus never fully hidden by the sticky header (2.4.11, walked forwards and backwards); roving tabindex; toggletips (1.4.13); reflow at 320 px; text spacing (1.4.12)          |
| `npm run test:e2e -- e2e/seo.spec.ts` | titles, descriptions, canonical links, Open Graph tags and 1200×630 images, JSON-LD (parses, escapes `<`, no HOLD text, no offers), sitemap, robots, manifest, icons, noindex outside production           |
| `npm run test:prod`                   | against a production-mode build: no HOLD text or `[data-hold]`, no pending CONFIRM, no proof section, `/kit` and `/punch-list` 404, clean JSON-LD, no `unsafe-eval`, no debug hooks. Skips on other builds |
| `npm run test:figures`                | the figure DOM contract                                                                                                                                                                                    |
| `npm run test:stage`, `npm run seam`  | the 3D stage and the SVG-to-3D seam (gpu project)                                                                                                                                                          |
| `npm run perf:budgets`                | initial JS and preloaded fonts per route (mobile), then HTML brotli per route (`scripts/budgets/html-size.mjs`)                                                                                            |
| `npm run perf:lh`                     | Lighthouse, see below                                                                                                                                                                                      |
| `npm run perf:3d`                     | 3D chunk sizes (`scripts/check-3d-bundle.mjs`)                                                                                                                                                             |
| `npm run shots`                       | full-page shots at 360, 390, 768, 1280 and 1440 in still and svg, the header at 375, first viewports at 1280×800 and 390×844, and the orange share of every viewport slice (`orange.json`, at most 5%)     |
| `npm run shots:frames`                | the hero frozen at 0, 600, 1320, 1700, 2400, 2950, 3070, 4000, 4670, 9000, 18500 and 25000 ms; service figures at p = 0, .25, .5, .75 and 1 on `/kit/fig/<id>`                                             |
| `npm run dump:text`                   | each page's outline and visible text, per build mode; fails on leaked markup (`[[term]]`, `{var}`, `undefined`)                                                                                            |
| `node scripts/budgets/check.mjs`      | every byte budget in one pass, without the test runner                                                                                                                                                     |
| `node scripts/screenshots.mjs`        | a quick contact sheet of every route (`--at 0,1500,2950` freezes animations at those times)                                                                                                                |

## Production-mode checks

```sh
VERCEL_ENV=production node scripts/with-lock.mjs npm run build
npm run test:prod
npm run build   # rebuild without VERCEL_ENV before verify or any preview-mode suite
```

## Environment knobs

| Variable              | Used by                                            | Meaning                                                                    |
| --------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `PORT`                | Playwright, scripts                                | port for `next start` (default from `.lane.env`)                           |
| `PW_WORKERS`          | Playwright                                         | worker count (default 2)                                                   |
| `PLAYWRIGHT_BASE_URL` | Playwright, scripts                                | test a server that is already running instead of starting one              |
| `ARTIFACTS_DIR`       | every platform spec/script                         | where reports and images go (default `artifacts/`, which git ignores)      |
| `ROUTES`              | a11y, keyboard, budgets, shots, dump-text, scripts | comma list of paths, e.g. `/,/about`                                       |
| `WIDTHS`              | a11y, shots, screenshots                           | comma list of widths, e.g. `390,1280` (375 adds the header shots)          |
| `TIERS`               | a11y, shots, screenshots                           | comma list of `still`, `svg`, `webgl` (webgl runs only in the gpu project) |
| `FIGURES`             | frames                                             | comma list of service figures, e.g. `s01,s03`                              |
| `E2E_NETWORK`         | fixtures                                           | `1` lets requests leave 127.0.0.1                                          |
| `A11Y_STRICT`         | a11y                                               | `1` fails on findings of any impact (from W2 on)                           |
| `CHROME_PATH`         | Lighthouse                                         | the Chrome binary (default: the installed Google Chrome)                   |
| `LH_RUNS`             | Lighthouse                                         | runs per route (default 5)                                                 |

Outputs under `ARTIFACTS_DIR`: `a11y/`, `keyboard/`, `budgets/`, `shots/` (with
`orange.json`), `frames/`, `text/`, `lighthouse/<preset>/summary.json` and `screenshots/`.

## Budgets (budgets.json; methods in PLAN Appendix B §B10)

| Budget          | Limit                           | How it is measured                                                                    |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| Initial JS      | 160 KB gzip                     | gzip-9 sum of every same-origin JS file fetched before `load` + 2 s, on `?tier=still` |
| HTML            | 60 KB brotli                    | brotli (quality 11) of each route's HTML                                              |
| Preloaded fonts | 75 KB                           | the summed bytes of every `<link rel=preload as=font>`                                |
| Lighthouse      | LCP 2.5 s, TBT 200 ms, CLS 0.05 | mobile, median of 5, production-mode build                                            |

## Lighthouse

```sh
npm run perf:lh -- --runs 5 --calibrate --routes /,/services,/how-it-works,/about,/contact
```

- `--calibrate` makes one calibration run, reads Lighthouse's `benchmarkIndex` (BI) and sets
  the CPU slowdown to `clamp(round(4 × BI / 1750), 4, 10)`. `--multiplier N` sets it
  directly; the default is Lighthouse's own 4×.
- `--tier svg` (default) keeps the 3D chunk out; `--tier webgl` measures it; `--tier none`
  adds no query. `--preset desktop` runs the desktop preset.
- `--gate` exits non-zero when a median is past its fail line; without it the verdicts are
  only reported.
- Writes `summary.json` (per route: medians of LCP, TBT, CLS, FCP, Speed Index and score,
  with every run) plus the multiplier and benchmarkIndex.
- Lighthouse numbers swing with machine load. Run it with the machine otherwise idle, and
  gate only on a production-mode build (`VERCEL_ENV=production`), so no HOLD clouds are
  measured.

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
