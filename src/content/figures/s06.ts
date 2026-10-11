import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 6 / S-06 (owner: hero). The owning lane adds label keys as the drawing grows. */
export const s06Figure = {
  id: 's06',
  detail: 'DETAIL 6 / S-06',
  title: 'THE MONTHLY INSPECTION',
  tag: site.exampleTag,
  caption: 'Somebody minds the machine: failures caught, fixes shipped, a report each month.',
  longDescription: [
    'The example firm model under an inspection light. A failing flange is fixed, the months advance, and a new instrument bolts on each month.',
  ],
  labels: {},
  controls: { replay: 'Replay' },
} satisfies FigureCopy
