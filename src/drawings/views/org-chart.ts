import type { Graph, GraphNode, GraphRoute, Pt } from '../types'

/**
 * The org chart on About (DETAIL 1 / G-02; pages-drawings §6.9; owner:
 * home-about), drawn as a one-line graph in two states:
 *   chain (paper, pencil): YOU → ACCOUNT MANAGER → PROJECT MANAGER → ANALYST →
 *     THE PERSON WHO BUILDS IT, each joint a hand-carry with a paper glyph;
 *   ours (blueprint-deep, CAD): YOU, one conduit, THE PEOPLE WHO BUILD IT.
 * Wide is horizontal (960 × 320); tall is vertical (400 × 600). YOU and the
 * builders stand in the same place in both states. Label keys point into
 * src/content/figures/org-chart.ts `labels`; the hand note is `notes.lost`.
 */

export type OrgLabel = 'you' | 'account' | 'pm' | 'analyst' | 'builder' | 'builders' | 'lost'
export type OrgRev = 'chain' | 'ours'
export const ORG_REVS: readonly OrgRev[] = ['chain', 'ours']

const BOX: readonly [number, number] = [152, 72]
const BOX_TALL: readonly [number, number] = [232, 60]
const XS = [96, 288, 480, 672, 864]
const Y = 150
const X_TALL = 200
const YS_TALL = [56, 178, 300, 422, 544]

const node = (
  id: string,
  label: OrgLabel,
  slot: number,
  revs?: readonly OrgRev[],
): GraphNode<OrgLabel, OrgRev> & { sizeTall: readonly [number, number] } => ({
  id,
  kind: 'tool',
  label,
  at: [XS[slot]! - BOX[0] / 2, Y - BOX[1] / 2],
  atTall: [X_TALL - BOX_TALL[0] / 2, YS_TALL[slot]! - BOX_TALL[1] / 2],
  size: BOX,
  sizeTall: BOX_TALL,
  ports: {},
  ...(revs ? { revs } : {}),
})

const NODES: GraphNode<OrgLabel, OrgRev>[] = [
  node('you', 'you', 0),
  node('account', 'account', 1, ['chain']),
  node('pm', 'pm', 2, ['chain']),
  node('analyst', 'analyst', 3, ['chain']),
  node('builder', 'builder', 4, ['chain']),
  node('builders', 'builders', 4, ['ours']),
]

const hop = (id: string, from: string, to: string): GraphRoute<OrgLabel, OrgRev> => ({
  id,
  from: `${from}.${id}`,
  to: `${to}.${id}`,
  kind: 'hand-carry',
  mode: 'forward',
  manual: true,
  revs: ['chain'],
})

const ROUTES: GraphRoute<OrgLabel, OrgRev>[] = [
  hop('c1', 'you', 'account'),
  hop('c2', 'account', 'pm'),
  hop('c3', 'pm', 'analyst'),
  hop('c4', 'analyst', 'builder'),
  {
    id: 'wire',
    from: 'you.wire',
    to: 'builders.wire',
    kind: 'conduit',
    replaces: ['c1', 'c2', 'c3', 'c4'],
    revs: ['ours'],
  },
]

/** The hand note, by the middle joint of the chain. */
const LOST_AT: Pt = [404, 214]
const LOST_AT_TALL: Pt = [212, 354]

export const orgChartGraph: Graph<OrgLabel, OrgRev> = {
  id: 'org-chart',
  viewBox: { wide: [0, 0, 960, 320], tall: [0, 0, 400, 600] },
  designWidth: { wide: 960, tall: 400 },
  revs: ORG_REVS,
  nodes: NODES,
  routes: ROUTES,
  notes: [{ key: 'lost', at: LOST_AT, atTall: LOST_AT_TALL, rotate: -3 }],
  seed: 2207,
}
