import type { Graph, LayoutId, Pt, ViewBox } from '../types'

/**
 * "What happens after you reach out" (G-03, DETAIL 1): four nodes joined by
 * conduits, in a row (wide) or a column (tall). Each node is an enclosure with
 * a glyph (a calendar and an envelope, a reply envelope, a handset, a signed
 * page) and a name plate; the names are HTML (src/content/figures/after-contact.ts),
 * placed by afterContactLabels(). The 'received' graph is the success drawing
 * shown in the form ("your node joins ours"): our node, theirs, one conduit.
 * Isomorphic, no strings.
 */

export type AfterContactLabel = 'you' | 'reply' | 'call' | 'next'
export type AfterContactRev = 'flow'

type Rect = readonly [x: number, y: number, w: number, h: number]

const VB: { wide: ViewBox; tall: ViewBox } = { wide: [0, 0, 960, 268], tall: [0, 0, 400, 596] }
export const AFTER_CONTACT_IDS: readonly AfterContactLabel[] = ['you', 'reply', 'call', 'next']

export interface AfterContactNode {
  id: AfterContactLabel
  box: Rect
  /** The glyph's centre and size. */
  glyph: readonly [x: number, y: number, s: number]
  /** The name plate (a thin frame); the label sits inside it. */
  plate: Rect
  /** Where the conduit leaves (out) and enters (in) the box. */
  in: Pt
  out: Pt
  /** The packet's stop (the box centre on the conduit line, hidden behind the box). */
  stop: Pt
}

function wide(i: number, id: AfterContactLabel): AfterContactNode {
  const x = 30 + i * 250
  const y = 32
  const w = 150
  const h = 204
  const cy = y + 72
  return {
    id,
    box: [x, y, w, h],
    glyph: [x + w / 2, cy, 74],
    plate: [x + 10, y + 124, w - 20, 68],
    in: [x, cy],
    out: [x + w, cy],
    stop: [x + w / 2, cy],
  }
}

function tall(i: number, id: AfterContactLabel): AfterContactNode {
  const x = 40
  const y = 24 + i * 146
  const w = 320
  const h = 110
  return {
    id,
    box: [x, y, w, h],
    glyph: [x + 58, y + h / 2, 58],
    plate: [x + 112, y + 22, w - 124, h - 44],
    in: [x + w / 2, y],
    out: [x + w / 2, y + h],
    stop: [x + w / 2, y + h / 2],
  }
}

export const AFTER_CONTACT_NODES: Readonly<Record<LayoutId, readonly AfterContactNode[]>> = {
  wide: AFTER_CONTACT_IDS.map((id, i) => wide(i, id)),
  tall: AFTER_CONTACT_IDS.map((id, i) => tall(i, id)),
}

export const AFTER_CONTACT_VIEWBOX = VB

const pct = (n: number, of: number) => Math.round((n / of) * 1000) / 10

/**
 * Label anchors as percent numbers of the box: --lx/--ly and --lxt/--lyt are
 * the name plate's centre; --lw/--lwt its inner width (labels centre on it).
 */
export function afterContactLabels(): Record<
  AfterContactLabel,
  { lx: number; ly: number; lxt: number; lyt: number; lw: number; lwt: number }
> {
  const out = {} as Record<
    AfterContactLabel,
    { lx: number; ly: number; lxt: number; lyt: number; lw: number; lwt: number }
  >
  AFTER_CONTACT_IDS.forEach((id, i) => {
    const [wx, wy, ww, wh] = AFTER_CONTACT_NODES.wide[i]!.plate
    const [tx, ty, tw, th] = AFTER_CONTACT_NODES.tall[i]!.plate
    out[id] = {
      lx: pct(wx + ww / 2, VB.wide[2]),
      ly: pct(wy + wh / 2, VB.wide[3]),
      lxt: pct(tx + tw / 2, VB.tall[2]),
      lyt: pct(ty + th / 2, VB.tall[3]),
      lw: pct(ww - 12, VB.wide[2]),
      lwt: pct(tw - 12, VB.tall[2]),
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
