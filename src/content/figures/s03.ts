import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-03 AI Workflow Automation, DETAIL 3 / S-03 (owner: scenes-b). The demo
 * batch holds at the sign-off tray until the visitor presses Approve.
 * Render-time vars {entered} and {held} come from the demo batch. Data cards
 * are tagged with site.sampleTag. No hand notes. The doc.* names show as the
 * DOCUMENTS IN label's second line while that document runs.
 */
export const s03Figure = {
  id: 's03',
  detail: 'DETAIL 3 / S-03',
  title: 'THE READING MACHINE',
  tag: site.exampleTag,
  caption: 'Documents go in, labeled data comes out, and anything uncertain waits for a person.',
  longDescription: [
    'A section through a reading machine. Documents enter the hopper, rollers feed them past an AI reader, and labeled data cards come out.',
    'A tolerance needle checks each one. A document below tolerance drops to the sign-off tray and waits there until a person approves it.',
  ],
  labels: {
    hopper: 'DOCUMENTS IN',
    reader: 'AI READER',
    'reader-sub': 'reads, never signs',
    tolerance: 'TOLERANCE',
    tray: 'SIGN-OFF',
    'tray-sub': 'a person decides (HV)',
    output: 'DATA OUT',
    section: 'SECTION A–A',
    'doc.invoice': 'INVOICE',
    'doc.ticket': 'DELIVERY TICKET',
    'doc.submittal': 'SUBMITTAL',
  },
  revs: {
    sketch: 'REV 0 · SKETCH',
    section: 'REV 1 · SECTION A–A',
    held: 'REV 2 · HELD FOR APPROVAL',
    approved: 'REV 3 · APPROVED',
  },
  live: {
    held: 'Held for approval: {held} below tolerance (sample).',
    approved: 'Approved by you. {entered} entered, {held} sent to a person (sample).',
  },
  controls: {
    replay: 'Replay',
    approve: 'Approve batch (demo)',
    runAnother: 'Run another batch (demo)',
    playDrawing: 'Play the drawing',
  },
  ui: {
    heldChip: 'HELD FOR APPROVAL',
    approvedChip: 'APPROVED BY YOU',
    runningChip: 'READING THE BATCH',
    waiting: 'Waiting for the batch to reach sign-off.',
    'card.vendor': 'VENDOR',
    'card.job': 'JOB',
    'card.amount': 'AMOUNT',
    'card.date': 'DATE',
    'log.entered': 'READ · MATCHED · ENTERED',
    'log.held': 'READ · BELOW TOLERANCE · SENT FOR SIGN-OFF',
    'log.approved': 'APPROVED BY YOU · ENTERED',
  },
} satisfies FigureCopy
