# actualengineer.com

Marketing site for Aaron Anderson: AI consulting for the people who design, build and sell houses.
A three.js house builds itself as you scroll. Chapter 1 (the architect's floor plan) drafts itself, and
chapter 2 turns the plan into a framed house, plank by plank; chapters 3–5 are copy and stubs. See
[docs/handoff.md](docs/handoff.md).

Next.js 16.3.8 (App Router, TypeScript), three.js 0.187, troika-three-text, Vitest.

```bash
npm install
npm run dev       # http://localhost:3120
npm run verify    # lint, typecheck, unit tests, production build
npm run shots     # after a build: screenshots of every animation stop → artifacts/shots
npm run format
```

Debug: `/?p=architects:0.5` jumps into the story, `/?debug` adds a HUD, `/?nowebgl` shows the static
fallback, and `/drawings/a-101.svg` is the finished plan as an SVG.

Render deploys `main` on every push (`render.yaml`).
