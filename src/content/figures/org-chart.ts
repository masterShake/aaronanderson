import type { FigureCopy } from '../types'

/** Figure copy, DETAIL 1 / G-02 (owner: home-about). The owning lane adds label keys as the drawing grows. */
export const orgChartFigure = {
  id: 'org-chart',
  detail: 'DETAIL 1 / G-02',
  title: 'ONE WIRE LONG',
  caption: 'The usual chain, and ours.',
  longDescription: [
    'The usual chain passes your question through four people before it reaches someone who can answer it. Ours is one wire: you talk to the person doing the work.',
  ],
  labels: {},
  controls: {},
} satisfies FigureCopy
