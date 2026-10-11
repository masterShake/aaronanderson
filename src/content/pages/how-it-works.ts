import { confirm } from '../hold'
import type { HowItWorksContent } from '../types'

/** How It Works, sheet P-00. The steps live in ../process.ts. */
export const howItWorks: HowItWorksContent = {
  h1: 'Measure twice. Automate once.',
  deck: 'Our process as a short drawing set. Each step says what we do, what you do and how long it usually takes.',
  ticket: {
    id: 'ticket',
    h2: 'One delivery ticket, start to finish',
    body: [
      "To show what changes, we'll follow one piece of paper, a supplier's delivery ticket, from the truck to the job-cost report. Scale 1:1, more or less.",
    ],
  },
  spec: { weDo: 'We do', youDo: 'You do', howLong: 'How long', youGet: 'You get' },
  revTable: {
    caption: 'Revisions to the ticket drawing',
    columns: ['REV', 'STEP', 'CHANGE', 'APPROVED BY'],
  },
  control: {
    id: 'sign-off',
    h2: 'Where the machine stops and a person signs.',
    body: [
      confirm(
        'Anything that spends money, signs something or goes to a client waits at a sign-off valve for a person.',
        { id: 'claim.how.control' },
      ),
    ],
    plates: [
      {
        id: 'guard',
        title: 'GUARD',
        text: confirm('AI drafts. People decide.', { id: 'plate.guard' }),
      },
      {
        id: 'interlock',
        title: 'INTERLOCK',
        text: confirm('Inside its tolerance, work flows. Outside it, a person checks.', {
          id: 'plate.interlock',
        }),
      },
      {
        id: 'logbook',
        title: 'LOGBOOK',
        text: confirm('Every step the machine takes is written down where you can read it.', {
          id: 'plate.logbook',
        }),
      },
      {
        id: 'off-switch',
        title: 'OFF SWITCH',
        text: confirm('You can stop any automation at any time.', { id: 'plate.offSwitch' }),
      },
      {
        id: 'inspection',
        title: 'INSPECTION',
        text: confirm(
          'On Run & Improve, someone checks the machine every month and tells you what they found.',
          { id: 'plate.inspection' },
        ),
      },
    ],
  },
  legend: {
    id: 'legend',
    h2: 'Legend: our symbols and AI terms, in plain English.',
    symbolsCaption: 'Symbols',
    glossaryCaption: 'AI terms',
    columns: ['Symbol', 'Name', 'What it means'],
  },
  faq: {
    id: 'faq',
    h2: 'Questions people ask before they book.',
    logLabel: 'RFI LOG',
    open: 'OPEN',
    closed: 'ANSWERED',
  },
  closing: {
    id: 'call',
    h2: 'Step zero is a phone call.',
    body: {
      text: 'A {callLength} call, no slides. You describe the mess; we ask the awkward questions.',
      vars: {},
    },
  },
}
