import type { SeoContent } from './types'

/**
 * Titles, descriptions and OG text per page. Titles get ' · Actual Engineer'
 * unless absolute. Every rendered title is at most 60 characters and every
 * description at most 155, all unique (src/content/__tests__/seo.unit.spec.ts).
 */
export const seo: SeoContent = {
  home: {
    title: 'Actual Engineer · AI for engineering and construction firms',
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
    title: 'Services, from survey to support',
    description:
      'Six fixed-scope services, from a two-week Systems Survey to monthly Run & Improve. Each sheet shows what you get and how long it takes.',
    og: {
      kicker: 'S-00 · SERVICES',
      title: 'Services, drawn to scale.',
      alt: 'Actual Engineer services sheet: six services, drawn to scale.',
    },
  },
  'how-it-works': {
    title: 'How it works, in five steps',
    description:
      'Survey, design, build, hand over, keep running. What we do, what you do, how long each step takes, and where a person stays in charge of the AI.',
    og: {
      kicker: 'P-00 · HOW IT WORKS',
      title: 'Measure twice. Automate once.',
      alt: 'Actual Engineer process sheet: measure twice, automate once.',
    },
  },
  about: {
    title: 'About the crew',
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
    description: 'Book a call, send a short note or email us, and see exactly what happens next.',
    og: {
      kicker: 'G-03 · REQUEST FOR INFORMATION',
      title: 'Pick a time. Bring the spreadsheet.',
      alt: 'Actual Engineer request for information: pick a time, bring the spreadsheet.',
    },
  },
  'not-found': {
    title: 'Sheet not found',
    description: 'That sheet is not in the set. Every sheet in the set is linked from here.',
    og: {
      kicker: 'SHEET NOT IN THE SET',
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
    description: 'Preview only: the design-system sheet, with every component on one page.',
    og: { kicker: 'KIT', title: 'Kit', alt: 'Actual Engineer design-system sheet.' },
  },
}
