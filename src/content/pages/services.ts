import { confirm } from '../hold'
import type { ServicesPageContent } from '../types'

/** Services, sheet S-00. The six sheets themselves live in ../services.ts. */
export const servicesPage: ServicesPageContent = {
  h1: 'Services, drawn to scale.',
  deck: 'Six fixed-scope services, numbered like a drawing set. Each sheet says what it does, what you get and how long it takes, so nobody has to guess the scope.',
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
      caption: 'Typical lengths. Yours gets a fixed number before you sign.',
      unit: 'WEEKS',
      sessions: 'SESSIONS',
      monthly: 'MONTHLY →',
    },
    quoted: 'Fixed fee, quoted after the survey',
  },
  rail: { label: 'Sheets in this set', jump: 'Jump to a sheet' },
  sheet: {
    examples: 'Real examples',
    receive: 'You receive',
    receiveColumns: ['Item', 'Notes'],
    shape: 'Engagement shape',
    plainTerms: 'In plain terms',
    talk: { text: 'Talk about {sheet} →', vars: {} },
    keyPlan: 'Where this sits',
  },
  nic: {
    id: 'not-in-contract',
    h2: 'Not in contract.',
    items: [
      confirm('We do not replace software that works.', { id: 'nic.1' }),
      confirm('We do not sell licenses or take referral fees from vendors.', { id: 'nic.2' }),
      confirm('We do not let AI sign, pay or send anything on its own.', { id: 'nic.3' }),
    ],
  },
  closing: {
    id: 'call',
    h2: "Not sure which sheet you need? That's what the call is for.",
    body: "Tell us where the retyping hurts most. If the answer is everywhere, we'll probably suggest S-01 first.",
  },
}
