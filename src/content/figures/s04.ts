import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 4 / S-04 (owner: scenes-a). The owning lane adds label keys as the drawing grows. */
export const s04Figure = {
  id: 's04',
  detail: 'DETAIL 4 / S-04',
  title: 'ONE TANK, EVERY REPORT',
  tag: site.exampleTag,
  caption: 'Every system drains into one tank, so every report reads the same numbers.',
  longDescription: [
    'Tiles lock into place over a data tank, and an instrument panel reads the tank. Dials show low, in range or check; questions get sample answers.',
  ],
  labels: {},
  controls: { replay: 'Replay', ask: 'Ask' },
} satisfies FigureCopy
