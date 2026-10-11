import { hold } from './hold'
import type { ProofContent } from './types'

/** Proof stays on HOLD until a client agrees to put their name and real numbers to it. */
export const proof: ProofContent = {
  caseStudies: [
    hold('Case study one: client, problem, what we built, measured result', {
      id: 'proof.case-1',
      kind: 'proof',
      prodFallback: null,
    }),
    hold('Case study two', { id: 'proof.case-2', kind: 'proof', prodFallback: null }),
    hold('Case study three', { id: 'proof.case-3', kind: 'proof', prodFallback: null }),
  ],
  testimonials: [
    hold('Client quote with name, role and permission', {
      id: 'proof.quote-1',
      kind: 'proof',
      prodFallback: null,
    }),
  ],
  logos: hold('Client logos, with permission', {
    id: 'proof.logos',
    kind: 'proof',
    prodFallback: null,
  }),
  stats: [],
}
