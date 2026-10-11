import { confirm, hold } from '../hold'
import type { AboutContent } from '../types'

/** About, sheet G-02 (project directory). The crew lives in ../people.ts. */
export const about: AboutContent = {
  h1: 'Small on purpose.',
  deck: {
    text: "Actual Engineer is {teamSize} people. The people who scope your project build it, and they're the ones you call when something changes.",
    vars: {},
  },
  crew: {
    id: 'crew',
    h2: "Who you'll actually talk to",
    tags: { FIELD: 'FIELD', OFFICE: 'OFFICE', CODE: 'CODE' },
    askLabel: 'Ask me about',
    photoAlt: { text: 'Photo of {name}', vars: {} },
    linkedin: 'LinkedIn',
  },
  strata: {
    id: 'strata',
    h2: 'Field, office and code: where we come from',
    body: ["That's why we draw before we build: it's how the trades work."],
    layers: [
      {
        id: 'field',
        label: 'FIELD',
        text: hold('Field experience: trades, sites, years', {
          id: 'about.strata.field',
          kind: 'text',
          prodFallback: null,
        }),
      },
      {
        id: 'office',
        label: 'OFFICE',
        text: hold('Office experience: estimating, project management, HR', {
          id: 'about.strata.office',
          kind: 'text',
          prodFallback: null,
        }),
      },
      {
        id: 'code',
        label: 'CODE',
        text: hold('Software experience: what we have built', {
          id: 'about.strata.code',
          kind: 'text',
          prodFallback: null,
        }),
      },
    ],
  },
  notes: {
    id: 'notes',
    h2: 'General notes on how we work',
    items: [
      confirm(
        'Scope is fixed before work starts. If it changes, we redraw it and you approve the revision.',
        {
          id: 'note.1',
        },
      ),
      confirm('We build on the tools you already own wherever we can.', { id: 'note.2' }),
      confirm(
        'A person approves anything that matters, and we agree together where the valves go.',
        {
          id: 'note.3',
        },
      ),
      confirm('Everything gets written down: drawings, guides, logs.', { id: 'note.4' }),
      confirm('You talk to the people doing the work; nobody sits in between.', { id: 'note.5' }),
      confirm("If something isn't worth automating, we'll tell you.", { id: 'note.6' }),
    ],
  },
  beliefs: {
    id: 'beliefs',
    h2: 'Machines for the retyping. People for the judgment.',
    body: [
      'Automation should take the dull, repeatable parts of the job: retyping, chasing, copying, reconciling.',
      "It shouldn't take the decisions, the relationships or the responsibility.",
      confirm('We design every system so a person can see what it did, stop it and overrule it.', {
        id: 'claim.about.beliefs',
      }),
    ],
  },
  orgChart: {
    id: 'org-chart',
    h2: 'Our org chart is one wire long.',
    body: [
      "At a big consultancy your question can pass through an account manager, a project manager and an analyst before it reaches someone who can answer it. Here it doesn't pass through anyone.",
    ],
    toggle: { label: 'Show', usual: 'The usual chain', ours: 'Ours' },
  },
  closing: {
    id: 'call',
    h2: "Talk to the people who'll build it.",
    body: 'No account managers, no handoffs. The person you book is the person who scopes the work.',
  },
}
