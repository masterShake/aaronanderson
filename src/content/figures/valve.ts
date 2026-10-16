import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * The sign-off detail, DETAIL 2 / P-00 (owner: howcontact). Plays once on
 * entry; the logbook lines print as each record is filed or held. The log
 * entries are sample data (stamped SAMPLE). No hand notes.
 */
export const valveFigure = {
  id: 'valve',
  detail: 'DETAIL 2 / P-00',
  title: 'SIGN-OFF VALVE',
  tag: site.sampleTag,
  caption: 'Records pass a tolerance gauge. One outside tolerance waits for a person.',
  longDescription: [
    'Paperwork flows from an in-tray, past an AI reader and a tolerance gauge, into the system of record.',
    'The first records read inside tolerance and are filed. The next falls outside it, is sent down a branch to the sign-off valve, and goes on only once a person approves it. Each step is written in the logbook.',
  ],
  labels: {
    incoming: 'INCOMING PAPERWORK',
    record: 'SYSTEM OF RECORD',
    reader: 'AI READER',
    'reader-sub': 'reads, never signs',
    tolerance: 'TOLERANCE',
    inRange: 'IN RANGE',
    valve: 'SIGN-OFF',
    'valve-sub': 'a person decides',
    approved: 'APPROVED',
    logbook: 'LOGBOOK',
  },
  // short, so the strip stays on one row on phones (W4b)
  controls: { replay: 'Replay', playDrawing: 'Play' },
  ui: {
    /** The logbook's opening line, printed with its header before any record passes. */
    'log.open': 'LINE OPEN',
    'log.filed': 'IN RANGE · FILED',
    'log.held': 'OUT OF RANGE · HELD',
    'log.approved': 'APPROVED · FILED',
  },
} satisfies FigureCopy
