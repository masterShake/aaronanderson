import type { FigureCopy } from '../types'

/** Figure copy, DETAIL 5 / S-05 (owner: services). The owning lane adds label keys as the drawing grows. */
export const s05Figure = {
  id: 's05',
  detail: 'DETAIL 5 / S-05',
  title: 'THE CREW, TRAINED',
  caption: 'People stay paper: the crew gets the tools and the know-how.',
  longDescription: [
    'Figures in hard hats are handed tools, callouts explain each one, a new-hire walkthrough plays and a training record fills in.',
  ],
  labels: {},
  controls: { replay: 'Replay' },
} satisfies FigureCopy
