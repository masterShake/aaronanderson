import type { PreviewContent } from '../types'

/** Preview-only pages. Production returns 404 for both. */
export const preview: PreviewContent = {
  punchList: {
    h1: 'Punch list',
    deck: 'Everything still to supply or confirm before launch. Production hides all of it.',
    essential: 'Essential holds (a strict build fails while any remain)',
    optional: 'Other holds',
    pending: 'Promises waiting for your confirm',
    columns: ['ID', 'What is needed', 'Kind'],
    empty: 'Nothing open.',
  },
  kit: {
    h1: 'Kit',
    deck: 'The design-system sheet: every component on one page.',
    stage: {
      h1: 'Stage',
      deck: 'The stage on its own, for checking hand-offs.',
      probe: 'Bundle probe loaded.',
    },
  },
}
