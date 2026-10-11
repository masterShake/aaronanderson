import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 3 / S-03 (owner: scenes-b). The owning lane adds label keys as the drawing grows. */
export const s03Figure = {
  id: 's03',
  detail: 'DETAIL 3 / S-03',
  title: 'THE READING MACHINE',
  tag: site.exampleTag,
  caption: 'Documents go in, labeled data comes out, and anything uncertain waits for a person.',
  longDescription: [
    'A section through a reading machine. Documents enter, labeled data cards leave, and a tolerance needle sends low-confidence items to the sign-off tray, where they wait for approval.',
  ],
  labels: {},
  controls: {
    replay: 'Replay',
    approve: 'Approve batch (demo)',
    runAnother: 'Run another batch (demo)',
  },
} satisfies FigureCopy
