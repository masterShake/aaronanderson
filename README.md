# actualengineer.com

The marketing site for Actual Engineer: five sheets (Home, Services, How It Works, About,
Contact) drawn as a construction drawing set. Blueprint drawings draw themselves, become
aluminum-and-orange 3D models, then run.

Next.js 16.3.8 (App Router, all pages static), React 19.3, vanilla three.js 0.186, CSS Modules.

## Setup

- Node 24 (Vercel's runtime; Node 26 works locally with an engine warning) and npm.
- `npm install`
- `npm run dev` starts `next dev` on this checkout's `DEV_PORT` (from `.lane.env`, default 3120).
- `npm run build && npm run start` serves the production build on `PORT` (default 3100).

Never use ports 3000, 4000, 5000, 5001, 5173, 5176, 5432 or 7000 on this machine.

## Editing content

Every visible word lives in `src/content/**`. Facts you still owe the site are `hold()`
placeholders; promises you have not agreed to yet are `confirm()` claims.

- `npm run punchlist` lists what is still open.
- `npm run punchlist -- --write` regenerates `PLACEHOLDERS.md`.
- `npm run check:content` enforces the copy rules (banned words, digits, US spelling, hand notes).

See `docs/content.md`.

## Checks

| Command                | What it does                                                               |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run verify:quick` | lint, typecheck, content check, unit tests                                 |
| `npm run verify`       | the above, then a locked build, the static-route check and the smoke tests |
| `npm run test:e2e`     | every Playwright suite on desktop and mobile (real Chrome)                 |

See `docs/testing.md`.

## Deploying

Vercel, Node 24. Previews show HOLD placeholders; production shows plain fallbacks and hides
proof until it is real. Set `STRICT_HOLDS=1` in Production only when you are ready to launch:
the build then fails while any essential HOLD or pending CONFIRM remains. See `docs/deploy.md`
and the deployment settings in `PLACEHOLDERS.md`.
