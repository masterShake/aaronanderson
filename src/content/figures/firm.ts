import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 2 / G-01 (owner: home-about). The owning lane adds label keys as the drawing grows. */
export const firmFigure = {
  id: 'firm',
  detail: 'DETAIL 2 / G-01',
  title: 'THE EXAMPLE FIRM',
  tag: site.exampleTag,
  caption: 'Ten tools and the hand-offs between them. Hover or tap a tool to see what it touches.',
  longDescription: [
    'An example firm drawn as a one-line diagram: ten tools, with the hand-offs between them marked as retyped, forwarded, exported or synced.',
  ],
  labels: {},
  controls: { showTable: 'Show as table', legend: 'Legend' },
} satisfies FigureCopy
