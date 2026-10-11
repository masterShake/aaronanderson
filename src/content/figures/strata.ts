import type { FigureCopy } from '../types'

/**
 * The strata on About, DETAIL 1 / G-02 (owner: home-about): the first detail
 * on the sheet, so it takes number 1. Static. The layer annotations are HOLDs
 * in pages/about.ts (strata.layers). No hand notes.
 */
export const strataFigure = {
  id: 'strata',
  detail: 'DETAIL 1 / G-02',
  title: 'SECTION THROUGH THE CREW',
  caption: 'Field, office and code, in section.',
  longDescription: [
    'A section cut through three layers of experience: field on the bottom, office in the middle, code on top.',
  ],
  labels: {
    section: 'SECTION A–A',
    field: 'FIELD',
    office: 'OFFICE',
    code: 'CODE',
  },
} satisfies FigureCopy
