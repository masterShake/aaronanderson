# Handoff: the house that builds itself

One-page site for **Aaron Anderson** (domain: actualengineer.com). Contractor of almost twenty years,
home builder and real estate agent, now an AI consultant. A single three.js scene builds a house across
five scroll-scrubbed chapters, each aimed at one audience.

| # | Chapter (`CHAPTERS` id) | Audience | Status |
|---|---|---|---|
| 01 | Architectural drawing (`architects`) | Architects | **Done**: the plan drafts itself |
| 02 | Foundation and framing (`construction`) | Construction companies | **Done**: the plan becomes a framed house |
| 03 | Roofing, electrical, plumbing (`trades`) | The trades | Copy + stub. **Next task** |
| 04 | Kitchen, contracted and finished (`contractors`) | Contractors | Copy + stub |
| 05 | Exterior, landscaping, for-sale sign (`agents`) | Real estate agents | Copy + stub |

## Commands and debug URLs

```bash
npm run dev            # :3120
npm run verify         # lint (0 warnings) → tsc → vitest → next build
npm run shots          # build first; screenshots of every stop → artifacts/shots (see script header)
```

- `?p=architects:0.42` deep-links to a point in the story. `?p=2.5` uses story time.
- `?debug` shows a HUD and exposes `window.__AE__`:
  - `info()`, `samplePixels()` and `project([x, y, z])` (a plan point → canvas CSS px and depth);
  - renderer, scene, camera, plan, timeline, house and `frame` (every framing member);
  - `chapters[i].debug`: chapter 2 exposes `schedule`, `framing` (the `FramePlan`), `layer` and `windows`.
- `?nowebgl` forces the static fallback.
- `/drawings/a-101.svg` is the finished plan as an SVG. It's the poster for no-WebGL and lost-context states, and the quickest way to eyeball geometry.

## Pipeline

```
HOUSE_NO_1 ─ validateHouse ─ resolveHouse ─┬─ planDrawing ─ draftTimeline ─ scene/chapters/architects
 (lib/house)                               └─ frameHouse ─ planFraming ─── scene/chapters/construction
native scroll → client/story.ts (story time s ∈ [0,5]) → scene/stage.ts: every chapter.update(clamp(s−i))
```

- `src/lib/**`: pure TypeScript (no three, React or DOM; lint enforces this). Everything is unit-tested.
- `src/scene/**`: three.js. It loads only through the lazy `import()` in `components/stage/StageMount.tsx`, so it stays out of the initial bundle (172 KB gz initial; stage chunk ≈190 KB gz).
- `src/components/**`: server components, except `StageMount` (no React state; it writes DOM attributes).
- Copy lives in `src/content/copy.ts`. Pacing lives in `src/lib/draft/script.ts` (chapter 1) and `src/lib/framing/script.ts` (chapter 2).

## Units and coordinates (keep these)

- **Inches everywhere.** Authored values are multiples of 1/16″ (exact in floating point; the validator enforces it).
- **Plan space** is right-handed, Z up:
  - +X is east (screen right) and +Y is north (screen up).
  - The origin is the SW corner of the building line, i.e. the outside face of the exterior studs.
  - z = 0 is the top of the subfloor.
  - The front of the house faces south.
- **World space:** `houseRoot.rotation.x = −π/2` with no scale, so plan (x, y, z) maps to world (x, z, −y). Build all geometry in plan inches under `ctx.root`. Only the camera thinks in world space.
- **Walls** are stud-coordinate rectangles (`Wall.rect` is the exact bottom-plate footprint). **Rooms and fixtures** are finished rectangles (stud face ± ½″ GWB).
- **Wall frame** (from `resolveHouse`):
  - `s` runs along the wall's axis from `s0` to `s1`, and `t` runs across it from `t0` to `t1`.
  - `contacts`: `tee` means another wall lands mid-wall (backing needed); `corner` means it lands in the end zone; `butt` means this wall's end lands on another wall's face.
  - `openings`: rough-opening intervals `[s0, s1]`, plus `head` and `sill` heights.
  - `pieces`: the rect minus the ROs.
- **Datums:** plate 109⅛″ (9′ ceilings, 104⅝″ precut + 1½″ bottom plate + 3″ double top), grade −30″, porch deck −7½″, crawlspace foundation.

## House No. 1

- **Basics:** 48′×32′, 1,536 SF, 3 BR / 2 BA. Bedrooms open off one hall to the west. Both baths and the laundry back onto one 2x6 wet wall at x = 247. The great room and kitchen (with an 8′ island) are to the east. There's a 24′×6′ porch on the south, a 6:12 gable with the ridge east–west, and trusses at 24″.
- **Changing it:**
  1. Edit `src/lib/house/house-no-1.ts`.
  2. Run `npm test`. The validator checks ids, the 1/16″ grid, wall thickness against the assembly, joined wall ends, ROs ≥ 3″ from tees, header room, door swings against walls and fixtures, rooms, fixtures, and every IRC check.
  3. Look at `/drawings/a-101.svg`, then the shots.
- Everything downstream is derived: the drawing, dimensions, labels, code-check chips, copy facts and every framing member. Aaron's real house could replace this file.

## The frame (`lib/framing`, chapter 2)

- **`frameHouse(resolved): Frame`** derives every member from the spec: 1,044 members (1,029 wood, 15 concrete) in 50 assemblies. `assertFramable` throws on shapes this round can't frame. The tests run every invariant on House No. 1 and on a synthetic 24′×20′ house.
- **A member is an oriented box** in plan inches: centre `c`, grain axis `u`, width axis `v`, and `w = u × v` (boxes never mirror), with `size = [L, W, H]` along them. `kind`, `section`, `treated`, `wall`, `s` and `opening` say what it is.
- **Built as framed:**
  - Foundation: 8″ stem walls from grade (−30) to −11½, and 7 piers under a flush 3-ply 2x10 girder at y = 192. No footings (they'd sit below grade).
  - Floor: PT 2x6 sill, 2x10 rim, and 2x10 joists at 16″ from x = 0, running N–S in two bays (tops at −¾). Then a ¾″ OSB deck.
  - Walls: bottom plates are exactly chapter 1's poché pieces, plus one plate per window RO. Studs sit at 16″ from the building line (exterior) or from `s0` (interior). Kings, jacks, two-ply 2x12 exterior headers, flat interior headers, rough sills, cripples, then top plates and caps lapped at corners and tees.
  - Roof: 23 Fink trusses at 24″ plus 2 gable trusses with gable studs, and 2x4 rake ladders.
  - Porch: 6x6 posts on piers, a 6x8 beam, a 2x8 ledger and 2x6 rafters (3:12 shed). The porch floor and steps are left for chapter 5.
- **Assemblies:** `plates`, `floor`, `foundation`, `deck`, `wall/<id>`, `caps`, `truss/01…25`, `rake/w`, `rake/e` and `porch`.
  - Exterior walls are `tilt` assemblies: they're framed flat on the deck, then raised.
  - `tiltPose(m, tilt, θ)` gives θ = 0 standing and π/2 flat, hinged at the inner top edge of the bottom plate (z = 1½).
  - Bottom plates and caps aren't in the wall groups, so they don't ride the tilt.
- **`frame.datums`:** grade −30, stemTop −11½, sillTop −10, joistTop −¾, floor 0, plate 109⅛, heel 116.54, ridge 212.54.
- **`planFraming(frame, house)` → `{ schedule, plan }`:**
  - `schedule` holds each member's window, its seeded flight and the camera boxes.
  - `plan.pose(p, out)` writes column-major matrices and `[alpha, ai]` states, in draw order, into the lumber's instance buffers. It allocates nothing and keeps no state.
  - Members are sorted by start time, so the drawn instances are always a prefix.
- **Pacing and camera:** `lib/framing/script.ts` (`BLOCKS`, the windows, `SHOTS`, `CAMERA`, `quantize`, `paperSpace`, `groundAt`).
- **Look:** `lib/framing/look.ts` (albedos, edges, end grain, tones, sun, shadow). The sun's intensity is solved so a sunlit top renders at exactly its albedo, and no face ever clips to white.

## The stage contract (`scene/chapters/types.ts`)

- `update(p)` must set **every** property the chapter owns from `p` alone. The stage calls every chapter every frame with clamped progress, so results never depend on scroll history.
- Each property has exactly one owner.
- Never change troika layout props (`text`, `fontSize`, anchors) in `update`. Use `clipRect`, `color`, `scale` and `visible`.
- Camera:
  - Chapters publish `camera` keys (in their own progress) and named `shots`. The stage blends keys across chapters in story time: centre linearly, distance in log space.
  - A `Pose` is a target `(cx, cy, cz)` in plan inches, a `distance`, and `pitch`/`yaw` in radians, applied with `Euler(pitch, yaw, 0, 'YXZ')` (never singular). pitch −π/2 looks straight down; yaw 0 looks north and +yaw turns the view toward the west.
  - Chapter 1 uses `fov` 20, looking straight down (`fitBox`, `TOP_DOWN`). Its matrices are bit-identical to round 1's (`camera.test.ts` keeps the old rig as a reference).
  - 3/4 shots use `fitBox3(box, pitch, yaw, layout, pad)`, an exact perspective fit of a 3D box into `layout.frame`.
  - Shot names are global across chapters. Near and far sit at 0.25× and 4× the distance.
- `quantize(p)` (optional) is what reduced-motion users see. Chapter 1 snaps to one keyframe per copy block.
- Per-element fade: `ctx.fade.set(ctx.plan.index.get('wall:ext-s')!, k)` fades that element's ink and poché toward paper. Chapter 2 owns every texel.
- **Chapter 2 retires chapter 1's sheet** through the `Sheet` handle (`architects()` returns it), touching only properties chapter 1 never writes:
  - every `ctx.fade` texel;
  - `GridMaterial.fade` (1 = drawn, 0 = paper);
  - each label's troika `fillOpacity`;
  - `sheet.group.visible`.
  The story store writes `--paper-space` on the stage (from `paperSpace`), which fades the frame border and title strip only while the stage is live. The no-WebGL poster keeps its sheet.

**renderOrder bands** (all drawing materials are opaque, `depthWrite: false`, `toneMapped: false`):

| Band | Layer |
|---|---|
| −100 | grid |
| −95 | AI wash |
| −90 | poché and solid fills |
| −80 | setout |
| −75 | test-fit guide |
| −70 to −60 | fine, graphite and ink lines |
| −50 | cut walls |
| −40 | AI markup |
| transparent pass | troika labels |

Lumber draws after all of these, in the transparent pass: the ground shadow (−1), concrete (0), then wood (1). It writes depth, so it simply covers the plan. The labels draw after the lumber and are depth-tested, so they must be gone before the deck (top at z = 0) lands; chapter 2 hides the whole sheet first.

**Colour meaning:** black ink is the drawing; blue `#1f5bff` is AI at work. Wood and concrete are the only other colours (`lib/framing/look.ts`): a plank's edges draw in AI blue while it flies, then settle to wood. The palette lives in `lib/plan/pens.ts`, mirrored in `globals.css` (a test keeps them equal).

## Layout and scroll

- **Wide layout:** copy cards on the left, with the stage frame at `--frame-*` in `globals.css`.
- **Narrow layout:** the drawing band on top, cards below. On phones the band sits above the copy (`z-index`), so cards slide under it.
- **The canvas covers only the frame rect.** For a full-bleed chapter, enlarge `.canvasHost` and the camera rig still frames into `layout.frame` via lens shift.
- **Progress is measured where the cards stick:**
  - Each copy block (`data-block`, `data-span="p0 p1"`) maps its measured scroll range onto its span.
  - Copy stays in sync with the drawing however tall CSS makes a block.
  - Chapter heights are `track` values in `lib/story/chapters.ts`. Raise a chapter's track when you animate it.
  - Chapter 2's card spans come from `BLOCKS` in `lib/framing/script.ts`; chapters 3–5 still use `STUB_SPANS` in `Story.tsx`.

## Lint traps (React-Compiler rules are errors here)

- Never read `ref.current` during render. Never mutate state or hook return values. No `Math.random` or `Date.now` in render. No `setState` inside an effect body.
- That's why all animation lives in plain modules (`src/scene`, `src/client`) and React only mounts the stage.
- Dynamic `import()` isn't checked by `no-restricted-imports`. That lazy import is the one sanctioned path to three.

## Gotchas

- **`DraftLineMaterial` patches three's `LineMaterial` source by anchor string.** three is pinned (`save-exact`). After any upgrade, `npm test` fails loudly if an anchor moved.
- **In r187, call `LineSegmentsGeometry.setPositions` once per mesh.** Each call allocates a new GPU buffer.
- **troika:**
  - It reads `.ttf`/`.otf`/`.woff`, not woff2. Labels use the self-hosted `public/fonts/archivo/ArchivoCondensed-Medium.v1.otf` (OFL).
  - Any character outside `LABEL_CHARSET` makes troika fetch a fallback font from a CDN (a test guards this; `npm run shots` fails on third-party requests).
  - A future CSP needs `worker-src blob:`.
- **StrictMode double-mounts the stage in dev.** `createStage` makes a fresh canvas each time, and `dispose()` releases everything.
- **Colour accuracy:** `NoToneMapping` with sRGB output. Fades mix toward paper inside the shaders; there is no alpha blending, so caps never double up.
- **Sticky stage:** no ancestor of `.story` may use `overflow: hidden`.
- **Shadows:**
  - `PCFShadowMap`, because r187 removed `PCFSoftShadowMap` (it warns, and `npm run shots` fails on warnings).
  - The stage enables the shadow map before anything compiles, since it's part of every program key.
  - `autoUpdate` is off. `LumberLayer.commit()` sets `needsUpdate`, so the map re-renders only when the pose changes.
- **Never hide the lumber group or its lights.** Light counts are part of every program key, so toggling a light recompiles programs mid-scroll. The meshes hide themselves when nothing is drawn.
- **`compileAsync` never compiles `customDepthMaterial`.** `LumberLayer.warm()` compiles the shadow pass's depth program through a proxy mesh, before the reveal.
- **Lumber is transparent and writes depth.** Members fade in with real alpha, so a white plank never punches a hole in placed lumber. Landed members have alpha 1 and draw first.
- **Pose updates are memoised** on the clamped progress. Chapters 1 and 3–5 cost nothing, and a resize or context restore marks the pose dirty.

## Chapter 3 brief (roofing, electrical, plumbing)

1. **Add a pure `lib/trades` model** with unit tests, in plan inches and derived from `ctx.frame`. Sheathing and roofing follow the members:
   - Wall sheathing on the exterior faces of the `wall/<id>` assemblies, cut around the ROs.
   - Roof sheathing on the truss top chords (6:12 main gable, 3:12 porch shed), then underlayment, shingles, ridge cap and drip edge.
   - Electrical: the panel, boxes on the studs (`kind === 'stud'` with its `wall` and `s`) and circuit runs.
   - Plumbing: supply and DWV on the 2x6 wet wall at x = 247 (both baths and the laundry), down through the floor frame into the crawlspace.
2. **Reuse the lumber renderer:** a new material `Look` in `look.ts` and more instances, or a second `LumberLayer`. Keep the shadow rules above.
3. **Camera:** start from chapter 2's hero pose (`hero`, dolly 0.96) and add keys and shots with `fitPoints`/`fitBox3`.
4. **Raise the `trades` track** in `lib/story/chapters.ts` and give it a script like `lib/framing/script.ts`, with its own `BLOCKS` in `Story.tsx`.

## Open items for the client

- `CONTACT.href` in `src/content/copy.ts` is a placeholder (`#contact`). Replace it with Aaron's email or booking link.
- The copy never calls Aaron an engineer, never says "Realtor", and shows no seal. Have the brand name *Actual Engineer* (the domain) checked against his state's engineering-title rules before it appears anywhere beyond the URL.
- House No. 1 is representative. Swapping in the house Aaron built only changes `house-no-1.ts`.
