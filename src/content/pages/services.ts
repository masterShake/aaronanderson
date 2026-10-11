import { confirm } from '../hold'
import type { ServicesPageContent } from '../types'

/** Services, sheet S-00. The six sheets themselves live in ../services.ts. */
export const servicesPage: ServicesPageContent = {
  h1: 'Services, drawn to scale.',
  deck: 'Six fixed-scope services, numbered like a drawing set. Each sheet says what it does, what you get and how long it takes.',
  schedule: {
    id: 'schedule',
    h2: 'The schedule, before the details.',
    caption: 'Services schedule',
    columns: {
      sheet: 'Sheet',
      service: 'Service',
      length: 'Typical length',
      pricing: 'Pricing',
      pairedWith: 'Often paired with',
    },
    chart: {
      caption: 'Typical lengths. Yours is agreed before work starts.',
      unit: 'WEEKS',
      sessions: 'SESSIONS',
      monthly: 'MONTHLY →',
    },
    quoted: 'Quoted after the first call',
  },
  rail: { label: 'Service sheets', jump: 'Jump to a sheet' },
  sheet: {
    examples: 'Real examples',
    receive: 'You receive',
    receiveColumns: ['Item', 'Notes'],
    shape: 'Engagement shape',
    plainTerms: 'In plain terms:',
    talk: { text: 'Talk about {sheet} →', vars: {} },
    keyPlan: 'Where this sits in the firm',
  },
  nic: {
    id: 'nic',
    h2: 'Not in contract.',
    items: [
      confirm("We don't resell software licenses.", { id: 'nic.licenses' }),
      confirm("We don't rip out systems that work.", { id: 'nic.ripOut' }),
      confirm("We don't build anything we can't explain to the person who'll use it.", {
        id: 'nic.explain',
      }),
    ],
  },
  closing: {
    id: 'call',
    h2: "Not sure which sheet you need? That's what the call is for.",
    body: "Tell us where the retyping hurts most. If the answer is everywhere, we'll probably suggest S-01 first.",
  },
}
