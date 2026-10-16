import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-02 System Integration, DETAIL 2 / S-02 (owner: scenes-a). Render-time var
 * {places} counts the destinations from the drawing. No hand notes.
 */
export const s02Figure = {
  id: 's02',
  detail: 'DETAIL 2 / S-02',
  // short enough for the one-line strip at 360 with WCAG 1.4.12 spacing (kit FigureFrame)
  title: 'ONE LEAD, EVERYWHERE',
  tag: site.exampleTag,
  caption: 'Enter a lead once, and it reaches the estimate, the project and accounting.',
  longDescription: [
    'As found, a person carries a box of paper from the CRM to estimating.',
    'Rewired, conduits join the CRM to estimating, project management and accounting. One new lead fans out to all {places:word} at once.',
    'When a sync fails, an alert goes out and the connection is fixed.',
  ],
  labels: {
    'tool.crm': 'CRM',
    'tool.estimate': 'Estimating',
    'tool.pm': 'Project management',
    'tool.accounting': 'Accounting',
    junction: 'JUNCTION',
  },
  revs: {
    asFound: 'REV 0 · AS FOUND',
    connected: 'REV 1 · CONNECTED',
    running: 'REV 2 · RUNNING',
    done: 'REV 3 · IDLE',
  },
  live: {
    done: 'Runs done. Each lead was entered once and arrived everywhere.',
  },
  controls: { replay: 'Replay', runAgain: 'Run again', playDrawing: 'Play the drawing' },
  ui: {
    lead: 'NEW LEAD',
    failed: 'SYNC FAILED → ALERT SENT',
    api: 'API: the socket a program offers so others can plug in',
    arrives: 'ENTERED ONCE → ARRIVES IN {places:word} PLACES',
  },
} satisfies FigureCopy
