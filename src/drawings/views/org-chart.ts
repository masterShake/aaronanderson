import type { LayoutId, Pt, SymbolId, ViewBox } from '../types'

/**
 * The org chart on About (DETAIL 2 / G-02; pages-drawings §6.9; owner:
 * home-about): who your question passes through, drawn as an org chart of
 * people in two states.
 *   chain (paper, pencil): five cards, YOU → ACCOUNT MANAGER → PROJECT
 *     MANAGER → ANALYST → THE PERSON WHO BUILDS IT, each joint a hand-carry
 *     with a sheet of paper on it;
 *   ours (blueprint-deep, CAD): YOU and THE PEOPLE WHO BUILD IT, joined by one
 *     flanged wire with packets on it.
 * Each card holds an architect's scale figure over a title rule; the title is
 * HTML (keys into src/content/figures/org-chart.ts `labels`). YOU and the
 * builders keep their places in both states. Wide runs left to right
 * (960 × 330); tall runs top to bottom (400 × 730). Geometry only: the drawing
 * is built in src/figures/org-chart/drawing.server.ts.
 */

export type OrgLabel = 'you' | 'account' | 'pm' | 'analyst' | 'builder' | 'builders' | 'lost'
export type OrgRev = 'chain' | 'ours'
export const ORG_REVS: readonly OrgRev[] = ['chain', 'ours']

export interface OrgRect {
  x: number
  y: number
  w: number
  h: number
}

export interface OrgCard {
  id: Exclude<OrgLabel, 'lost'>
  slot: number
  revs: readonly OrgRev[]
  /** The people in the card: pose and where their feet stand (per family). */
  people: readonly SymbolId[]
}

export const ORG_CARDS: readonly OrgCard[] = [
  { id: 'you', slot: 0, revs: ['chain', 'ours'], people: ['fig.standing'] },
  { id: 'account', slot: 1, revs: ['chain'], people: ['fig.phone'] },
  { id: 'pm', slot: 2, revs: ['chain'], people: ['fig.carrying-paper'] },
  { id: 'analyst', slot: 3, revs: ['chain'], people: ['fig.tablet'] },
  { id: 'builder', slot: 4, revs: ['chain'], people: ['fig.survey'] },
  {
    id: 'builders',
    slot: 4,
    revs: ['ours'],
    people: ['fig.hardhat-field', 'fig.survey', 'fig.tablet'],
  },
]

interface Layout {
  viewBox: ViewBox
  /** Card rect by slot. */
  card(slot: number): OrgRect
  /** The title area of a card (HTML label). */
  title(r: OrgRect): OrgRect
  /** Where the card's people stand (feet) and their scale, for n people. */
  feet(r: OrgRect, n: number): { at: readonly Pt[]; k: number }
  /** The hand-off joint between two neighbouring cards: from, to. */
  hop(a: OrgRect, b: OrgRect): readonly [Pt, Pt]
  /** The hand note's top-left corner. */
  note: Pt
  /** How far the wire's dimension line stands off the wire (ours). */
  dimOff: Pt
}

/**
 * The dimension on the wire (ours): a line parallel to the wire, offset by
 * dimOff, with extension lines back to the wire's ends; its label ("ONE
 * WIRE") centres on it.
 */
export function wireDim(family: LayoutId, a: Pt, b: Pt) {
  const [ox, oy] = ORG_LAYOUT[family].dimOff
  const p: Pt = [a[0] + ox, a[1] + oy]
  const q: Pt = [b[0] + ox, b[1] + oy]
  const sx = Math.sign(ox)
  const sy = Math.sign(oy)
  // extension lines start a little off the wire and run just past the dimension line
  const ext = [
    [
      [a[0] + sx * 6, a[1] + sy * 6],
      [p[0] + sx * 6, p[1] + sy * 6],
    ],
    [
      [b[0] + sx * 6, b[1] + sy * 6],
      [q[0] + sx * 6, q[1] + sy * 6],
    ],
  ] as const
  const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  return { line: [p, q] as const, ext, mid }
}

const W_CARD = 148
const W_PITCH = 191
const W_FIRST = 98

/** Person scale: the kit's figures are 64 artboard units tall at k = 1. */
const PERSON = 64

export const ORG_LAYOUT: Readonly<Record<LayoutId, Layout>> = {
  wide: {
    // the cards fill the frame's height: a margin above them, the hand note's line below
    viewBox: [0, 0, 960, 330],
    card: (slot) => ({ x: W_FIRST + slot * W_PITCH - W_CARD / 2, y: 26, w: W_CARD, h: 248 }),
    title: (r) => ({ x: r.x, y: r.y + r.h - 64, w: r.w, h: 64 }),
    feet: (r, n) => {
      const k = n > 1 ? 1.5 : 1.95
      const y = r.y + r.h - 76
      const cx = r.x + r.w / 2
      const step = 38
      return {
        k,
        at: Array.from({ length: n }, (_, i) => [cx + (i - (n - 1) / 2) * step, y] as Pt),
      }
    },
    hop: (a, b) => [
      [a.x + a.w, a.y + 86],
      [b.x, b.y + 86],
    ],
    note: [505, 290],
    dimOff: [0, -48],
  },
  tall: {
    viewBox: [0, 0, 400, 730],
    card: (slot) => ({ x: 36, y: 22 + slot * 144, w: 328, h: 104 }),
    title: (r) => ({ x: r.x + 112, y: r.y + 8, w: r.w - 112, h: r.h - 16 }),
    feet: (r, n) => {
      const k = n > 1 ? 1.05 : 1.3
      const y = r.y + r.h - 8
      const cx = r.x + 56
      const step = 26
      return {
        k,
        at: Array.from({ length: n }, (_, i) => [cx + (i - (n - 1) / 2) * step, y] as Pt),
      }
    },
    hop: (a, b) => [
      [a.x + 56, a.y + a.h],
      [b.x + 56, b.y],
    ],
    note: [108, 419],
    dimOff: [64, 0],
  },
}

/** The scale-figure height in viewBox units at scale k. */
export const orgPersonHeight = (k: number) => PERSON * k

export const cardsIn = (rev: OrgRev) => ORG_CARDS.filter((c) => c.revs.includes(rev))

/** The one wire's ends (ours): from YOU's card to the builders' card. */
export function wireEnds(family: LayoutId): readonly [Pt, Pt] {
  const L = ORG_LAYOUT[family]
  const slot = (id: string) => ORG_CARDS.find((c) => c.id === id)!.slot
  return L.hop(L.card(slot('you')), L.card(slot('builders')))
}
