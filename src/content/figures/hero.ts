import type { FigureCopy } from '../types'
import { site } from '../site'

/** Home hero figure, DETAIL 1 / G-01 (owner: hero lane). Labels follow the firm graph's keys. */
export const heroFigure = {
  id: 'hero',
  detail: 'DETAIL 1 / G-01',
  title: 'A TYPICAL FIRM',
  tag: site.exampleTag,
  caption: 'How work moves through a typical firm, before and after the rewire.',
  longDescription: [
    'As found: seven tools drawn in pencil, with people standing on the lines between them, retyping the same records from one tool into the next.',
    'Rewired: a scan turns the sketch into a clean drawing. The people step off the lines; an AI reader sits on the ticket line and a sign-off valve waits for a person.',
    "Running: records flow on their own. Every fourth one stops at the valve for a person to approve, the data tank fills, and the owner's report prints itself.",
  ],
  labels: {
    'tool.field': 'Field phones',
    'tool.inbox': 'Inbox',
    'tool.crm': 'CRM',
    'tool.estimate': 'Estimate_FINAL_v7.xlsx',
    'tool.pm': 'Project management',
    'tool.acct': 'Accounting',
    'tool.report': "Owner's report",
    'sym.ai': 'AI reader',
    'sym.ai-sub': 'reads, never signs',
    'sym.valve': 'Sign-off',
    'sym.valve-sub': 'a person decides',
    'place.estimating': 'Estimating',
    'place.site': 'On site',
  },
  notes: {
    current: 'Which one is current??',
    fridays: 'Retyped Fridays',
    inbox: "Lives in someone's inbox",
    office: 'Ask the office',
  },
  revs: {
    asFound: 'REV 0 · AS FOUND',
    rewired: 'REV 1 · REWIRED',
    running: 'REV 2 · RUNNING',
    done: 'REV 3 · BATCH DONE',
  },
  live: { done: 'Batch done. Waiting for paperwork.' },
  controls: {
    replay: 'Replay',
    runAgain: 'Run again',
    playDrawing: 'Play the drawing',
    pause: 'Pause motion',
  },
} satisfies FigureCopy
