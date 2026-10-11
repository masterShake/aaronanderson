import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-05 Team Enablement, DETAIL 5 / S-05 (owner: services). Paper only, no
 * loop. People stay pencil; the handed tools carry the orange. No hand notes.
 */
export const s05Figure = {
  id: 's05',
  detail: 'DETAIL 5 / S-05',
  title: 'THE CREW, TRAINED',
  tag: site.exampleTag,
  caption: 'The crew gets the tools and the know-how, on their own work.',
  longDescription: [
    'An estimator, a project manager and a field lead in hard hats each start with a question mark.',
    'Each is handed a tool: a prompt playbook, an AI-use guideline and a recorded walkthrough. The question marks become ticks.',
    'A new hire walks in, watches the walkthrough, and a training record fills in.',
  ],
  labels: {
    'person.estimator': 'ESTIMATOR',
    'person.pm': 'PROJECT MANAGER',
    'person.field': 'FIELD LEAD',
    'person.newHire': 'NEW HIRE',
    'callout.playbook': 'PROMPT PLAYBOOK · ESTIMATING',
    'callout.guideline': 'AI-USE GUIDELINE · PLAIN ENGLISH',
    'callout.walkthrough': 'RECORDED WALKTHROUGH · NEW HIRES',
    question: '?',
  },
  controls: { replay: 'Replay', playDrawing: 'Play the drawing' },
  table: {
    caption: 'Training record',
    columns: ['Session', 'Done'],
  },
  ui: {
    recordTitle: 'TRAINING RECORD · SAMPLE',
    'row.office': 'OFFICE SESSION',
    'row.field': 'FIELD SESSION',
    'row.playbook': 'PROMPT PLAYBOOK',
    'row.walkthrough': 'NEW-HIRE WALKTHROUGH',
    done: 'DONE ✓',
  },
} satisfies FigureCopy
