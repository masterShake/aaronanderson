import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-04 Data & Dashboards, DETAIL 4 / S-04 (owner: scenes-a). Dials read words,
 * never numbers. The question chips write scripted SAMPLE answers into a
 * polite live region, instantly. Answers contain no digits. No hand notes.
 */
export const s04Figure = {
  id: 's04',
  detail: 'DETAIL 4 / S-04',
  title: 'ONE TANK, EVERY REPORT',
  tag: site.exampleTag,
  caption: 'Every system drains into one data store, so every report reads the same numbers.',
  longDescription: [
    'Reports from {tiles:word} systems lock into one grid over a single data store.',
    "An instrument panel reads the store. Its dials show low, in range or check, and the owner's report slides out on its own.",
    'The question buttons give sample answers built from the same store.',
  ],
  labels: {
    'tile.accounting': 'ACCOUNTING EXPORT',
    'tile.pm': 'PROJECT REPORT',
    'tile.timesheets': 'TIMESHEETS',
    'tile.estimate': 'ESTIMATE',
    'tile.payroll': 'PAYROLL',
    store: 'ONE DATA STORE',
    'store-sub': 'DATA',
    'dial.cost': 'JOB COST',
    'dial.schedule': 'SCHEDULE',
    'dial.hours': 'HOURS',
    report: "OWNER'S REPORT",
  },
  live: {
    done: 'Runs done. Every dial reads from the one data store.',
  },
  revs: {
    sketch: 'REV 0 · SCATTERED',
    locked: 'REV 1 · ONE STORE',
    running: 'REV 2 · LIVE',
    done: 'REV 3 · IDLE',
  },
  controls: {
    replay: 'Replay',
    runAgain: 'Run again',
    ask: 'Ask',
    playDrawing: 'Play the drawing',
  },
  ui: {
    low: 'LOW',
    inRange: 'IN RANGE',
    check: 'CHECK',
    chipsLabel: 'Ask the example firm a question',
    answerLabel: 'SAMPLE ANSWER',
    'q.project': 'Where are we on this project?',
    'a.project':
      'Sample: on schedule. Two change orders are waiting for sign-off, and job cost is in range.',
    'q.budget': 'Which jobs need a look?',
    'a.budget':
      'Sample: one job. Labor is running ahead of the estimate, and the weekly report has the details.',
    'q.hours': 'Whose timesheets are missing?',
    'a.hours':
      "Sample: the site crew hasn't sent this week's hours yet. Their supervisor has a reminder.",
  },
} satisfies FigureCopy
