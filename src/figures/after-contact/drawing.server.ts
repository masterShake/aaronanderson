import 'server-only'
import type { DrawingBuilder, LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { docsBuilder } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { primD } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { arrowhead, chevron } from '@/drawings/symbols'
import {
  AFTER_CONTACT_NODES,
  AFTER_CONTACT_VIEWBOX,
  type AfterContactNode,
} from '@/drawings/graphs/after-contact'
import {
  calendar,
  envelope,
  flange,
  handset,
  lineP,
  rectP,
  signedSheet,
  type Glyph,
} from '@/figures/ticket/glyphs'

/**
 * The after-contact drawing files served by /drawings/[file] (owner: howcontact):
 *   after-contact.{wide,tall}.json and .{family}.flow.still.svg  the four-node flow, CAD on deep
 *   after-contact.wide.received.still.svg                        the success drawing in the form
 *
 * Draw order (--i, after-contact.module.css staggers on it): the four
 * enclosures (0–3), their glyphs and name plates (4–7), our two conduits
 * (8–9), then the join from your node to ours (11). A record (orange) runs the
 * route behind the enclosures, so it shows only on the conduits, and the
 * signature on the written next step inks in orange when it arrives.
 */

const path = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  cls,
})

const BOX = strokeCls({ pen: '070', ink: 'cyan', fill: 'deep' })
const GLYPH = strokeCls({ pen: '050', ink: 'cyan', fill: 'deep' })
const DETAIL = strokeCls({ pen: '035', ink: 'cyan' })
const PLATE = strokeCls({ pen: '018', ink: 'cyan-dim' })
const PIPE = strokeCls({ pen: '070', ink: 'cyan' })
const FLANGE = strokeCls({ pen: '050', ink: 'cyan' })

function glyphFor(n: AfterContactNode): { g: Glyph; sign?: Prim[] } {
  const [x, y, s] = n.glyph
  switch (n.id) {
    case 'you': {
      const cal = calendar([x - s * 0.26, y - s * 0.06], s * 0.62)
      const env = envelope([x + s * 0.3, y + s * 0.16], s * 0.5)
      return {
        g: { outline: [...cal.outline, ...env.outline], detail: [...cal.detail, ...env.detail] },
      }
    }
    case 'reply': {
      const env = envelope([x, y + s * 0.18], s * 0.8)
      // a reply arrow curving back over the envelope, its head pointing left
      const tip: Pt = [x - s * 0.36, y - s * 0.3]
      env.detail.push(
        {
          t: 'cubic',
          a: [x + s * 0.34, y - s * 0.12],
          c1: [x + s * 0.32, y - s * 0.42],
          c2: [x - s * 0.06, y - s * 0.44],
          b: tip,
        },
        arrowhead([x - s * 0.12, y - s * 0.4], tip, s * 0.16),
      )
      return { g: env }
    }
    case 'call':
      return { g: handset([x, y], s * 0.9) }
    case 'next': {
      const g = signedSheet([x, y], s)
      // the last detail prim is the signature: it inks in orange on arrival
      const sign = g.detail.pop()!
      return { g, sign: [sign] }
    }
  }
}

function nodeGroup(n: AfterContactNode, i: number): SvgNode {
  const [x, y, w, h] = n.box
  const { g, sign } = glyphFor(n)
  const [px, py, pw, ph] = n.plate
  const kids: SvgNode[] = [
    path([rectP(x, y, w, h)], `${n.id}.box`, i, BOX),
    path(g.outline, `${n.id}.glyph`, 4 + i, GLYPH),
    path(g.detail, `${n.id}.detail`, 4 + i, DETAIL),
    path([rectP(px, py, pw, ph)], `${n.id}.plate`, 4 + i, PLATE),
  ]
  if (sign)
    kids.push(
      path(sign, `${n.id}.sign`, 12, strokeCls({ pen: '050', ink: 'orange', extra: 'sign' })),
    )
  return group(n.id, kids)
}

function conduit(a: AfterContactNode, b: AfterContactNode, i: number, join: boolean): SvgNode {
  const h = a.out[1] === b.in[1]
  const dir = h ? 'h' : 'v'
  const step = (p: Pt, d: number): Pt => (h ? [p[0] + d, p[1]] : [p[0], p[1] + d])
  const mid: Pt = [(a.out[0] + b.in[0]) / 2, (a.out[1] + b.in[1]) / 2]
  return group(
    `${a.id}-${b.id}`,
    [
      path([lineP(a.out, b.in)], `${a.id}-${b.id}.pipe`, i, PIPE),
      path(
        [...flange(step(a.out, 7), dir, 11), ...flange(step(b.in, -7), dir, 11)],
        `${a.id}-${b.id}.flanges`,
        i,
        FLANGE,
      ),
      path(
        [chevron(mid, h ? [1, 0] : [0, 1], 7)],
        `${a.id}-${b.id}.chevron`,
        i,
        strokeCls({ pen: '050', ink: 'cyan', draw: false }),
      ),
    ],
    join ? 'join' : undefined,
  )
}

function packet(family: LayoutId): SvgNode {
  const c = AFTER_CONTACT_NODES[family][3]!.stop
  const sheet: Prim = {
    t: 'poly',
    pts: [
      [c[0] - 7, c[1] - 9],
      [c[0] + 3, c[1] - 9],
      [c[0] + 7, c[1] - 5],
      [c[0] + 7, c[1] + 9],
      [c[0] - 7, c[1] + 9],
    ],
    closed: true,
  }
  return group('packet', [
    path(
      [sheet],
      'packet',
      0,
      strokeCls({ pen: '035', ink: 'orange', fill: 'orange', draw: false, extra: 'rec' }),
    ),
  ])
}

function flowDoc(family: LayoutId): SvgDoc {
  const vb = AFTER_CONTACT_VIEWBOX[family]
  const nodes = AFTER_CONTACT_NODES[family]
  const [you, reply, call, next] = nodes as [
    AfterContactNode,
    AfterContactNode,
    AfterContactNode,
    AfterContactNode,
  ]
  return {
    viewBox: vb,
    groups: [
      {
        layer: 'panel',
        rev: 'flow',
        children: [
          path([rectP(0, 0, vb[2], vb[3])], 'panel', 0, strokeCls({ fill: 'deep', draw: false })),
        ],
      },
      {
        layer: 'cad',
        rev: 'flow',
        children: [
          conduit(reply, call, 8, false),
          conduit(call, next, 9, false),
          conduit(you, reply, 11, true),
          packet(family),
          ...nodes.map((n, i) => nodeGroup(n, i)),
        ],
      },
    ],
  }
}

const flow = docsBuilder((family) => flowDoc(family), [{ rev: 'flow', ground: 'deep' }])

// ── The success drawing in the form: your node joins ours ──────────────────

function receivedDoc(): SvgDoc {
  const vb = [0, 0, 480, 160] as const
  const node = (x: number, y: number, g: Glyph, id: string): SvgNode =>
    group(id, [
      path([rectP(x, y, 150, 80)], `${id}.box`, 0, BOX),
      path(g.outline, `${id}.glyph`, 1, GLYPH),
      path(g.detail, `${id}.detail`, 1, DETAIL),
    ])
  const ours = node(24, 36, envelope([140, 92], 34), 'ours')
  const theirs = node(306, 36, signedSheet([428, 90], 36), 'theirs')
  const a: Pt = [174, 76]
  const b: Pt = [306, 76]
  return {
    viewBox: vb,
    groups: [
      {
        layer: 'panel',
        rev: 'received',
        children: [
          path([rectP(0, 0, 480, 160)], 'panel', 0, strokeCls({ fill: 'deep', draw: false })),
        ],
      },
      {
        layer: 'cad',
        rev: 'received',
        children: [
          group('joins', [
            path([lineP(a, b)], 'joins', 2, PIPE),
            path(
              [...flange([181, 76], 'h', 11), ...flange([299, 76], 'h', 11)],
              'joins.flanges',
              2,
              FLANGE,
            ),
            path(
              [chevron([240, 76], [-1, 0], 7)],
              'joins.chevron',
              2,
              strokeCls({ pen: '050', ink: 'cyan', draw: false }),
            ),
          ]),
          ours,
          theirs,
        ],
      },
    ],
  }
}

const received = docsBuilder(() => receivedDoc(), [{ rev: 'received', ground: 'deep' }], ['wide'])

const RECEIVED_FILE = 'wide.received.still.svg'

export const drawing: DrawingBuilder = {
  files: [...flow.files, RECEIVED_FILE],
  build(file) {
    return file === RECEIVED_FILE ? received.build(file) : flow.build(file)
  },
}
