import type { FigureCopy } from '../types'

/**
 * The 404 figure (owner: howcontact). Static: a revision cloud around an
 * empty sheet frame and its title block, the sheet number left blank. No hand
 * notes (the W4 finish standard keeps them to the hero and the firm schematic).
 */
export const notFoundFigure = {
  id: 'not-found',
  detail: 'DETAIL 1',
  title: 'MISSING SHEET',
  caption: 'A revision cloud around an empty frame.',
  longDescription: ['An empty sheet frame with a blank title block, ringed by a revision cloud.'],
  labels: {
    sheet: 'SHEET —',
  },
} satisfies FigureCopy
