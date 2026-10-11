import type { FigureCopy } from '../types'

/** Figure copy, DETAIL 1 / G-03 (owner: contact). The owning lane adds label keys as the drawing grows. */
export const afterContactFigure = {
  id: 'after-contact',
  detail: 'DETAIL 1 / G-03',
  title: 'AFTER YOU REACH OUT',
  caption: 'Four steps from your message to a written next step.',
  longDescription: [
    'Four nodes in a line: you book or write, we reply, we talk, and you get a short written next step.',
  ],
  labels: {},
  controls: {},
} satisfies FigureCopy
