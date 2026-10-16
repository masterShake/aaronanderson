# Figures

How a drawing gets from a typed graph to the page. Read this before building a figure lane's
`src/figures/<id>/**`, `src/drawings/views/<id>.ts` or `drawing.server.ts`.

## The pipeline

```
graph (src/drawings/graphs/*.ts)       typed nodes, ports, routes, people, label keys; no strings
  │  applyView(graph, view)            a figure's subset and positions (src/drawings/views/*.ts)
  ├─ lib/route.ts   routeGraph()       right-angle routes in the channels, 12-unit bends, ports
  ├─ render/graph.ts graphDoc()        pencil layer (roughjs, seeded) or CAD layer, as an SvgDoc
  ├─ lib/frame.ts   planFrame()        the hand-off frame; render/cad.ts frameNodes() draws it
  ├─ render/iso.ts  isoPrintDoc()      ModelSpec → iso print, faces back to front
  ├─ render/table.ts tableRows()       the table alternative, as data
  └─ lib/counts.ts  counts()           every number the copy shows
render/index.ts graphBuilder()          → DrawingBuilder: {family}.json + {family}.{rev}.still.svg
render/index.ts docsBuilder()           the same files from any SvgDoc factory (not graph-shaped)
```

- **Isomorphic** (`lib/**`, `symbols/**`, `kit/**`, `graphs/**`): no roughjs, no DOM, no three.
  The scenes import `lib/frame.ts` and `lib/iso.ts`.
- **Server or build time only** (`render/**`): roughjs runs here. The lint fence bans
  `roughjs`, `@/drawings/render` and `@/drawings/files` in `*.client.*` files.
- **Deterministic:** every roughjs call gets a fresh options object with a fixed non-zero seed
  (`seedFrom(figure:element)`, FNV-1a). Rendering the same graph twice is byte-identical
  (unit test).

## Delivery

- Only the hero is inline: `<InlineDrawing doc tall />` renders one HTML-level `<svg>` per layer.
- Everything else is served by the prerendered `/drawings/[file]` route (●), from each figure's
  `drawing.server.ts`:
  - `{figure}.{family}.json`: a `DrawingBundle`, one markup string per layer;
  - `{figure}.{family}.{state}.still.svg`: a baked still for `<img loading=lazy>` and
    `<noscript>`.
- A figure lane's `drawing.server.ts` is usually one line:

  ```ts
  import 'server-only'
  import { graphBuilder } from '@/drawings/render'
  export const drawing = graphBuilder(myGraph, [
    { rev: 'asFound', medium: 'pencil', ground: 'paper' },
    { rev: 'rewired', medium: 'cad', ground: 'deep', ghost: 0.22 },
  ])
  ```

  The firm's is `export { firmDrawing as drawing } from '@/drawings/render/firm'`.

- A figure that is not graph-shaped (S-05, the strata, the org chart) uses `docsBuilder()` with
  its own SvgDoc factory instead of copying the build and bake logic:

  ```ts
  import 'server-only'
  import { docsBuilder } from '@/drawings/render'
  export const drawing = docsBuilder(
    (family, rev) => myDoc(family, rev), // SvgDoc: same viewBox per family, groups tagged rev
    [
      { rev: 'empty', ground: 'paper' },
      { rev: 'filled', ground: 'paper', ghost: 0.22 },
    ],
    ['wide', 'tall'], // optional; the default
  )
  ```

  ```ts
  function docsBuilder(
    make: (family: LayoutId, rev: string) => SvgDoc,
    states: readonly DocStateSpec[],
    families?: readonly LayoutId[], // default ['wide', 'tall']
  ): DocsBuilder // DrawingBuilder & { doc(family, rev): SvgDoc }
  ```

  `DocStateSpec` is `StateSpec` without `medium`
  (`{ rev, ground: 'paper' | 'deep', ghost? }`); `make` runs once per family and
  rev (cached; `builder.doc(family, rev)` returns the same doc). Files: `{family}.json` (every
  state's groups, merged per layer) and `{family}.{rev}.still.svg` (baked at `STILL_K[family]`;
  with `ghost`, the earlier states' layers are drawn under it at that opacity, per layer, so put
  ghosted states in a different layer from the current one). `graphBuilder(g, states, families?)`
  is `docsBuilder` over `graphDoc(g, rev, family, { medium })`, byte for byte.

- `<LazyDrawing src tallSrc stillSrc />` fetches the bundle for the family that fits when the
  figure is about one viewport away, injects the layers, and sets `data-layers="ready"` and
  `data-family`. On the still tier it fetches nothing. When the visitor turns motion back on
  (`ae:state`, tier still → svg) it loads the layers then, with no reload.

## Strokes and classes

- No `vector-effect` anywhere. No `<text>` in any SVG: labels are HTML.
- Every path carries `pathLength="1"`, `data-part`, `--i` (stagger) and `--len` (user units).
- Classes (`lib/svg-string.ts`), styled by `FigureFrame.module.css`:

  | Class             | Meaning                                                                              |
  | ----------------- | ------------------------------------------------------------------------------------ |
  | `p-018` … `p-100` | `stroke-width: calc(var(--pen-*) * var(--k))`                                        |
  | `i-{ink}`         | stroke color: pencil, graphite, cad, cyan, cyan-dim, redline, orange, asphalt, paper |
  | `f-{ink}`         | fill: paper, panel, deep, cyan, cyan-dim, orange, alu-100/300/500                    |
  | `draw`            | draw-on path: `stroke-dasharray: 1 2`; animate `stroke-dashoffset` 1 → 0             |
  | `d-{dash}`        | dash pattern in CSS px × `--k`, divided by `--len`                                   |

- `--k` is user units per CSS px, set by container queries on `.box` (wide viewBoxes are 960
  wide, tall ones 400). The family switches at the figure's minimum width: 520 px for the hero,
  440 px for services, 560 px for the rest (`data-fam-min` on the figure).
- Each drawing element is a `<g data-part="{id}">` under `<g data-layer data-rev>`, so a figure
  can highlight what a node touches.

## Iso maths (shared with the rig)

`lib/iso.ts` takes its angles from `SCENE` in `src/styles/tokens.ts` (no literal angles). Plan
SVG `(x, y)` is world `(x, 0, y)`; a part's height is world `+Y`. `isoBasis()` returns
`b` (toward the camera), `r = up × b` and `u = b × r`, as `OrthoRig` builds them.
`fitIso(vb, cssW, cssH, bounds, pad = SCENE.padding)` returns `{ s, zoom, target, hw, hh }`:
`zoom` is the rig's end-pose `z1` and `target` its recentred `t1`. `isoToViewBox(w, vb, fit)`
places a world point in the plan's viewBox at the end pose, which is how the iso print lines up
with the 3D end frame. The stage lane's parity test compares these with `runtime/kit/rig.ts`.

## FigureFrame

`<FigureFrame>` writes the figure DOM contract (`src/figures/types.ts`, Appendix B §B5):

```
figure#fig-{id}.fig[data-figure data-phase data-medium data-stage data-view data-labels
                    data-family data-fam-min data-run …]
  .strip > p#…-title · [data-rev-chip] · .controls (Replay, Play the drawing, MotionSwitch, extra)
  .box (fixed aspect)
    .drawing[aria-hidden] > svg.l-panel … svg.l-iso
    .scan-bar · .slot[data-stage-slot] > canvas.still · .labels[aria-hidden] · .ui
    .still-wrap > img.still-img
  figcaption · details (table) · #…-desc.sr-only · p[data-live][aria-live=polite]
```

`.box > .drawing` is a stacking context (`z-index: 0`): the layer z-indexes (panel 0, pencil and
ghost 1, CAD and iso 2, packets 3) order the layers inside it only, and the whole drawing sits
under the stage canvas (`.slot`), `.labels` and `.ui`. Never give a layer a z-index to lift it
over the canvas.

Extra props beyond the contract: `textVars` (graph counts for the caption and long description)
and `famMin`.

Labels (children of `.labels`) are positioned by their top-left corner:

- `--lx/--ly` (wide) and `--lxt/--lyt` (tall) are **percent numbers 0–100** of the box, unitless
  (`--lx: 12.5` means 12.5%); CSS multiplies them by `1%`. Write them with a `pct()` helper, never
  as fractions 0–1 and never with a `%` sign.
- `--ix/--iy` are written by the Stage on `[data-anchor="key"]` labels while
  `data-labels="iso"`, already as percentages (`'12.345%'`), and used as they are. The Stage also
  sets `data-hidden` on an anchor the scene reports as not visible; CSS hides it in iso mode.
- `src/styles/figures.css` and `FigureFrame.module.css` both follow this; the iso rule wins over
  the tall-family rules.

## Symbols and people

- `symbols/library.ts`: tool, conduit (flanged ends), flange, hand-carry (arrowhead and paper
  glyph), packet, AI reader (housing, lens, reticle, orange ring), HV valve (bow-tie body with
  end flanges, bonnet, stem, spoked handwheel), tolerance gauge (bezel, ticks, band, needle on
  a hub), data tank (head seams, nozzle, sight glass on fittings, level), monitor (bezel,
  ticks, needle), revision and HOLD clouds, Δ tag, detail bubble. Each is geometry only;
  `partsNodes(parts, { variant: 'clean' | 'pencil' })` draws either variant. W4 changed how
  they look, never their extents or anchors.
- `symbols/people.ts`: architect's scale figures (entourage) on one body (40 × 72 artboard,
  feet at y = 72), varied only by joint angles: standing, carrying paper, at the valve, at a
  desk with a stamp, walking, survey, receive, tablet, phone, and hard-hat variants. Eight
  heads tall; each limb is one closed outline (no joint seams); filled paper under a clean
  `p-035` outline (`f-tint`, an opaque light tint of the panel, is available for a toned
  silhouette). People parts carry `clean: true`, so
  the pencil renderer draws them clean too: one style in pencil, CAD and on the iso sheet.
  40 u tall in firm drawings. No walk cycles.
- `placeSymbol(id, at, { k })` places a symbol (people by their feet).

### Tool glyphs (opt in)

A tool box can show what it is: an envelope (`inbox`), a spreadsheet grid (`sheet`), a phone
(`phone`), a ledger (`ledger`), a chart sheet (`chart`), a card file (`cards`), Gantt bars
(`gantt`), a folder (`folder`), a clock (`timesheet`) or a pay slip (`payroll`). Glyphs are
drawn as outlines with fine rules (never solid bars), and never change a box's size.

- Graphs: set `tool: ToolKind` on a node, and pass `glyphs` to `graphDoc` (or through your own
  call):

  ```ts
  graphDoc(g, rev, family, { medium: 'cad', glyphs: true }) // each node's own `tool`
  graphDoc(g, rev, family, { medium: 'cad', glyphs: 'auto' }) // also infer from id or label key
  graphDoc(g, rev, family, { glyphs: 'auto', glyphPlace: 'corner' }) // 'right' | 'center' | 'corner'
  ```

  Default is off (today's bare boxes). `'right'` (default) sits beside a left-aligned label;
  check your longest label at the family's minimum width with `labelCollisions` before
  turning it on. `toolKindOf(id, labelKey)` shows what `'auto'` picks.

- Anything else: `toolPrims(rect, kind, place)` returns `{ box, outline, rules }`; draw `box`
  with the outline pen (`050` CAD, `035` pencil), `outline` with `035` (`025` pencil, preset
  `detail`) and `rules` with `018`. `toolParts(kind)` gives the same as symbol parts
  (180 × 64, like `sym.tool`).
- CAD conduits get a flange pair 7 u in from each end (`flanges: false` turns it off).

### Pens

Three weights, used the same way everywhere: outlines `050` (conduits `070`), details `035`,
hatch, rules, dimension and leader lines `018`/`025`. Pencil uses `035` for outlines and `025`
for details. Pencil presets `box`, `line` and `detail` draw one confident stroke per straight,
overshooting corners slightly and easing the bow off on long runs.

### Labels: reveal rule and collision check

- **Reveal:** add `data-reveal` to a label and give it the moment its object is drawn:
  `--reveal-at` (scroll progress 0–1, compared with `--p`) or `--reveal-ms` (ms into the play,
  for time-driven figures). The label fades in over 4% of the scrub, or 240 ms after that
  moment. Still tier, reduced motion and a finished time-driven play show every label.
- **Collisions:** `lib/collide.ts` `labelCollisions({ labels, edges, frame }, { pad })` returns
  every label/label, label/edge and label/frame overlap. Labels are boxes
  `{ id, x, y, w, h, owner? }` (`owner`: the edge id of the object the label sits inside);
  edges come from `edgesOf(id, prims)` or DOM rects. Use one coordinate space (viewBox units,
  or CSS px from `getBoundingClientRect`). Pure, so it runs in unit tests and in Playwright.

### Title strip

The title is one line at any width: `detail · title`, then the tag as a small square stamp
(`[data-stamp]`), then the rev chip and the controls (which take a second row on narrow
figures rather than squeeze the title). When space runs out the stamp trims
first, the detail number leaves below 800 px (screen readers still hear it), and the name
truncates last. Keep tags short (`EXAMPLE`, `SAMPLE`).

## The example firm and the schematic

- `graphs/firm.ts`: ten tools, twelve hand-offs (each with `mode`), fourteen rewired routes
  (each with `replaces`), three monitor signal lines, four people. Label keys point into
  `src/content/figures/firm.ts`.
- `components/schematic/Schematic.tsx` (server) + `SchematicController.client.tsx`: tool buttons
  over the drawing, As found / Rewired toggle, callouts computed from the graph
  (`callout.ts`), roving tabindex, WCAG 1.4.13 behaviour, docked callouts on touch and narrow
  screens, and the table alternative. `FirmSchematic` wires it to the firm and its content.
- UI strings the schematic reads from `firmFigure.ui` are listed in
  `components/schematic/copy.ts` (`UI_KEYS`); a missing key shows as the key in preview.

## Small pieces

- `RevisionCloud` (static; no draw-on) and `KeyPlan` (a 120 × 75 baked SVG `<img>`, with
  `KEYPLAN_HIGHLIGHT` per sheet).

## The harness

`/kit/fig` (preview only) is the kit showcase: every scale figure, tool glyph and symbol in
pencil on paper and CAD on blueprint, plus a small iso print, each tile captioned with its id.

`/kit/fig/{FigureId}` (preview only; 404 in production) renders any figure on its own sheet.
Add `?tier=still|svg|webgl` and `?state={rev}`. The firm inlines its layers until
`src/figures/firm/drawing.server.ts` serves `firmDrawing`.

## Tests

- `src/drawings/render/__tests__/render.unit.spec.ts`: determinism, no text or vector-effect,
  rendered counts equal `counts(graph)`, the 104 × 36 px label floor, routing clearance, roughjs
  caps, frames and symbols. Set `DRAWINGS_DUMP=<dir>` to write the firm's files there.
- `src/drawings/render/__tests__/docs-builder.unit.spec.ts`: `docsBuilder()` files, bundles,
  ghosted stills, caching, and `graphBuilder()` equal to `docsBuilder()` over `graphDoc()`.
- `e2e/drawings.spec.ts`: schematic keyboard and 1.4.13 behaviour, the toggle, the table, no
  text in SVG, no layer requests on the still tier, layers after motion comes back on, every
  visible label inside the box (390 and 1280, both states), and screenshots into
  `$ARTIFACTS_DIR`.
