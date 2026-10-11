# Figures

_Skeleton from W0; the drawings lane completes it._

- The figure DOM contract is in `src/figures/types.ts`; `FigureFrame` writes it.
- Only the hero drawing is inline. Every other drawing is served by the prerendered
  `/drawings/[file]` route (`src/drawings/files.ts`): `{figure}.{family}.json` layer bundles and
  `{figure}.{family}[.{state}].still.svg` stills.
- Strokes: no `vector-effect`; draw-on paths use `pathLength="1"`; width is pen × `--k`.
- `src/drawings/graphs/_fixture.ts` is the W0 render check and a test input.
