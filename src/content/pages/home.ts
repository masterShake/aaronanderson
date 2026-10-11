import { confirm } from '../hold'
import type { HomeContent } from '../types'

/** Home, sheet G-01 (cover sheet). */
export const home: HomeContent = {
  hero: {
    eyebrow: {
      full: 'G-01 · COVER SHEET · AI AUTOMATION FOR ENGINEERING, CONSTRUCTION AND HR TEAMS',
      short: 'G-01 · AI AUTOMATION FOR ENGINEERING, CONSTRUCTION AND HR TEAMS',
    },
    h1: 'Your company, wired to run itself.',
    signoff: '*You still sign off on anything that matters.',
    deck: 'We draw how work really moves through your firm, wire up the software you already pay for, and hand the paperwork to AI. Your people stop retyping and get back to the calls only they can make.',
    seeDrawing: { label: 'See the drawing ↓', href: '/#fig-hero' },
    specLine: 'FIXED SCOPE · SMALL SENIOR CREW · NO RIP-AND-REPLACE',
  },
  wiring: {
    id: 'wiring',
    h2: 'Right now, your people are the wiring.',
    body: [
      'Estimates live in a spreadsheet, jobs in the project software, costs in accounting. What connects them is a person with two windows open. Hover any tool to see what it touches, and how much of that happens by hand.',
    ],
    bodyTouch: 'Tap any tool to see what it touches, and how much of that happens by hand.',
    kicker: "When they're on holiday, so is your data.",
    newNote: '(E) your software stays. (N) we add the plumbing.',
  },
  sheetIndex: {
    id: 'sheets',
    h2: 'Six sheets. Start with the first.',
    caption: 'Services, numbered like a drawing set',
    columns: {
      sheet: 'Sheet',
      service: 'Service',
      walkAway: 'What you walk away with',
      length: 'Typical length',
    },
    startHere: 'START HERE',
  },
  process: {
    id: 'process',
    h2: 'Weeks, not quarters.',
    body: [
      'Five steps, each with a fixed scope and a stated length.',
      confirm("Nothing gets built until you've seen the drawing and agreed the price.", {
        id: 'claim.home.process',
      }),
    ],
    youPrefix: 'You:',
    link: { label: 'How it works, step by step →', href: '/how-it-works' },
  },
  crew: {
    id: 'crew',
    h2: 'The person on the call is the person on the tools.',
    body: [
      'A small crew with backgrounds in engineering, construction and software. No account managers and no junior bench: whoever scopes your project builds it.',
    ],
    approvedBy: { label: 'APPROVED BY', value: 'YOU' },
    link: { label: 'Meet the crew →', href: '/about' },
  },
  asBuilts: {
    id: 'as-builts',
    h2: 'As-builts: finished work, on the record.',
    body: [
      'We only publish projects a client has agreed to put their name to, with their real numbers.',
    ],
  },
  closing: {
    id: 'call',
    h2: 'Bring us the messy version.',
    body: {
      text: "A {callLength} call with the people who'd build it. Show us where the retyping happens, and we'll tell you what we'd wire first.",
      vars: {},
    },
  },
}
