import type { FigureCopy } from '../types'

/** Figure copy, DETAIL 2 / P-00 (owner: how). The owning lane adds label keys as the drawing grows. */
export const valveFigure = {
  id: 'valve',
  detail: 'DETAIL 2 / P-00',
  title: 'THE SIGN-OFF VALVE',
  caption: 'Records pass a tolerance needle; one outside tolerance waits for a person.',
  longDescription: [
    'A detail of the sign-off valve. Records pass a tolerance needle, one outside tolerance is diverted to a person who approves it, and a log line prints.',
  ],
  labels: {},
  controls: {},
} satisfies FigureCopy
