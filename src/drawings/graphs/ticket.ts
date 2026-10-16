import type { Graph, GraphNode, GraphRoute } from '../types'

/**
 * The delivery ticket on How It Works (pages-drawings §6.7): one supplier
 * delivery ticket followed from the truck to the job-cost report, revised
 * from REV 0 (as found, in pencil) to REV 4 (in service).
 *
 * - REV 0: six hand-offs, two of them retypes (counted, never literal).
 * - REV 1 to REV 4: the field lead's photo goes through an AI reader to a
 *   purchase order match, past a tolerance dial and the sign-off valve, into
 *   accounting and the job-cost report. One hand-off is left: the photo.
 *
 * Positions and the viewBoxes live in src/drawings/views/ticket.ts (applyView);
 * label keys point into src/content/figures/ticket.ts. No strings here beyond
 * ids and keys.
 */

export type TicketRev = 'rev0' | 'rev1' | 'rev2' | 'rev3' | 'rev4'
export const TICKET_REVS: readonly TicketRev[] = ['rev0', 'rev1', 'rev2', 'rev3', 'rev4']
/** The revisions drawn in clean CAD ink (REV 0 is the pencil survey). */
export const TICKET_NEW: readonly TicketRev[] = ['rev1', 'rev2', 'rev3', 'rev4']

export type TicketLabel =
  | 'ticket'
  | 'truck'
  | 'field'
  | 'pm'
  | 'inbox'
  | 'office'
  | 'po'
  | 'accounting'
  | 'jobCost'
  | 'carry.paper'
  | 'carry.photo'
  | 'carry.forward'
  | 'carry.print'
  | 'carry.po'
  | 'carry.lines'
  | 'route.ai'
  | 'route.match'
  | 'route.tolerance'
  | 'route.signOff'
  | 'route.accounting'
  | 'route.jobCost'
  | 'markup'
  | 'test'
  | 'parallel'
  | 'doc.guide'
  | 'doc.walkthrough'
  | 'doc.guideline'
  | 'monitor'
  | 'fixed'

/** Box sizes in user units: at least 104 × 36 CSS px at each family's minimum width. */
export const TICKET_BOX: readonly [number, number] = [180, 64]
export const TICKET_BOX_TALL: readonly [number, number] = [140, 48]

type N = GraphNode<TicketLabel, TicketRev>
type R = GraphRoute<TicketLabel, TicketRev>

const node = (
  id: string,
  label: TicketLabel,
  kind: N['kind'],
  revs?: readonly TicketRev[],
  o: Partial<N> = {},
): N => ({
  id,
  kind,
  label,
  at: [0, 0],
  size: TICKET_BOX,
  sizeTall: TICKET_BOX_TALL,
  ports: {},
  ...(revs ? { revs } : {}),
  ...o,
})

const AS_FOUND: readonly TicketRev[] = ['rev0']

export const TICKET_NODES: readonly N[] = [
  // the paper itself, drawn large; it never changes
  node('ticket', 'ticket', 'doc', undefined, { size: [240, 180], sizeTall: [140, 128] }),
  node('truck', 'truck', 'tool', undefined, { size: [180, 72] }),
  node('field', 'field', 'person'),
  // as found
  node('pm', 'pm', 'tool', AS_FOUND),
  node('inbox', 'inbox', 'tool', AS_FOUND),
  node('office', 'office', 'tool', AS_FOUND),
  node('po', 'po', 'tool', AS_FOUND),
  node('accounting', 'accounting', 'tool', AS_FOUND),
  node('jobCost', 'jobCost', 'report', AS_FOUND),
  // proposed and built
  node('match', 'route.match', 'tool', TICKET_NEW, { era: 'N' }),
  node('acct', 'route.accounting', 'tool', TICKET_NEW, { era: 'E' }),
  node('job', 'route.jobCost', 'report', TICKET_NEW, { era: 'E' }),
]

/** Nodes drawn only in pencil (they stay as found in every revision). */
export const TICKET_PENCIL_ONLY: readonly string[] = ['ticket', 'truck', 'field']

export const TICKET_ROUTES: readonly R[] = [
  // as found: six hand-offs, two retyped
  {
    id: 'r1',
    from: 'truck.s',
    to: 'field.n',
    kind: 'hand-carry',
    mode: 'forward',
    carries: 'carry.paper',
    revs: AS_FOUND,
  },
  {
    id: 'r2',
    from: 'field.photo',
    to: 'pm.w',
    kind: 'hand-carry',
    mode: 'forward',
    carries: 'carry.photo',
    revs: AS_FOUND,
  },
  {
    id: 'r3',
    from: 'pm.e',
    to: 'inbox.w',
    kind: 'hand-carry',
    mode: 'forward',
    carries: 'carry.forward',
    revs: AS_FOUND,
  },
  {
    id: 'r4',
    from: 'inbox.out',
    to: 'office.in',
    kind: 'hand-carry',
    mode: 'forward',
    carries: 'carry.print',
    revs: AS_FOUND,
  },
  {
    id: 'r5',
    from: 'office.po',
    to: 'po.in',
    kind: 'hand-carry',
    mode: 'retype',
    manual: true,
    carries: 'carry.po',
    revs: AS_FOUND,
  },
  {
    id: 'r6',
    from: 'office.acct',
    to: 'accounting.in',
    kind: 'hand-carry',
    mode: 'retype',
    manual: true,
    carries: 'carry.lines',
    revs: AS_FOUND,
  },
  // proposed and built: the photo is the one hand-off left
  {
    id: 'n1',
    from: 'field.e',
    to: 'match.w',
    kind: 'conduit',
    mode: 'forward',
    ai: true,
    replaces: ['r2', 'r3', 'r4'],
    revs: TICKET_NEW,
  },
  {
    id: 'n2',
    from: 'match.e',
    to: 'acct.w',
    kind: 'conduit',
    valve: true,
    replaces: ['r5', 'r6'],
    revs: TICKET_NEW,
  },
  { id: 'n3', from: 'acct.s', to: 'job.n', kind: 'conduit', revs: TICKET_NEW },
]

export const ticketGraph: Graph<TicketLabel, TicketRev> = {
  id: 'ticket',
  // the view supplies the real viewBoxes and positions
  viewBox: { wide: [0, 0, 960, 720], tall: [0, 0, 400, 500] },
  designWidth: { wide: 960, tall: 400 },
  revs: TICKET_REVS,
  nodes: TICKET_NODES,
  routes: TICKET_ROUTES,
  seed: 0x71c4e7,
}
