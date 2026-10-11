import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 2 / S-02 (owner: scenes-a). The owning lane adds label keys as the drawing grows. */
export const s02Figure = {
  id: 's02',
  detail: 'DETAIL 2 / S-02',
  title: 'ONE LEAD, THREE PLACES',
  tag: site.exampleTag,
  caption: 'Enter a lead once and it reaches the estimate, the project and accounting.',
  longDescription: [
    'Pencil boxes become conduits. One new lead fans out to three tools; when a sync fails, an alert goes out and it is fixed.',
  ],
  labels: {},
  controls: { replay: 'Replay' },
} satisfies FigureCopy
