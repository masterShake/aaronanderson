import type { FigureCopy } from '../types'

/**
 * The org chart on About, DETAIL 2 / G-02 (owner: home-about): it follows the
 * strata on the sheet. Toggles between the usual chain and ours. Hand notes: 1
 * of the site's 12.
 */
export const orgChartFigure = {
  id: 'org-chart',
  detail: 'DETAIL 2 / G-02',
  title: 'ONE WIRE LONG',
  caption: 'The usual chain, and ours.',
  longDescription: [
    'The usual chain: your question passes from an account manager to a project manager to an analyst before it reaches the person who builds it.',
    'Ours: one wire, from you straight to the people who build it.',
  ],
  labels: {
    you: 'YOU',
    account: 'ACCOUNT MANAGER',
    pm: 'PROJECT MANAGER',
    analyst: 'ANALYST',
    builder: 'THE PERSON WHO BUILDS IT',
    builders: 'THE PEOPLE WHO BUILD IT',
  },
  notes: {
    lost: 'Context lost',
  },
  revs: { chain: 'THE USUAL CHAIN', ours: 'OURS' },
  ui: {
    /** Accessible name of the two-button toggle (The usual chain / Ours, in pages/about.ts). */
    toggleLabel: 'Which org chart to show',
  },
} satisfies FigureCopy
