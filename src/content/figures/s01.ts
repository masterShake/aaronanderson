import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 1 / S-01 (owner: services). The owning lane adds label keys as the drawing grows. */
export const s01Figure = {
  id: 's01',
  detail: 'DETAIL 1 / S-01',
  title: 'THE SURVEY',
  tag: site.exampleTag,
  caption: 'A survey walks every hand-off and marks where someone retypes, chases or waits.',
  longDescription: [
    'A surveyor sweeps the example firm, rings each problem in a revision cloud, and ranks what to fix first on a ninety-day roadmap.',
  ],
  labels: {},
  controls: { replay: 'Replay' },
} satisfies FigureCopy
