<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules: actualengineer.com

- **Read first:** `/Users/buttbuddy/.claude/plans/actualengineer/SPEC.md` (the design index) and `/Users/buttbuddy/.claude/plans/actualengineer/RULES.md` (the rules every build agent obeys). PLAN.md Appendices A to C win over everything else.
- **Stack:** Next 16.3.8 App Router, React 19.3, vanilla three 0.186.1, CSS Modules plus `src/styles/tokens.css`. No R3F, drei, GSAP, Lenis, Motion or Tailwind. Never add, remove or upgrade a dependency.
- **Next docs:** read `node_modules/next/dist/docs/` for every Next API you touch, especially `01-app/02-guides/{view-transitions,preventing-flash-before-hydration,forms,json-ld,content-security-policy}.md`.
- **Ownership:** each path has one owning lane per wave (PLAN.md Appendix C, mirrored in `lanes.json`). Edit only what your lane owns; file a request for anything else.
- **Frozen files:** never edit a file marked F in Appendix C (the content, stage, figure, drawing and motion contracts, tokens, root config, page shells). Only integrators change them, through requests.
- **Ports:** use only your lane's `PORT` (next start, Playwright) and `DEV_PORT` (next dev) from `.lane.env`, through `npm run dev` and `npm run start`. Never 3000, 4000, 5000, 5001, 5173, 5176, 5432 or 7000. One `next dev` per worktree.
- **Builds:** go through `scripts/with-lock.mjs` (at most three at once); `npm run verify` does this for you.
- **Copy:** every visible string comes from `src/content/**`. Placeholders use `hold()`; unconfirmed promises use `confirm()`. Plain words before symbols. US English. Never invent clients, quotes, numbers, logos or stats.
- **Client components:** files named `*.client.ts(x)`, never importing `@/content`, three or roughjs.
- **3D:** only `src/stage/runtime/**` and `src/scenes/**` import three. Pages use the Stage API in `src/stage/host.ts`.
- **Rendering:** all five pages stay static (○). No `export const dynamic`, no nonce CSP, `cacheComponents` stays off.
- **Tests:** Playwright `channel: 'chrome'` only; never `npx playwright install`. `PW_WORKERS=2` unless told otherwise.
- **Format:** Prettier house style (no semicolons, single quotes, width 100, trailing commas): `npm run format -- <files>`.
- **Done means:** `npm run verify` passes, plus your lane's own checks.
