import type { FigureCopy } from '../types'

/**
 * The sign-off valve detail, DETAIL 2 / P-00 (owner: how). Plays once on
 * entry; the logbook lines print as each event happens. No hand notes.
 */
export const valveFigure = {
  id: 'valve',
  detail: 'DETAIL 2 / P-00',
  title: 'THE SIGN-OFF VALVE',
  caption: 'Records pass a tolerance needle. One outside tolerance waits for a person.',
  longDescription: [
    'Paperwork flows from left to right, past an AI reader and a tolerance dial, into the system of record.',
    'The first records pass inside tolerance and are filed. The next falls below the mark, is diverted to the sign-off valve, and rejoins the line once a person approves it. Each step is written in the logbook.',
  ],
  labels: {
    incoming: 'INCOMING PAPERWORK',
    record: 'SYSTEM OF RECORD',
    reader: 'AI READER',
    'reader-sub': 'reads, never signs',
    tolerance: 'TOLERANCE',
    inRange: 'IN RANGE',
    valve: 'SIGN-OFF',
    'valve-sub': 'a person decides (HV)',
    approved: 'APPROVED',
    logbook: 'LOGBOOK',
  },
  controls: { replay: 'Replay', playDrawing: 'Play the drawing' },
  ui: {
    'log.filed': 'READ · IN TOLERANCE · FILED',
    'log.held': 'READ · BELOW TOLERANCE · HELD FOR A PERSON',
    'log.approved': 'APPROVED BY A PERSON · FILED',
  },
} satisfies FigureCopy
