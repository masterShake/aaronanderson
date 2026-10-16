import type { FigureCopy } from '../types'
import { site } from '../site'

/**
 * The delivery ticket on How It Works, DETAIL 1 / P-00 (owner: how). It
 * revises from REV 0 to REV 4 as the steps scroll by. Render-time vars {h} and
 * {r} (hand-offs and retypes) come from counts(graph). No hand notes (the
 * W4 finish standard keeps them to the hero and the firm schematic).
 */
export const ticketFigure = {
  id: 'ticket',
  detail: 'DETAIL 1 / P-00',
  title: 'ONE DELIVERY TICKET',
  tag: site.sampleTag,
  caption:
    'One supplier delivery ticket, from the truck to the job-cost report. Scale 1:1, roughly.',
  longDescription: [
    'As found, the ticket is photographed, texted, forwarded, printed and retyped: {h:word} hand-offs and {r:word} retypes.',
    'Proposed, the photo goes to an AI reader, is matched to its purchase order and checked against a tolerance. Only exceptions go to the project manager to sign off.',
    'Built and tested on real tickets alongside the old route, then handed over with a guide and a walkthrough. A monitor now watches the line.',
  ],
  labels: {
    ticket: 'DELIVERY TICKET',
    truck: 'SUPPLIER TRUCK',
    field: 'FIELD LEAD',
    pm: 'PROJECT MANAGER',
    inbox: 'INBOX',
    office: 'OFFICE',
    po: 'PURCHASE ORDERS',
    accounting: 'ACCOUNTING',
    jobCost: 'JOB-COST REPORT',
    'carry.paper': 'paper ticket',
    'carry.photo': 'photo, texted',
    'carry.forward': 'forwarded',
    'carry.print': 'printed',
    'carry.po': 'PO number retyped',
    'carry.lines': 'line items retyped',
    'route.ai': 'AI READER',
    'route.match': 'ORDER MATCH',
    'route.tolerance': 'TOLERANCE',
    'route.signOff': 'SIGN-OFF, EXCEPTIONS ONLY',
    'route.accounting': 'ACCOUNTING',
    'route.jobCost': 'JOB COST',
    markup: 'WHO SIGNS IF THE MANAGER IS OUT?',
    test: 'TEST',
    parallel: 'PARALLEL RUN',
    'doc.guide': 'GUIDE',
    'doc.walkthrough': 'WALKTHROUGH',
    'doc.guideline': 'AI-USE GUIDELINE',
    monitor: 'MONITOR',
    fixed: 'SYNC FAILED → FIXED',
  },
  revs: {
    rev0: 'REV 0 · EXISTING CONDITIONS',
    rev1: 'REV 1 · ISSUED FOR REVIEW',
    rev2: 'REV 2 · ISSUED FOR CONSTRUCTION',
    rev3: 'REV 3 · AS-BUILT',
    rev4: 'REV 4 · IN SERVICE',
  },
  ui: {
    tape: '{h} HAND-OFFS · {r} RETYPES',
    tapeOne: '{h} HAND-OFF · {r} RETYPES',
    revColumns: 'REV · STATUS · CHANGE',
    punchTitle: 'PUNCH LIST',
    'punch.guide': 'Guide written',
    'punch.walkthrough': 'Walkthrough recorded',
    'punch.approvers': 'Approvers named',
    'stamp.rev0': 'EXISTING CONDITIONS',
    'stamp.rev1': 'ISSUED FOR REVIEW',
    'stamp.rev2': 'ISSUED FOR CONSTRUCTION',
    'stamp.rev3': 'AS-BUILT',
    'stamp.rev4': 'IN SERVICE',
  },
} satisfies FigureCopy
