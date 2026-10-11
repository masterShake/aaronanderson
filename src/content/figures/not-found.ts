import type { FigureCopy } from '../types'

/** Figure copy, DETAIL 1 / 404 (owner: kit). The owning lane adds label keys as the drawing grows. */
export const notFoundFigure = {
  id: 'not-found',
  detail: 'DETAIL 1 / SHEET NOT FOUND',
  title: 'MISSING SHEET',
  caption: 'A revision cloud around an empty frame.',
  longDescription: ['An empty sheet frame ringed by a revision cloud.'],
  labels: {},
  controls: {},
} satisfies FigureCopy
