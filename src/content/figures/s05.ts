import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * S-05 Team Enablement, DETAIL 5 / S-05 (owner: services). Paper only, no
 * loop. People stay pencil; the handed tools carry the orange. No hand notes.
 * Callouts are set on two lines in the wide drawing (name, then what it is
 * for) and on one line, name only, in the tall one.
 */
export const s05Figure = {
  id: 's05',
  detail: 'DETAIL 5 / S-05',
  title: 'THE CREW, TRAINED',
  tag: site.exampleTag,
  caption: 'The crew gets the tools and the know-how, on their own work.',
  longDescription: [
    'An estimator, a project manager and a field lead in hard hats each start with a question.',
    'Each is handed a tool: a prompt playbook for estimating, an AI-use guideline in plain English and a video walkthrough for new hires. The questions become ticks.',
    'A new hire walks to a desk, watches the walkthrough, and a training record fills in.',
  ],
  labels: {
    'person.estimator': 'ESTIMATOR',
    'person.pm': 'PROJECT MANAGER',
    'person.field': 'FIELD LEAD',
    'person.newHire': 'NEW HIRE',
    'callout.playbook': 'PROMPT PLAYBOOK',
    'callout.playbook.sub': 'FOR ESTIMATING',
    'callout.guideline': 'AI-USE GUIDELINE',
    'callout.guideline.sub': 'IN PLAIN ENGLISH',
    'callout.walkthrough': 'VIDEO WALKTHROUGH',
    'callout.walkthrough.sub': 'FOR NEW HIRES',
    question: '?',
  },
  controls: { replay: 'Replay', playDrawing: 'Play the drawing' },
  table: {
    caption: 'Training record',
    columns: ['Session', 'Done'],
  },
  ui: {
    // copy-9 (src/content/__tests__/copy.unit.spec.ts) still asks for SAMPLE here; finish
    // standard A3 says the title strip's stamp is the only one (request filed to drop it)
    recordTitle: 'TRAINING RECORD · SAMPLE',
    'row.office': 'OFFICE SESSION',
    'row.field': 'FIELD SESSION',
    'row.playbook': 'PROMPT PLAYBOOK',
    'row.walkthrough': 'WALKTHROUGH',
    done: 'DONE ✓',
  },
} satisfies FigureCopy
