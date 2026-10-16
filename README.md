# actualengineer.com

The marketing site for Actual Engineer: five sheets (Home, Services, How It Works, About,
Contact) drawn as a construction drawing set. Blueprint drawings draw themselves, become
aluminum-and-orange 3D models, then run.

Next.js 16.3.8 (App Router, every page static), React 19.3, vanilla three.js 0.186, CSS
Modules.

## Setup

- Node 24.x (what Vercel runs; newer Node works locally with an engine warning) and npm.
- `npm install` (the lockfile pins every version; never upgrade one casually).
- `npm run dev` starts `next dev` on this checkout's `DEV_PORT` (from `.lane.env`, default
  3120).
- `npm run build`, then `npm run start`, serves the production build on `PORT` (default 3100).
- Playwright uses the Chrome you already have (`channel: 'chrome'`). Never run
  `npx playwright install`.

Never use ports 3000, 4000, 5000, 5001, 5173, 5176, 5432 or 7000 on this machine.

## Editing content

Every visible word lives in `src/content/**`. Facts you still owe the site are `hold()`
placeholders; promises you have not agreed to yet are `confirm()` claims.

- `npm run punchlist` lists what is still open. Every build but production also shows it at
  `/punch-list`; `SHOW_HOLDS=1 npm run dev` shows the tags on the pages.
- `npm run punchlist -- --write` regenerates `PLACEHOLDERS.md`, with the deployment
  settings.
- `npm run check:content` enforces the copy rules: banned words, digits, US spelling and
  hand notes.

How to fill a HOLD, confirm a claim or change a page: `docs/content.md`.

## Scripts

| Command                 | What it does                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`           | `next dev` on `DEV_PORT`                                                     |
| `npm run build`         | content check, punch-list summary, then `next build`                         |
| `npm run start`         | `next start` on `PORT`                                                       |
| `npm run lint`          | ESLint, zero warnings allowed                                                |
| `npm run typecheck`     | route types, then `tsc`                                                      |
| `npm run format`        | Prettier (no semicolons, single quotes, width 100)                           |
| `npm run check:content` | copy rules                                                                   |
| `npm run punchlist`     | open HOLDs and CONFIRMs (`--json`, `--write`, `--ci`)                        |
| `npm run verify:quick`  | lint, typecheck, content check, unit tests                                   |
| `npm run verify`        | the above, then a locked build, the static-route check and the smoke tests   |
| `npm run test:e2e`      | every browser suite on desktop and mobile                                    |
| `npm run test:a11y`     | axe on every route, tier, width and UI state                                 |
| `npm run test:keyboard` | skip link, menu, focus and header, roving focus, toggletips, reflow, spacing |
| `npm run test:prod`     | no placeholders in a production-mode build                                   |
| `npm run perf:budgets`  | initial JS, preloaded fonts and HTML size against `budgets.json`             |
| `npm run perf:lh`       | Lighthouse, median of runs, optional calibrated CPU slowdown                 |
| `npm run shots`         | review screenshots and the orange-share check                                |
| `npm run shots:frames`  | storyboard frames of the hero and the service drawings                       |
| `npm run dump:text`     | the visible text of every page, for copy review                              |

Every suite, its options and the budgets: `docs/testing.md`.

## Deploying

Every build shows the production look: plain fallbacks, no HOLD or CONFIRM tags, and no
proof until it is real. To review what is still open, use `/punch-list` (any build but
production) or review mode (`SHOW_HOLDS=1 npm run dev`, see `docs/content.md`). Production
also returns 404 for `/kit` and `/punch-list`. Set `STRICT_HOLDS=1`
in Production only when you are ready to launch: the build then fails while any essential
HOLD or pending CONFIRM remains.

The full checklist (Vercel project, environment variables, email DNS, the booking link):
`docs/deploy.md`.
