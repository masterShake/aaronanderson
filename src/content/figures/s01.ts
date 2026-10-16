import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-01 Systems Survey, DETAIL 1 / S-01 (owner: svc-a). SVG only. Tool label keys follow
 * the firm graph. Render-time vars: {tools}, {handoffs}, {bottlenecks} from counts(graph);
 * {k} per tool in ui.toolTag; {n} for roadmap ticks. No hand notes (W4 finish standard
 * A4). The title strip's tag marks the whole figure, ranked list included, as an example.
 */
export const s01Figure = {
  id: 's01',
  detail: 'DETAIL 1 / S-01',
  title: 'THE SURVEY',
  tag: site.exampleTag,
  caption: 'A survey walks every hand-off and marks where someone retypes, chases or waits.',
  longDescription: [
    'A surveyor maps {tools:word} tools and {handoffs:word} hand-offs, marks the {bottlenecks:word} worst bottlenecks, and turns them into a ranked list and a 90-day roadmap.',
  ],
  labels: {
    'tool.inbox': 'Inbox',
    'tool.estimate': 'Estimate_FINAL_v7.xlsx',
    'tool.pm': 'Project management',
    'tool.accounting': 'Accounting',
    'tool.payroll': 'Payroll and HR',
    'tool.timesheets': 'Timesheets',
    'tool.drive': 'Shared drive',
    'tool.field': 'Field phones',
    'cloud.1': 'Δ1',
    'cloud.2': 'Δ2',
    'cloud.3': 'Δ3',
    instrument: 'SURVEY',
  },
  controls: { replay: 'Replay', playDrawing: 'Play the drawing' },
  ui: {
    toolTag: '{k} BY HAND',
    listTitle: 'WHAT TO FIX FIRST',
    effort: 'EFFORT',
    payoff: 'PAYOFF',
    small: 'SMALL',
    medium: 'MEDIUM',
    large: 'LARGE',
    'item.1': 'Delivery tickets read into accounting',
    'item.2': 'RFIs routed between site and office',
    'item.3': "Owner's report built from one data store",
    roadmap: '90-DAY ROADMAP',
    dayTick: '{n}',
    days: 'DAYS',
  },
} satisfies FigureCopy
