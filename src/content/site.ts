import { hold } from './hold'
import type { SiteConfig } from './types'

/**
 * Site-wide copy and facts. next.config.ts reads this file (the booking link
 * feeds the CSP), so it imports only ./hold and types.
 *
 * Facts used inside sentences (callLength, replyTime) must read right with
 * their production fallback: "A {callLength} call" and "We reply {replyTime}."
 */
export const site: SiteConfig = {
  name: 'Actual Engineer',
  wordmark: 'ACTUAL ENGINEER',
  url: 'https://actualengineer.com',
  locale: 'en-US',
  legalName: hold('Legal entity name', {
    id: 'site.legalName',
    kind: 'name',
    prodFallback: 'Actual Engineer',
  }),
  email: hold('Public email address, e.g. hello@actualengineer.com', {
    id: 'site.email',
    kind: 'email',
    essential: true,
  }),
  phone: hold('Phone number (optional; hidden until filled)', { id: 'site.phone', kind: 'phone' }),
  location: hold('Where we work: city, region and whether we come to site', {
    id: 'site.location',
    kind: 'location',
  }),
  areaServed: [],
  sameAs: [],
  callLength: hold('Intro call length as an adjective, e.g. 30-minute', {
    id: 'site.callLength',
    kind: 'duration',
    essential: true,
    prodFallback: 'short',
  }),
  replyTime: hold('Reply-time promise, e.g. within one working day', {
    id: 'site.replyTime',
    kind: 'duration',
    prodFallback: 'by email',
  }),
  exampleTag: 'EXAMPLE FIRM — NOT A CLIENT',
  sampleTag: 'SAMPLE',
  scheduler: {
    url: hold('Cal.com booking link, e.g. https://cal.com/actualengineer/intro', {
      id: 'site.scheduler.url',
      kind: 'url',
      essential: true,
    }),
    autoload: false,
  },
  cta: { book: 'Book a call', href: '/contact#book' },
  nav: [
    { page: 'home', href: '/', label: 'Home', sheet: 'G-01', sheetTitle: 'Cover sheet' },
    {
      page: 'services',
      href: '/services',
      label: 'Services',
      sheet: 'S-00',
      sheetTitle: 'Sheets S-01 to S-06',
    },
    {
      page: 'how-it-works',
      href: '/how-it-works',
      label: 'How it works',
      sheet: 'P-00',
      sheetTitle: 'Phases P-01 to P-05',
    },
    {
      page: 'about',
      href: '/about',
      label: 'About',
      sheet: 'G-02',
      sheetTitle: 'Project directory',
    },
    {
      page: 'contact',
      href: '/contact',
      label: 'Contact',
      sheet: 'G-03',
      sheetTitle: 'Request for information',
    },
  ],
  header: {
    navLabel: 'Sheets',
    menu: 'Menu',
    menuTitle: 'Sheets in this set',
    close: 'Close',
    home: 'Actual Engineer, home',
  },
  skipLink: 'Skip to content',
  // short: the header's visible words where the bar is tight; the full label stays the name.
  motion: { label: 'Pause motion', short: 'Pause', on: 'Motion on', off: 'Motion paused' },
  sheet: { label: 'SHEET', scale: 'SCALE: AS NOTED' },
  marks: {
    hold: 'HOLD',
    confirm: 'CONFIRM',
    holdLabel: 'Still to come:',
    confirmLabel: 'Waiting for the owner to confirm:',
  },
  titleBlock: {
    sheetIndex: 'SHEET INDEX',
    drawnBy: {
      label: 'DRAWN BY',
      value: hold('Founder name (drawn by)', {
        id: 'site.drawnBy',
        kind: 'name',
        prodFallback: 'The crew',
      }),
    },
    checkedBy: {
      label: 'CHECKED BY',
      value: hold('Founder name (checked by)', {
        id: 'site.checkedBy',
        kind: 'name',
        prodFallback: 'The crew',
      }),
    },
    approvedBy: { label: 'APPROVED BY', value: 'YOU' },
    revisions: {
      label: 'REVISIONS',
      columns: ['REV', 'DATE', 'CHANGE'],
      rows: [{ rev: 'REV 0', date: '2026-10', note: 'First issue' }],
    },
    labels: { email: 'EMAIL', phone: 'PHONE', location: 'LOCATION', motion: 'MOTION' },
    notes: {
      title: 'GENERAL NOTES',
      items: [
        'Every company drawing on this site is an example, not a client.',
        'Demo data is marked SAMPLE. We never invent numbers, clients or quotes.',
        'Anything not yet confirmed is left off this site.',
      ],
    },
    northArrow: 'Back to top',
    copyright: '© {year} Actual Engineer',
  },
}
