# Design system

The site is a drawing set. Every page is a sheet; the chrome is the title
block. This file is the map of the shared pieces. The live specimen sheet is
`/kit` (preview only: production returns 404, preview is noindex).

## Tokens (frozen)

`src/styles/tokens.css`, mirrored for SVG and three in `tokens.ts`. Never
declare new values for colors, `--dur-*`, `--ease-*`, `--flow-*`, `--pencil-*`
or `--gate-*` anywhere else: timing comes from `<style id="ae-timing">`
(`src/motion/timing`).

- **Color rules:** no green anywhere. Outside figures, orange means Book a
  call and nothing else (`Button variant="book"`, asphalt text, 4.92:1).
  Redline (`#B5400A`) is for problems and markups only; HOLD marks are
  graphite, never redline.
- **Radius 0. No soft shadows.** The only shadow is the CTA plate's hard
  offset edge.
- **Spacing:** page margins `--page-margin` (`clamp(16px, 4vw, 56px)`), section
  padding `--section-pad` (`clamp(48px, 6vw, 96px)`), max width 1440 (`.wrap`),
  8 px rhythm (`--s-*`), 4 / 8 / 12 columns (`.grid`).

## Global stylesheets (`src/styles`, kit lane)

| File                   | What it holds                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.css`             | Reset, paper ground, focus ring, `.wrap`, `.grid`, `.scroll`, `.band`, `.on-dark`, `.sr-only`, skip link, contrast and forced-colors basics |
| `type.css`             | H1–H3 (Big Shoulders, capitals, reserved `--lines` box), body ≤ 58ch, `.lead`, `.label`, `.sheet-strip`, `.ui-text`, `.hand`, `.numeral`    |
| `motion.css`           | Pause rules, the registered `--gate` and `--scan`, the CSS auto-start gate, still-tier rules, reduced motion, shared keyframes              |
| `figures.css`          | The figure DOM contract: layers, families, the `--k` tier table, pen and ink classes, progress windows, labels, scan bar                    |
| `view-transitions.css` | The sheet print transition                                                                                                                  |
| `print.css`            | Print base (the Services print sheet layers on top, owned by services)                                                                      |

### Focus

3 px ring with a 3 px offset (`--focus-w`, `--focus-offset`): asphalt on
paper, paper on dark. A dark surface adds the global class `on-dark` (or sets
`--c-focus: var(--c-focus-on-dark)`), which also flips HOLD ink (`--hold-c`)
and table lines. Buttons show CAD corner grips: four `--grip` squares at the
ring's corners on `:focus-visible`.

### Accessibility media

- `prefers-contrast: more`: thicker `--line-*`, figures at `--pen-scale: 1.5`,
  ghost layer, grid bubbles and column lines hidden, labels in asphalt.
- `forced-colors`: strokes in CanvasText, borders in ButtonText/CanvasText,
  packets and the scan bar hidden.

## Page state (read only)

The head script (`src/motion/head-script.ts`) is the only writer of
`html[data-js|data-rm|data-motion|data-tier|data-tier-force|data-tier-max]` and
of storage. CSS reads it:

- `html[data-motion=paused]`, `html:has(input[data-motion-switch]:checked)` and
  `[data-offscreen]` pause every animation, except inside `.fig[data-user-play]`.
- `html[data-tier=still]` (or `.fig[data-phase=still]`) shows `.box > .still`
  / `.box > .still-wrap` and hides `.drawing`, `.scan-bar` and `.slot`. The
  Stage's own `canvas.still` is never targeted. Turning motion back on lifts the
  tier to `svg`, so drawings return without a reload.
- Time-driven figures (`data-driver="time"`) wait for `data-armed`; below
  1024 px they also wait for `data-inview`. With no script, CSS releases them
  after `--gate-css-auto-start`. Animations read `animation-play-state: var(--gate)`.

## Figures (`figures.css`)

- **Families:** wide from a 560 px container (hero 520, service sheets 440),
  tall below. Layer `<svg>`s carry `data-family`; CSS hides the other family.
- **`--k` (user units per CSS px)**, set on `.box` by container width:
  wide 960: 440–519 → 2.0 · 520–559 → 1.78 · 560–619 → 1.6 · 620–739 → 1.4 ·
  740–879 → 1.18 · ≥ 880 → 1.02; tall 400: < 340 → 1.25 · 340–399 → 1.08 ·
  400–479 → 0.92 · ≥ 480 → 0.75.
- **Pens:** `.pen-018` … `.pen-100` set `stroke-width: calc(var(--pen-*) *
var(--k) * var(--pen-scale))`. **Inks:** `.ink-pencil`, `.ink-graphite`,
  `.ink-cad`, `.ink-cyan`, `.ink-cyan-dim`, `.ink-redline`, `.ink-orange`,
  `.ink-asphalt`, `.ink-paper`, `.ink-hold`. No `vector-effect` anywhere.
- **Draw-on:** `pathLength="1"` plus `.draw` (`stroke-dasharray: 1 2`). Time
  driver: `.fig[data-run] .draw.t` with `--t` (delay) and `--d` (duration).
  Progress driver: `.pv` with `--a`/`--b` windows on `--p`, easings
  `.e-machine`, `.e-pencil`, `.e-settle`, effects `.draw`, `.fade`, `.rise`, `.pop`.
- **Verbs (keyframes in `motion.css`):** `ae-draw`, `ae-pop`, `ae-scan`
  (`.scan-consumer`), `ae-erase`, `ae-flow` (`.flow`, offset-path),
  `ae-stamp`, `ae-fade`, `ae-release`. Every keyframe ends on the finished frame
  with fill `both`.
- **Labels:** an HTML overlay, left-anchored by `--lx/--ly` (tall `--lxt/--lyt`,
  iso `--ix/--iy`). Hand notes (`.note` or `.hand`) are capitals by CSS.

## View transitions

`SheetTransition` wraps each page in `<ViewTransition>`; `SheetLink` and the
nav add `sheet-forward` / `sheet-back` from reading order. The new sheet prints
left to right (`ae-vt-ltr`, back: `ae-vt-rtl`) over `--dur-sheet` with a 2 px
blueprint carriage edge. The header has no `view-transition-name`; the root
group has `animation: none`; `::view-transition` takes no pointer events; all
durations are 0 under reduced motion or while paused.

## Components

Props are frozen (W0); bodies are the kit lane's. Every visible string comes
in from `src/content` through props.

### Chrome (`src/components/chrome`)

| Component                                                     | Notes                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Header`                                                      | Sticky; 56 px (64 px from 1024). Desktop: wordmark and `SheetChip`, `NavLinks`, `MotionSwitch`, Book a call. Below 1024: wordmark, Book a call (one line, 44 px tall), Menu. Fits 360–1440 with no overflow |
| `NavLinks.client`                                             | Current sheet: `aria-current="page"` plus a dimension line with end ticks. Menu rows add sheet number and title; the first carries autofocus; picking one closes the menu                                   |
| `MenuDialog`                                                  | `<dialog popover="auto">` opened by `popovertarget`: works with JS off; Esc and light dismiss close it; focus returns to Menu; not modal (no trap)                                                          |
| `SheetChip.client`                                            | The current sheet number, boxed                                                                                                                                                                             |
| `Footer`                                                      | The title block (`on-dark`)                                                                                                                                                                                 |
| `SkipLink`, `SheetLink.client`, `SheetTransition`, `Wordmark` | Wordmark mark is a static isometric junction box                                                                                                                                                            |
| `ErrorSheet`                                                  | Shared body of `app/error.tsx` and `app/global-error.tsx`                                                                                                                                                   |

### UI (`src/components/ui`)

`Button` (book / secondary / text; ≥ 44 px; grips), `BookCallButton`,
`TextLink` (drawn ↗ for external), `MotionSwitch` (native checkbox,
`role=switch`, `data-motion-switch`, drawn as a switch; checked = paused),
`SegmentedToggle.client` (`aria-pressed`), `CopyEmail.client`, `Term.client`
(toggletip, WCAG 1.4.13: hoverable, persistent, Esc dismisses; words from the
legend), `RichText` (`[[term]]`, `{var}`, claims), `HeldText`, `Claimed` (the
CONFIRM mark goes inside a returned element), `VisuallyHidden`.

### HOLD and CONFIRM (preview only)

`HoldChip` (inline) and `HoldCloud` (block, photo hatched, logo, stat, quote):
dashed graphite with a HOLD tab, never redline. In production they render the
HOLD's `prodFallback` or nothing. `ConfirmMark`: dotted blueprint outline and a
CONFIRM tag; bare text in production.

### Blueprint (`src/components/blueprint`)

`PageHead` (the only H1; strip "SHEET S-00 · title · SCALE"; grid bubbles and
column lines), `SheetHeader` (title-block cells), `SheetTab` (stencil numeral
aria-hidden plus the real id), `SectionHead` (`{id}-title`), `SectionCut`,
`Callout` (note, machine, redline, detail-ref), `DimensionLine` (solid, range,
ticks, dots; tick or arrow ends; dashed extension), `DimensionChain`,
`ScaleBar`, `NorthArrow` (top, start-here), `Stamp` (−4°, asphalt or redline,
`live` = status), `SpecGrid`, `PunchList`, `Schedule` (real table; rows stack
under 640 px with `data-label`), `SheetIndexTable` (row links, START HERE),
`GeneralNotes`, `RevisionTable`, `LegendTable` (drawn glyphs; glossary entries
`#term-{id}`), `CtaBand` (asphalt plate, id `call`), `GridBubbles`.
`RevisionCloud` and `KeyPlan` belong to the drawings lane.

Wide tables sit in a `.scroll` region that is focusable (`tabindex=0`,
`role=region`, labelled by the caption), so keyboard users can scroll it.

## Type and layout shift

Headings reserve `calc(var(--lines) * 1lh)`. The display face swaps in over a
wider fallback, so the real fix is in `src/app/fonts.ts` (`display:
'optional'`, requested). Measured on `/` at 390 px, still tier, fonts delayed
1 s: CLS 0.042 without the patch, 0.015 with it.
