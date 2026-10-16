import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-06 Run & Improve, DETAIL 6 / S-06 (owner: hero). Reuses the hero model and its label keys
 * (tool.*, sym.store); the names here are S-06's own short forms, so they fit on the boxes of
 * the iso print (the tall print is too small for them and hides them). The health card shows
 * labels only, never numbers. Render-time var {month} is the month tick index. No hand notes.
 */
export const s06Figure = {
  id: 's06',
  detail: 'DETAIL 6 / S-06',
  title: 'THE MONTHLY INSPECTION',
  tag: site.exampleTag,
  caption: 'Somebody minds the machine: failures caught, fixes shipped, a report each month.',
  longDescription: [
    "The rewired example firm under an inspection light: field phones, inbox, CRM, estimates, projects, accounting and the owner's report, joined through one data store.",
    'The light finds a failing joint where accounting feeds the data store, and it is fixed. As the months go by, a new instrument bolts on each month, and the gauge stays in range.',
  ],
  labels: {
    'tool.field': 'FIELD PHONES',
    'tool.inbox': 'INBOX',
    'tool.crm': 'CRM',
    'tool.estimate': 'ESTIMATES',
    'tool.pm': 'PROJECTS',
    'tool.accounting': 'ACCOUNTING',
    'tool.report': "OWNER'S REPORT",
    'sym.store': 'DATA STORE',
    inspection: 'MONTHLY INSPECTION',
    fixed: 'FIXED',
    'add.report': 'NEW REPORT',
    'add.alert': 'NEW ALERT',
    'add.automation': 'NEW AUTOMATION',
    months: 'MONTHS',
  },
  revs: {
    sketch: 'REV 0 · IN SERVICE',
    inspected: 'REV 1 · INSPECTED',
    improved: 'REV 2 · IMPROVED',
  },
  controls: { replay: 'Replay', runAgain: 'Run again', playDrawing: 'Play the drawing' },
  ui: {
    healthTitle: 'HEALTH REPORT',
    synced: 'SYNCS WATCHED',
    gauges: 'GAUGES IN RANGE',
    fixes: 'FIXES MADE',
    shipped: 'IMPROVEMENT SHIPPED',
    tick: '✓',
    month: 'MONTH {month}',
  },
} satisfies FigureCopy
