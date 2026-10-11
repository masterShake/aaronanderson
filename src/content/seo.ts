import type { SeoContent } from './types'

/** Titles, descriptions and OG text per page. Titles get ' · Actual Engineer' unless absolute. */
export const seo: SeoContent = {
  home: {
    title: 'Actual Engineer · AI automation for engineering, construction and HR teams',
    absolute: true,
    description:
      'We connect the software your firm already owns, pull your data into one picture and hand the retyping to AI, with people approving what matters.',
    og: {
      kicker: 'G-01 · COVER SHEET',
      title: 'Your company, wired to run itself.',
      alt: 'Actual Engineer cover sheet: your company, wired to run itself.',
    },
  },
  services: {
    title: 'Services',
    description:
      'Six fixed-scope services, from a two-week Systems Survey to monthly Run & Improve, each showing what you get and how long it takes.',
    og: {
      kicker: 'S-00 · SERVICES',
      title: 'Services, drawn to scale.',
      alt: 'Actual Engineer services sheet: six services, drawn to scale.',
    },
  },
  'how-it-works': {
    title: 'How it works',
    description:
      'Survey, design, build, hand over, keep running: what we do, what you do, how long each step takes, and where a person stays in charge of the AI.',
    og: {
      kicker: 'P-00 · PROCESS',
      title: 'Measure twice. Automate once.',
      alt: 'Actual Engineer process sheet: measure twice, automate once.',
    },
  },
  about: {
    title: 'About',
    description:
      'A small crew from engineering, construction and software. The people who scope your project are the people who build it.',
    og: {
      kicker: 'G-02 · PROJECT DIRECTORY',
      title: 'Small on purpose.',
      alt: 'Actual Engineer project directory: small on purpose.',
    },
  },
  contact: {
    title: 'Book a call',
    description:
      'Pick a time on our calendar, send a short note or email us, and see exactly what happens next.',
    og: {
      kicker: 'G-03 · REQUEST FOR INFORMATION',
      title: 'Pick a time. Bring the spreadsheet.',
      alt: 'Actual Engineer request for information: pick a time, bring the spreadsheet.',
    },
  },
  'not-found': {
    title: 'Sheet not found',
    description: 'That sheet is not in the set. The full set is linked from here.',
    og: {
      kicker: 'SHEET NOT FOUND',
      title: 'Sheet not found.',
      alt: 'Actual Engineer: sheet not found.',
    },
  },
  'punch-list': {
    title: 'Punch list',
    description: 'Preview only: every HOLD and pending CONFIRM still open on the site.',
    og: { kicker: 'PUNCH LIST', title: 'Punch list', alt: 'Actual Engineer punch list.' },
  },
  kit: {
    title: 'Kit',
    description: 'Preview only: the design-system sheet.',
    og: { kicker: 'KIT', title: 'Kit', alt: 'Actual Engineer design-system sheet.' },
  },
}
