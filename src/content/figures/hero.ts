import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * Home hero figure, DETAIL 1 / G-01 (owner: hero lane). Label keys follow the
 * firm graph (src/drawings/graphs/firm.ts): tool.<ToolId>, sym.*, place.*.
 * Render-time vars in longDescription: {tools}, {lines}, {people} from
 * counts(graph) for the hero view. Hand notes: 3 of the site's 12, in the AS FOUND margins.
 */
export const heroFigure = {
  id: 'hero',
  detail: 'DETAIL 1 / G-01',
  title: 'A TYPICAL FIRM',
  tag: site.exampleTag,
  caption: 'How work moves through a typical firm, before and after the rewire.',
  longDescription: [
    'As found: {tools:word} tools drawn in pencil, joined by {lines:word} hand-carry lines, with {people:word} people standing on them, retyping the same records from one tool into the next.',
    'Rewired: a scan turns the sketch into a clean drawing. The people step off the lines. An AI reader sits on the ticket line, and a sign-off valve waits for a person.',
    "Running: records flow on their own. Every fourth one stops at the valve for a person to approve, the data store fills, and the owner's report prints itself.",
  ],
  labels: {
    'tool.field': 'Field phones',
    'tool.inbox': 'Inbox',
    'tool.crm': 'CRM',
    // the file name fits its name plate on one line at every size (it never wraps)
    'tool.estimate': 'Estimate.xlsx',
    'tool.pm': 'Project management',
    'tool.accounting': 'Accounting',
    'tool.report': "Owner's report",
    'sym.ai': 'AI reader',
    'sym.ai-sub': 'reads, never signs',
    'sym.valve': 'Sign-off',
    'sym.store': 'Data store',
    'place.estimating': 'Estimating',
    'place.site': 'On site',
  },
  notes: {
    estimate: 'Which one is current??',
    inbox: "Lives in someone's inbox",
    report: 'Copy-paste Mondays',
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
  ui: {
    /** Read after the REV 3 chip ("REV 3 · BATCH DONE"), on the idle drawing. */
    idle: 'Waiting for paperwork',
    inset: 'AS FOUND',
    leader: 'Rewired →',
    approved: 'APPROVED',
    runAgainHint: 'Runs the example machine for three more batches.',
  },
} satisfies FigureCopy
