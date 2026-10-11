import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-06 Run & Improve, DETAIL 6 / S-06 (owner: hero). Reuses the hero model.
 * The health card shows labels only, never numbers. Render-time var {month}
 * is the month tick index. No hand notes.
 */
export const s06Figure = {
  id: 's06',
  detail: 'DETAIL 6 / S-06',
  title: 'THE MONTHLY INSPECTION',
  tag: site.exampleTag,
  caption: 'Somebody minds the machine: failures caught, fixes shipped, a report each month.',
  longDescription: [
    'The rewired example firm under an inspection light.',
    'A failing connection is found and fixed. As the months go by, a new instrument bolts on each month, and the gauges stay in range.',
  ],
  labels: {
    inspection: 'MONTHLY INSPECTION',
    fixed: 'FIXED',
    gauge: 'IN RANGE',
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
    synced: 'SYNCS WATCHED ✓',
    fixes: 'FIXES MADE ✓',
    shipped: 'IMPROVEMENT SHIPPED ✓',
    month: 'MONTH {month}',
  },
} satisfies FigureCopy
