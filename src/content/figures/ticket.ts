import type { FigureCopy } from '../types'
import { site } from '../site'

/** Figure copy, DETAIL 1 / P-00 (owner: how). The owning lane adds label keys as the drawing grows. */
export const ticketFigure = {
  id: 'ticket',
  detail: 'DETAIL 1 / P-00',
  title: 'ONE DELIVERY TICKET',
  tag: site.exampleTag,
  caption: 'One supplier delivery ticket, from the truck to the job-cost report.',
  longDescription: [
    'A delivery ticket travels from the truck to the job-cost report. Each step redraws its route, from photographed and retyped to read, matched and approved.',
  ],
  labels: {},
  controls: {},
} satisfies FigureCopy
