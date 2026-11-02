/**
 * All site copy. Aaron Anderson is the brand; actualengineer.com is the domain.
 * Rules: never call Aaron an engineer, never say "Realtor", no seals, no invented clients or
 * numbers.
 */
import type { ChapterId } from '@/lib/story/chapters'

export const SITE = {
  name: 'Aaron Anderson',
  domain: 'actualengineer.com',
  url: 'https://actualengineer.com',
  title: 'Aaron Anderson — AI for the people who build houses',
  description:
    'Aaron Anderson — home builder, contractor and real estate agent — helps architects, builders, the trades, contractors and agents put AI to work.',
} as const

/**
 * Where "Talk to Aaron" and "Book a walkthrough" lead.
 * TODO(client): replace with Aaron's email (mailto:) or booking link. Until then both buttons
 * scroll to the contact section.
 */
export const CONTACT = { href: '#contact', placeholder: true } as const

export const NAV_CTA = 'Talk to Aaron'

export const HERO = {
  eyebrow: 'AI consulting for home building',
  title: 'AI for the people who build houses.',
  lead: 'Aaron Anderson spent almost two decades as a contractor and built his own house from the foundation up. Now he helps everyone from the architect to the listing agent put AI to work.',
  cta: 'Talk to Aaron',
  scroll: 'Scroll to build',
} as const

export interface Capability {
  title: string
  line: string
}

export interface ChapterCopy {
  title: string
  lead: string
  caps: readonly [Capability, Capability, Capability]
  closing?: string
}

export const STORY: Record<ChapterId, ChapterCopy> = {
  architects: {
    title: 'More designing. Less drafting.',
    lead: 'Every trade downstream builds from your drawings. AI can take the repetitive parts — test fits, drafting, code checks — so your hours go into the design.',
    caps: [
      { title: 'Test fits, before the first meeting', line: 'Turn a client’s program into workable layouts you can compare side by side.' },
      { title: 'Drawings, drafted', line: 'Walls, openings, dimensions, tags and labels drafted from your design, for your review.' },
      { title: 'Code checks, early', line: 'Egress, hall widths, clearances and smoke alarms flagged before plan review does.' },
    ],
    closing: 'AI drafts. You design.',
  },
  construction: {
    title: 'Know the numbers before you pour.',
    lead: 'Foundation and framing set the pace for everything that follows. AI can read the plans, quantify the material and keep crews, deliveries and inspections in sequence.',
    caps: [
      { title: 'Takeoffs and estimates', line: 'Quantify concrete, lumber and sheathing from the plans, then price it against past jobs.' },
      { title: 'Schedules that adjust', line: 'Resequence crews, deliveries and inspections when rain or a late truck moves the day.' },
      { title: 'Paperwork from the field', line: 'Turn site photos and voice notes into daily logs and RFIs.' },
    ],
  },
  trades: {
    title: 'Quote it before you leave the driveway.',
    lead: 'Roofers, electricians and plumbers often win the job with the first clear quote. AI can measure, price and write it up while you’re still on site.',
    caps: [
      { title: 'Measure without a ladder', line: 'Roof squares and pitch from aerial photos; wire and pipe runs from the plans.' },
      { title: 'Same-day quotes', line: 'Turn a walkthrough into an itemized quote the homeowner can sign that day.' },
      { title: 'Code answers, cited', line: 'Ask an electrical, plumbing or local-amendment question and get the section cited.' },
    ],
  },
  contractors: {
    title: 'One room. Every trade. Fewer surprises.',
    lead: 'A kitchen puts nearly every trade and selection in one room, on one budget. AI can keep selections, change orders and client updates straight, so the job finishes the way it was sold.',
    caps: [
      { title: 'Selections to specs', line: 'Turn client picks into specs with model numbers, lead times and allowances.' },
      { title: 'Priced change orders', line: 'Price a change, show the schedule impact and get it signed today.' },
      { title: 'Subs and punch lists', line: 'Send each sub their scope and dates, then track the punch list to zero.' },
    ],
  },
  agents: {
    title: 'Sell it like you built it.',
    lead: 'Buyers ask about the roof, the wiring and the foundation. AI can turn plans, permits and inspection reports into clear answers, listings and marketing in your voice.',
    caps: [
      { title: 'Listings from the plans', line: 'Write listing copy from plans and permits, checked for fair-housing language.' },
      { title: 'Inspection reports, decoded', line: 'Turn an inspection report into a ranked repair list with rough costs.' },
      { title: 'Comps that know construction', line: 'Pull comps and adjust for roof age, systems and build quality.' },
    ],
  },
}

export const ABOUT = {
  eyebrow: 'About Aaron',
  title: 'Built from the foundation up.',
  body: 'Aaron Anderson has worked as a contractor for almost two decades. He is a home builder and a real estate agent, and he built his own house from the foundation up. Now he brings practical AI to the people who design, build and sell homes — set up by someone who has done the work.',
  facts: ['Almost 20 years contracting', 'Built his own house, foundation up', 'Builder · contractor · agent'],
} as const

export const CLOSING = {
  title: 'Bring the plans.',
  line: 'Tell Aaron where the work slows down. He’ll show you where AI fits — and where it doesn’t.',
  cta: 'Book a walkthrough',
} as const

export const FOOTER = {
  line: '© 2026 Aaron Anderson · AI consulting for home building',
  domain: SITE.domain,
} as const
