import type { Graph, GraphNode, LayoutId, Pt, ViewBox } from '../types'

/**
 * "What happens after you reach out" (G-03, DETAIL 1): four nodes joined by
 * conduits, in a row (wide) or a column (tall). The ports differ per family,
 * so each family has its own graph; both share ids, labels and viewBoxes.
 * Labels are HTML (src/content/figures/after-contact.ts), placed by
 * afterContactLabels(). The 'received' graph is the success drawing shown
 * in the form ("your node joins ours"): our node, theirs, one conduit.
 */

export type AfterContactLabel = 'you' | 'reply' | 'call' | 'next'
export type AfterContactRev = 'flow'

const VB: { wide: ViewBox; tall: ViewBox } = { wide: [0, 0, 960, 240], tall: [0, 0, 400, 580] }
const DESIGN = { wide: 960, tall: 400 }
const IDS: readonly AfterContactLabel[] = ['you', 'reply', 'call', 'next']
const KIND = { you: 'person', reply: 'doc', call: 'person', next: 'report' } as const

/** Wide: 160 × 96 boxes, 80 apart; each label centred in its box (both families). */
const WIDE_AT = (i: number): Pt => [40 + i * 240, 44]
const WIDE_SIZE = [160, 96] as const
/** Tall: 150 × 80 boxes, 60 apart. */
const TALL_AT = (i: number): Pt => [40, 40 + i * 140]
const TALL_SIZE = [150, 80] as const

function graph(family: LayoutId): Graph<AfterContactLabel, AfterContactRev> {
  const wide = family === 'wide'
  const nodes: GraphNode<AfterContactLabel, AfterContactRev>[] = IDS.map((id, i) => ({
    id,
    kind: KIND[id],
    label: id,
    at: WIDE_AT(i),
    atTall: TALL_AT(i),
    size: WIDE_SIZE,
    sizeTall: TALL_SIZE,
    ports: wide
      ? { in: { side: 'w', at: 0.5 }, out: { side: 'e', at: 0.5 } }
      : { in: { side: 'n', at: 0.5 }, out: { side: 's', at: 0.5 } },
  }))
  return {
    id: 'after-contact',
    viewBox: VB,
    designWidth: DESIGN,
    revs: ['flow'],
    nodes,
    routes: IDS.slice(1).map((id, i) => ({
      id: `${IDS[i]}-${id}`,
      from: `${IDS[i]}.out`,
      to: `${id}.in`,
      kind: 'conduit' as const,
    })),
    seed: 31,
  }
}

export const afterContactGraphs: Readonly<
  Record<LayoutId, Graph<AfterContactLabel, AfterContactRev>>
> = { wide: graph('wide'), tall: graph('tall') }

export const AFTER_CONTACT_VIEWBOX = VB

const pct = (n: number, of: number) => Math.round((n / of) * 1000) / 10

/** Label anchors (top-left), as percent numbers of the box: --lx/--ly and --lxt/--lyt. */
export function afterContactLabels(): Record<
  AfterContactLabel,
  { lx: number; ly: number; lxt: number; lyt: number }
> {
  const out = {} as Record<AfterContactLabel, { lx: number; ly: number; lxt: number; lyt: number }>
  IDS.forEach((id, i) => {
    const [wx, wy] = WIDE_AT(i)
    const [tx, ty] = TALL_AT(i)
    out[id] = {
      lx: pct(wx + WIDE_SIZE[0] / 2, VB.wide[2]),
      ly: pct(wy + WIDE_SIZE[1] / 2, VB.wide[3]),
      lxt: pct(tx + TALL_SIZE[0] / 2, VB.tall[2]),
      lyt: pct(ty + TALL_SIZE[1] / 2, VB.tall[3]),
    }
  })
  return out
}

// ── The success drawing: our node, theirs, one conduit ─────────────────────

const RECEIVED_VB: ViewBox = [0, 0, 480, 160]
const OURS: Pt = [24, 36]
const THEIRS: Pt = [306, 36]
const NODE = [150, 80] as const

export const receivedGraph: Graph<'ours' | 'theirs', 'received'> = {
  id: 'after-contact',
  viewBox: { wide: RECEIVED_VB, tall: RECEIVED_VB },
  designWidth: { wide: 480, tall: 480 },
  revs: ['received'],
  nodes: [
    {
      id: 'ours',
      kind: 'tool',
      label: 'ours',
      at: OURS,
      size: NODE,
      ports: { out: { side: 'e', at: 0.5 } },
    },
    {
      id: 'theirs',
      kind: 'tool',
      label: 'theirs',
      at: THEIRS,
      size: NODE,
      ports: { in: { side: 'w', at: 0.5 } },
    },
  ],
  routes: [{ id: 'joins', from: 'theirs.in', to: 'ours.out', kind: 'conduit' }],
  seed: 37,
}

/** Where the success drawing's HTML labels sit, in percent of the image box. */
export const RECEIVED_LABELS = {
  aspect: [RECEIVED_VB[2], RECEIVED_VB[3]] as [number, number],
  ours: [pct(OURS[0] + 10, RECEIVED_VB[2]), pct(OURS[1] + 10, RECEIVED_VB[3])] as [number, number],
  theirs: [pct(THEIRS[0] + 10, RECEIVED_VB[2]), pct(THEIRS[1] + 10, RECEIVED_VB[3])] as [
    number,
    number,
  ],
  stamp: [pct(200, RECEIVED_VB[2]), pct(124, RECEIVED_VB[3])] as [number, number],
}
