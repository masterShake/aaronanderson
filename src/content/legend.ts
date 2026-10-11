import type { GlossaryTerm, LegendSymbol } from './types'

/** The legend: every symbol in plain words. It doubles as the site's AI glossary. */
export const legendSymbols: readonly LegendSymbol[] = [
  { id: 'tool', term: 'Tool', plain: 'Software you already own.' },
  {
    id: 'conduit',
    term: 'Conduit',
    plain: 'A working connection: what enters one tool appears in the other.',
  },
  {
    id: 'hand-carry',
    term: 'Hand-carry',
    plain: 'Someone retyping, forwarding or exporting. The line we remove.',
  },
  { id: 'packet', term: 'Packet', plain: 'One record moving: an invoice, a lead, a timesheet.' },
  { id: 'ai-step', term: 'AI reader', plain: 'Reads, drafts, sorts or routes. Never signs.' },
  { id: 'sign-off', term: 'Sign-off valve', plain: 'A person approves before work goes on.' },
  {
    id: 'tolerance',
    term: 'Tolerance',
    plain: 'How sure the AI must be before work skips the valve.',
  },
  { id: 'data-store', term: 'Data tank', plain: 'The one place reports read from.' },
  { id: 'monitor', term: 'Monitor', plain: 'Watches every connection and raises the alarm.' },
  { id: 'logbook', term: 'Logbook', plain: 'Every step the machine took, written down.' },
  { id: 'revision-cloud', term: 'Revision cloud', plain: 'A problem we found.' },
  { id: 'hold', term: 'HOLD', plain: 'Information still to come. Never a made-up number.' },
]

export const glossary: readonly GlossaryTerm[] = [
  {
    id: 'api',
    term: 'API',
    plain: 'A socket on the side of your software that other software can plug into.',
  },
  {
    id: 'integration',
    term: 'Integration',
    plain:
      'A permanent connection between two programs, so data entered in one shows up in the other.',
    see: 'conduit',
  },
  {
    id: 'automation-platform',
    term: 'Automation platform',
    plain: 'A service that runs the connections for you, like a junction box for software.',
  },
  {
    id: 'data-layer',
    term: 'Data layer',
    plain: 'One tidy copy of the numbers from every system, kept up to date.',
    see: 'data-store',
  },
  {
    id: 'dashboard',
    term: 'Dashboard',
    plain: 'A screen of live gauges built from that one copy, so nobody assembles reports by hand.',
  },
  {
    id: 'language-model',
    term: 'Language model',
    plain:
      'The engine inside AI tools: software that reads and writes text by predicting likely words.',
  },
  {
    id: 'ai-agent',
    term: 'AI agent',
    plain:
      'A language model given a narrow job and a few tools, like reading an invoice and filling in a form.',
    see: 'ai-step',
  },
  {
    id: 'prompt',
    term: 'Prompt',
    plain: 'The written instructions you give an AI tool. Clear prompts get dependable work.',
  },
  {
    id: 'retrieval',
    term: 'Retrieval',
    plain: 'Letting the AI look things up in your own documents before it answers.',
  },
  {
    id: 'hallucination',
    term: 'Hallucination',
    plain:
      'When an AI states something confidently that is not true. Tolerances and sign-off valves catch it.',
  },
  {
    id: 'human-in-the-loop',
    term: 'Human in the loop',
    plain: 'A person checks and approves before the work goes any further.',
    see: 'sign-off',
  },
  {
    id: 'usage-log',
    term: 'Usage log',
    plain: 'A site diary for the machine: what it read, what it did and who approved it.',
    see: 'logbook',
  },
  {
    id: 'webhook',
    term: 'Webhook',
    plain: 'A doorbell one program rings to tell another that something just happened.',
  },
]
