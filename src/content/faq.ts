import { confirm, hold } from './hold'
import type { FaqItem, Rich } from './types'

/**
 * Questions people ask before they book, styled as an RFI log. Answers that
 * promise something are CONFIRMs; answers only the owner can give are HOLDs.
 */
export const faq: readonly FaqItem[] = [
  {
    id: 'switch',
    q: 'Do we have to switch software?',
    a: confirm<Rich>(
      "Usually not. If a tool is really holding you back, we'll say so and say why. It's your call.",
      { id: 'faq.switch' },
    ),
  },
  {
    id: 'ai-wrong',
    q: 'What if the AI gets it wrong?',
    a: confirm<Rich>(
      'It will sometimes, like a new hire. That is why every workflow has a [[human-in-the-loop|person in the loop]], a tolerance and a log.',
      { id: 'faq.aiWrong' },
    ),
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
    a: hold('Data answer: access, storage, which AI providers see it, and deletion', {
      id: 'faq.data',
      kind: 'policy',
      prodFallback: null,
    }),
  },
  {
    id: 'cost',
    q: 'What does it cost?',
    a: confirm<Rich>(
      'A fixed fee, agreed before work starts. Each service sheet shows how its price is set.',
      { id: 'faq.cost' },
    ),
  },
  {
    id: 'on-site',
    q: 'Do you come to site?',
    a: hold('On-site answer: where you travel to, and what you do remotely', {
      id: 'faq.onSite',
      kind: 'policy',
      prodFallback: null,
    }),
  },
  {
    id: 'fit',
    q: 'Do you only work with contractors?',
    a: "No. We're set up for engineering firms, contractors, developers and people-operations teams. If your work is projects, people and paperwork, we're probably a fit.",
  },
]
