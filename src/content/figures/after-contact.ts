import type { FigureCopy } from '../types'

/**
 * What happens after you reach out, DETAIL 1 / G-03 (owner: contact). The four
 * steps' sentences live in pages/contact.ts (next.steps); these are the short
 * node labels. ui holds the success drawing's strings. No hand notes.
 */
export const afterContactFigure = {
  id: 'after-contact',
  detail: 'DETAIL 1 / G-03',
  title: 'AFTER YOU REACH OUT',
  caption: 'Four steps from your message to a written next step.',
  longDescription: [
    'Four nodes in a line: you book or write, we reply, we talk, and you get a short written next step.',
  ],
  labels: {
    you: 'YOU BOOK OR WRITE',
    reply: 'WE REPLY',
    call: 'THE CALL',
    next: 'WRITTEN NEXT STEP',
  },
  ui: {
    ourNode: 'ACTUAL ENGINEER',
    theirNode: 'YOUR COMPANY',
    received: 'RECEIVED',
    sooner: 'Want to talk sooner? Book a call.',
  },
} satisfies FigureCopy
