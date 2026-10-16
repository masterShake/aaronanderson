import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode, SymbolId } from '@/drawings/types'
import { pencil, partsNodes } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { flangePrims, flowBuilder, packetNode } from '@/drawings/render/firm'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { arrowhead, chevron, paperGlyph, placeSymbol } from '@/drawings/symbols'
import {
  cardsIn,
  ORG_LAYOUT,
  wireDim,
  wireEnds,
  type OrgRect,
  type OrgRev,
} from '@/drawings/views/org-chart'

/**
 * The org-chart drawing files served by /drawings/[file] (owner: home-about):
 * the usual chain in pencil on paper, ours in CAD on blueprint-deep
 * (geometry in src/drawings/views/org-chart.ts). Every card is a group with a
 * role class (k-card, k-hop, k-wire) so org-chart.module.css can play the
 * change: the middle of the chain erases, the wire draws on, packets flow.
 */

export const ORG_CHART_STATES = [
  { rev: 'chain', ground: 'paper' },
  { rev: 'ours', ground: 'deep' },
] as const

const SEED = 2207
const clean = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  cls,
})
const rough = (
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: 'box' | 'line' = 'line',
): SvgNode[] =>
  pencil(prims, { seed: seedFrom(seed), preset }).map((s) => ({
    el: 'path',
    d: s.d,
    len: Math.round(s.len * 100) / 100,
    part,
    i,
    cls,
  }))

const rectPrim = (r: OrgRect): Prim => ({ t: 'rect', at: [r.x, r.y], size: [r.w, r.h] })

function cardNodes(
  family: LayoutId,
  rev: OrgRev,
  id: string,
  slot: number,
  poses: readonly SymbolId[],
) {
  const L = ORG_LAYOUT[family]
  const r = L.card(slot)
  const t = L.title(r)
  const cad = rev === 'ours'
  const i = slot * 2
  const seed = (x: string) => `org:${SEED}:${family}:${rev}:${id}:${x}`
  // the title rule: across the card over its title (wide), or down beside it (tall)
  const rule: Prim =
    family === 'wide'
      ? { t: 'line', a: [t.x, t.y], b: [t.x + t.w, t.y] }
      : { t: 'line', a: [t.x, t.y], b: [t.x, t.y + t.h] }
  const { at, k } = L.feet(r, poses.length)
  // the ground line the figures stand on, kept inside the card
  const x0 = family === 'wide' ? r.x : r.x
  const x1 = family === 'wide' ? r.x + r.w : t.x
  const ground: Prim = {
    t: 'line',
    a: [Math.max(x0 + 10, at[0]![0] - 26 * k), at[0]![1]],
    b: [Math.min(x1 - 10, at[at.length - 1]![0] + 26 * k), at[0]![1]],
  }
  const kids: SvgNode[] = []
  if (cad) {
    kids.push(
      clean([rectPrim(r)], id, i, strokeCls({ pen: '050', ink: 'cyan', fill: 'panel' })),
      clean([rule], `${id}.rule`, i, strokeCls({ pen: '025', ink: 'cyan-dim' })),
      clean([ground], `${id}.ground`, i, strokeCls({ pen: '018', ink: 'cyan-dim' })),
    )
  } else {
    kids.push(
      clean([rectPrim(r)], id, i, strokeCls({ fill: 'paper', draw: false })),
      ...rough([rectPrim(r)], seed('box'), id, i, strokeCls({ pen: '050', ink: 'pencil' }), 'box'),
      ...rough([rule], seed('rule'), `${id}.rule`, i, strokeCls({ pen: '025', ink: 'pencil' })),
      clean([ground], `${id}.ground`, i, strokeCls({ pen: '018', ink: 'pencil' })),
    )
  }
  const people = poses.flatMap((pose, j) =>
    partsNodes(placeSymbol(pose, at[j]!, { k, prefix: `${id}.p${j}` }), {
      variant: 'pencil',
      seed: seed(`p${j}`),
      i,
      ink: 'pencil',
    }),
  )
  return [group(id, kids, 'k-card'), group(`${id}.people`, people, 'person')]
}

function orgDoc(family: LayoutId, rev: OrgRev): SvgDoc {
  const L = ORG_LAYOUT[family]
  const children: SvgNode[] = []
  const pkts: SvgNode[] = []
  for (const c of cardsIn(rev)) children.push(...cardNodes(family, rev, c.id, c.slot, c.people))
  if (rev === 'chain') {
    const chain = cardsIn('chain').sort((a, b) => a.slot - b.slot)
    for (let j = 1; j < chain.length; j++) {
      const [a, b] = L.hop(L.card(chain[j - 1]!.slot), L.card(chain[j]!.slot))
      const id = `c${j}`
      const i = chain[j - 1]!.slot * 2 + 1
      const cls = strokeCls({ pen: '035', ink: 'pencil' })
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const seed = `org:${SEED}:${family}:${id}`
      children.push(
        group(
          id,
          [
            ...rough([{ t: 'line', a, b }], seed, id, i, cls),
            ...rough([arrowhead(a, b)], `${seed}:arrow`, id, i, cls),
            clean(paperGlyph(mid), id, i, strokeCls({ fill: 'paper', draw: false })),
            ...rough(paperGlyph(mid), `${seed}:paper`, id, i, cls),
          ],
          'k-hop',
        ),
      )
    }
  } else {
    const [a, b] = wireEnds(family)
    const pts = [a, b] as const
    const dim = wireDim(family, a, b)
    const tick = (c: Pt): Prim => ({
      t: 'line',
      a: [c[0] - 5, c[1] + 5],
      b: [c[0] + 5, c[1] - 5],
    })
    children.push(
      group(
        'dim',
        [
          clean(
            [
              { t: 'line', a: dim.line[0], b: dim.line[1] },
              { t: 'line', a: dim.ext[0][0], b: dim.ext[0][1] },
              { t: 'line', a: dim.ext[1][0], b: dim.ext[1][1] },
            ],
            'dim',
            2,
            strokeCls({ pen: '018', ink: 'cyan-dim' }),
          ),
          clean(
            [tick(dim.line[0]), tick(dim.line[1])],
            'dim',
            2,
            strokeCls({ pen: '035', ink: 'cyan-dim' }),
          ),
        ],
        'k-dim',
      ),
    )
    const prim: Prim = { t: 'poly', pts }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const kids: SvgNode[] = [
      clean([prim], 'wire', 1, strokeCls({ pen: '070', ink: 'cyan' })),
      clean(flangePrims(pts), 'wire.flange', 1, strokeCls({ pen: '050', ink: 'cyan' })),
      clean(
        [
          { t: 'circle', c: a, r: 3 },
          { t: 'circle', c: b, r: 3 },
        ],
        'wire.port',
        1,
        strokeCls({ pen: '035', ink: 'cyan', fill: 'panel', draw: false }),
      ),
    ]
    for (let s = 60; s < len - 40; s += 120) {
      const c: Pt = [a[0] + dir[0] * s, a[1] + dir[1] * s]
      kids.push(
        clean([chevron(c, dir)], 'wire', 1, strokeCls({ pen: '035', ink: 'cyan', draw: false })),
      )
    }
    children.push(group('wire', kids, 'k-wire'))
    pkts.push({ el: 'g', part: 'wire', children: [packetNode({ prim, len }, 'wire', 1)] })
  }
  const groups: SvgDoc['groups'][number][] = [
    { layer: rev === 'ours' ? 'cad' : 'pencil', rev, children },
  ]
  if (pkts.length) groups.push({ layer: 'pkt', rev, children: pkts })
  return { viewBox: L.viewBox, groups }
}

export const drawing = flowBuilder((family, rev) => orgDoc(family, rev as OrgRev), ORG_CHART_STATES)
