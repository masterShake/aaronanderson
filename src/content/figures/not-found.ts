import type { FigureCopy } from '../types'

/**
 * The 404 figure (owner: kit). Static: a revision cloud around an empty sheet
 * frame. Hand notes: 1 of the site's 12.
 */
export const notFoundFigure = {
  id: 'not-found',
  detail: 'DETAIL 1 / SHEET NOT FOUND',
  title: 'MISSING SHEET',
  caption: 'A revision cloud around an empty frame.',
  longDescription: ['An empty sheet frame, ringed by a revision cloud.'],
  labels: {
    sheet: 'SHEET —',
    tag: '?',
  },
  notes: {
    missing: 'Not in the set',
  },
} satisfies FigureCopy
