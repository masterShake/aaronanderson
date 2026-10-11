import { hold } from './hold'
import { services } from './services'
import type { FaqItem } from './types'

const s01Price = services[0]!.shape.price!.value
const s06Price = services[5]!.shape.price!.value

/** Questions people ask before they book, styled as an RFI log. */
export const faq: readonly FaqItem[] = [
  {
    id: 'switch',
    q: 'Do we have to switch software?',
    a: "Usually not. If a tool is genuinely holding you back we'll say so and say why, and it's your call.",
  },
  {
    id: 'ai-wrong',
    q: 'What if the AI gets it wrong?',
    a: 'It will sometimes, like a new hire. That is why every workflow has a tolerance, a sign-off valve and a log.',
  },
  {
    id: 'ownership',
    q: 'Who owns what you build?',
    a: hold('Ownership answer: who owns the integrations, code and documentation', {
      id: 'faq.ownership',
      kind: 'policy',
      prodFallback: null,
    }),
  },
  {
    id: 'data',
    q: 'Is our data safe with you?',
    a: hold('Data handling answer: access, storage and deletion', {
      id: 'faq.data',
      kind: 'policy',
      prodFallback: null,
    }),
  },
  {
    id: 'cost',
    q: 'What does it cost?',
    a: {
      text: 'A fixed fee agreed before work starts. The survey starts at {survey}. Run & Improve starts at {monthly} a month.',
      vars: { survey: s01Price, monthly: s06Price },
    },
  },
  {
    id: 'fit',
    q: 'Do you only work with contractors?',
    a: "We work with engineering firms, contractors, developers and people-operations teams. If your work is projects, people and paperwork, we're probably a fit.",
  },
]
