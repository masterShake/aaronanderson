import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode, SymbolId } from '@/drawings/types'
import type { PresetId } from '@/drawings/kit/rough'
import { docsBuilder, graphDoc, partsNodes, pencil, type DocStateSpec } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { nodeRect } from '@/drawings/lib/route'
import { cloudPrim, packetPrim, placeSymbol } from '@/drawings/symbols'
import {
  TICKET_PENCIL_ONLY,
  TICKET_REVS,
  ticketGraph,
  type TicketRev,
} from '@/drawings/graphs/ticket'
import { TICKET_EXTRAS, ticketGeometry } from '@/drawings/views/ticket'
import { nodeGlyph, type Glyph } from './glyphs'

/**
 * The ticket drawing files served by /drawings/[file] (owner: how):
 *   ticket.{wide,tall}.json          every revision's layers, each group tagged data-rev
 *   ticket.{family}.rev{0-4}.still.svg  one baked still per revision (the mobile step stills)
 *
 * REV 0 is the pencil survey (layer pencil, shown in every revision). REV 1 to
 * REV 4 are each one CAD group: tracing paper (REV 1) or the deep panel (REV 2
 * on) over the right of the sheet, then the new route and that revision's
 * marks. A still stacks every revision up to its own, so the panel of the
 * latest one covers the earlier ones.
 */

const path = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})

const clean = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode =>
  path(
    prims.map(primD).join(''),
    prims.reduce((s, p) => s + primLength(p), 0),
    part,
    i,
    cls,
  )

const rough = (
  prims: readonly Prim[],
  seed: string,
  part: string,
  i: number,
  cls: string,
  preset: PresetId = 'line',
): SvgNode[] =>
  pencil(prims, { seed: seedFrom(`ticket:${seed}`), preset }).map((s) =>
    path(s.d, s.len, part, i, cls),
  )

const rect = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: [x, y],
  size: [w, h],
})
const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a, b })

/** Swap classes on every path of a node tree (blueprint ink on tracing paper, deep fills). */
function recolor(nodes: readonly SvgNode[], map: Readonly<Record<string, string>>): SvgNode[] {
  return nodes.map((n) =>
    n.el === 'path'
      ? { ...n, cls: n.cls.replace(/\S+/g, (c) => map[c] ?? c) }
      : { ...n, children: recolor(n.children, map) },
  )
}

const symbol = (id: SymbolId, at: Pt, k: number, prefix: string, i: number) =>
  partsNodes(placeSymbol(id, at, { k, prefix }), { variant: 'clean', seed: prefix, i })

function person(
  family: LayoutId,
  p: { id: string; symbol: SymbolId; feet: Pt; k: number },
  i: number,
): SvgNode {
  const parts = placeSymbol(p.symbol, p.feet, { k: p.k, prefix: p.id })
  return group(
    p.id,
    partsNodes(parts, { variant: 'pencil', seed: `ticket:${family}:${p.id}`, i, ink: 'pencil' }),
    'person',
  )
}

/** REV 0: the survey in pencil, plus the ticket's lines, the truck, the field lead and the tape. */
function asFound(family: LayoutId): SvgDoc {
  const g = ticketGraphFor(family)
  const doc = graphDoc(g, 'rev0', family, { medium: 'pencil', chevrons: 0 })
  const ex = TICKET_EXTRAS[family]
  const pen = strokeCls({ pen: '035', ink: 'pencil' })
  const faint = strokeCls({ pen: '018', ink: 'pencil' })
  const kids: SvgNode[] = [...doc.groups[0]!.children]

  // the ticket: a header block, a table of line items and a signature line
  const t = nodeRect(
    g.nodes.find((n) => n.id === 'ticket')!,
    family,
  )
  const doc0 = ticketDocument(t, family)
  kids.push(
    group('ticket.doc', [
      ...rough(doc0.outline, `${family}:doc`, 'ticket.doc', 0, pen),
      ...rough(doc0.detail, `${family}:doc.d`, 'ticket.doc', 0, faint),
    ]),
  )

  // each tool reads as the thing it names: a glyph in its box
  for (const n of g.nodes) {
    if (n.revs && !n.revs.includes('rev0')) continue
    const gl = nodeGlyph(n.id, nodeRect(n, family), family)
    if (!gl) continue
    kids.push(
      group(`${n.id}.glyph`, [
        ...rough(gl.outline, `${family}:${n.id}:g`, `${n.id}.glyph`, 0, pen),
        ...rough(gl.detail, `${family}:${n.id}:gd`, `${n.id}.glyph`, 0, faint),
      ]),
    )
  }

  // the truck: a cab and two wheels under the box
  const tr = nodeRect(
    g.nodes.find((n) => n.id === 'truck')!,
    family,
  )
  const r = family === 'wide' ? 11 : 7
  const truck: Prim[] = [
    { t: 'circle', c: [tr.x + r * 3, tr.y + tr.h], r },
    { t: 'circle', c: [tr.x + tr.w - r * 3, tr.y + tr.h], r },
    line([tr.x + tr.w - r * 6, tr.y], [tr.x + tr.w - r * 6, tr.y + tr.h]),
  ]
  kids.push(group('truck.cab', rough(truck, `${family}:truck`, 'truck.cab', 0, pen)))

  // the tape measure under the count
  const [x, y, w, h] = ex.tape
  if (w > 0) {
    const ticks: Prim[] = [rect(x, y, w, h)]
    for (let i = 1; i * 12 < w; i++)
      ticks.push(line([x + i * 12, y], [x + i * 12, y + (i % 2 ? h / 3 : h / 2)]))
    kids.push(group('tape', rough(ticks, `${family}:tape`, 'tape', 0, faint)))
  }

  for (const p of ex.people.filter((q) => q.id === 'lead')) kids.push(person(family, p, 0))
  return { viewBox: ex.viewBox, groups: [{ layer: 'pencil', rev: 'rev0', children: kids }] }
}

type R = { x: number; y: number; w: number; h: number }

/**
 * The delivery ticket as a document: a header block (number, date, job),
 * a table of line items (quantity, item, unit) with short strokes for the
 * entries, and a signature line with its X and a signature. Wide leaves the
 * lower left clear for the status stamp (HTML).
 */
export function ticketDocument(t: R, family: LayoutId): Glyph {
  const wide = family === 'wide'
  const pad = wide ? 12 : 8
  const x0 = t.x + pad
  const x1 = t.x + t.w - pad
  const iw = x1 - x0
  // tall: the name may take two rows above the header block
  const hy = t.y + (wide ? 38 : 46)
  const hh = wide ? 24 : 14
  const ty = hy + hh + (wide ? 8 : 6)
  const th = wide ? 48 : 34
  const rowH = (th - (wide ? 16 : 10)) / 3
  const outline: Prim[] = [rect(x0, hy, iw, hh), rect(x0, ty, iw, th)]
  const detail: Prim[] = [
    line([x0 + iw * 0.42, hy], [x0 + iw * 0.42, hy + hh]),
    line([x0 + iw * 0.72, hy], [x0 + iw * 0.72, hy + hh]),
    line([x0, ty + th - rowH * 3], [x1, ty + th - rowH * 3]),
    line([x0 + iw * 0.16, ty], [x0 + iw * 0.16, ty + th]),
    line([x0 + iw * 0.76, ty], [x0 + iw * 0.76, ty + th]),
  ]
  for (let i = 0; i < 3; i++) {
    const ry = ty + th - rowH * (3 - i) + rowH / 2
    if (i > 0) detail.push(line([x0, ty + th - rowH * (3 - i)], [x1, ty + th - rowH * (3 - i)]))
    detail.push(line([x0 + iw * 0.04, ry], [x0 + iw * 0.1, ry]))
    detail.push(line([x0 + iw * 0.2, ry], [x0 + iw * (0.5 + ((i * 13) % 3) * 0.07), ry]))
    detail.push(line([x0 + iw * 0.8, ry], [x0 + iw * 0.92, ry]))
  }
  // the header cells carry a short entry each
  for (const [a, b] of [
    [0.05, 0.3],
    [0.47, 0.64],
    [0.77, 0.94],
  ] as const)
    detail.push(line([x0 + iw * a, hy + hh * 0.6], [x0 + iw * b, hy + hh * 0.6]))
  // the signature line, its X and the signature
  const sy = t.y + t.h - (wide ? 16 : 10)
  const sx = x0 + iw * (wide ? 0.66 : 0.36)
  detail.push(line([sx, sy], [x1, sy]))
  const xs = wide ? 4 : 3
  detail.push(line([sx - xs * 2.5, sy - xs * 2.5], [sx - xs * 0.5, sy - xs * 0.5]))
  detail.push(line([sx - xs * 0.5, sy - xs * 2.5], [sx - xs * 2.5, sy - xs * 0.5]))
  outline.push({
    t: 'cubic',
    a: [sx + 4, sy - 3],
    c1: [sx + iw * 0.12, sy - (wide ? 20 : 12)],
    c2: [sx + iw * 0.14, sy + 2],
    b: [sx + iw * 0.28, sy - (wide ? 10 : 6)],
  })
  return { outline, detail }
}

/** The ticket graph laid out for a family, with the valve drawn by hand on its branch. */
function ticketGraphFor(family: LayoutId) {
  const g = ticketGeometry(family).graph
  return { ...g, routes: g.routes.map((r) => (r.id === 'n2' ? { ...r, valve: false } : r)) }
}

/** The tail of an orthogonal polyline that lies inside a rect, cut where it enters. */
function clip(pts: readonly Pt[], [x, y, w, h]: readonly [number, number, number, number]): Pt[] {
  const inside = (p: Pt) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h
  const out: Pt[] = []
  for (let k = pts.length - 1; k >= 0; k--) {
    const p = pts[k]!
    if (inside(p)) {
      out.unshift(p)
      continue
    }
    const q = out[0]
    if (q) {
      const cx = Math.min(Math.max(p[0], x), x + w)
      const cy = Math.min(Math.max(p[1], y), y + h)
      out.unshift(p[0] === q[0] ? [p[0], cy] : [cx, p[1]])
    }
    break
  }
  return out
}

const INK_ON_PAPER = { 'i-cyan': 'i-cad', 'i-cyan-dim': 'i-cad', 'f-panel': 'f-paper' }
const INK_ON_DEEP = { 'f-panel': 'f-deep', 'f-paper': 'f-deep' }

/** REV 1 to REV 4: the panel, the new route and that revision's marks, in one CAD group. */
function rewired(family: LayoutId, rev: TicketRev): SvgDoc {
  const g = ticketGraphFor(family)
  const geo = ticketGeometry(family)
  const ex = TICKET_EXTRAS[family]
  const n = TICKET_REVS.indexOf(rev)
  const k = ex.k
  const doc = graphDoc(g, rev, family, { medium: 'cad', chevrons: 0 })
  const route = doc.groups[0]!.children.filter(
    (c) => !(c.el === 'g' && c.part && TICKET_PENCIL_ONLY.includes(c.part)),
  )
  const cyan = (pen: '018' | '035' | '050' | '070') => strokeCls({ pen, ink: 'cyan' })

  // the tolerance dial on the line, and the exception branch down to the valve
  const marks: SvgNode[] = [
    group(
      'tolerance',
      symbol('sym.tolerance', [geo.tolerance[0], geo.tolerance[1] - 8 * k], k, 'tolerance', 1),
    ),
    group('branch', [clean([{ t: 'poly', pts: geo.branch, r: 8 }], 'branch', 2, cyan('050'))]),
    group(
      'valve',
      symbol('sym.hv-valve', [geo.valve[0], geo.valve[1] - 8 * k], k, 'valve', 3),
      'valve',
    ),
  ]
  // the new tools read as what they are: a glyph in each box
  for (const id of ['match', 'acct', 'job']) {
    const node = g.nodes.find((x) => x.id === id)
    const gl = node && nodeGlyph(id, nodeRect(node, family), family)
    if (gl)
      marks.push(
        group(`${id}.glyph`, [
          clean(gl.outline, `${id}.glyph`, 3, cyan('050')),
          clean(gl.detail, `${id}.glyph`, 3, strokeCls({ pen: '025', ink: 'cyan' })),
        ]),
      )
  }
  const body = recolor([...route, ...marks], n === 1 ? INK_ON_PAPER : INK_ON_DEEP)

  const [zx, zy, zw, zh] = ex.zone
  const panel =
    n === 1
      ? clean(
          [rect(zx, zy, zw, zh)],
          'zone',
          0,
          strokeCls({ pen: '018', ink: 'pencil', fill: 'paper', draw: false, extra: 'o-55' }),
        )
      : clean([rect(zx, zy, zw, zh)], 'zone', 0, strokeCls({ fill: 'deep', draw: false }))
  const kids: SvgNode[] = [panel]

  // REV 2: the old route still runs beside the new one (PARALLEL RUN). Its tools are the real
  // ones, drawn in the dim pen with their glyphs (names are HTML); the hand-offs between them
  // stay dashed, and the photo's hand-off comes in from the paper side.
  if (n === 2) {
    const dimOut = strokeCls({ pen: '035', ink: 'cyan-dim', fill: 'deep', draw: false })
    const dimDetail = strokeCls({ pen: '018', ink: 'cyan-dim', draw: false })
    const dash = strokeCls({ pen: '025', ink: 'cyan-dim', dash: 'hidden', draw: false })
    const old: SvgNode[] = []
    for (const id of ['r3', 'r4', 'r5', 'r6'])
      old.push(clean([{ t: 'poly', pts: geo.old.get(id)!.pts }], `old.${id}`, 0, dash))
    const onPanel = clip(geo.old.get('r2')!.pts, ex.zone)
    if (onPanel.length > 1) old.push(clean([{ t: 'poly', pts: onPanel }], 'old.r2', 0, dash))
    for (const id of ['pm', 'inbox', 'office', 'po', 'accounting', 'jobCost']) {
      const rc = nodeRect(
        g.nodes.find((x) => x.id === id)!,
        family,
      )
      old.push(clean([rect(rc.x, rc.y, rc.w, rc.h)], `old.${id}`, 0, dimOut))
      const gl = nodeGlyph(id, rc, family)
      if (gl) {
        old.push(clean(gl.outline, `old.${id}.glyph`, 0, dimOut))
        old.push(clean(gl.detail, `old.${id}.glyph`, 0, dimDetail))
      }
    }
    kids.push(group('parallel', old, 'erase'))
  }
  kids.push(...body)

  // the person at the valve (a cut-out on the panel)
  for (const p of ex.people.filter((q) => q.id === 'signer')) kids.push(person(family, p, 4))

  // REV 1: the client's markup, a redline cloud around the sign-off
  if (n === 1) {
    const [x, y, w, h] = ex.cloud
    const c = cloudPrim({ x, y, w, h }, { seed: seedFrom(`ticket:${family}:cloud`) })
    kids.push(
      group(
        'cloud',
        rough(
          [c],
          `${family}:cloud`,
          'cloud',
          5,
          strokeCls({ pen: '050', ink: 'redline' }),
          'cloud',
        ),
      ),
    )
  }

  // REV 2: three test packets run the line once
  if (n === 2)
    kids.push(
      group(
        'packets',
        geo.packets.map((p, i) =>
          clean(
            [packetPrim(p)],
            `packet.${i}`,
            i,
            strokeCls({ pen: '100', ink: 'orange', draw: false, extra: 'pkt' }),
          ),
        ),
      ),
    )

  // REV 3 on: the hand-over documents
  if (n >= 3)
    kids.push(
      group(
        'docs',
        ex.docs.map(([key, [x, y, w, h], deg], i) => ({
          el: 'g' as const,
          part: `doc.${i}`,
          cls: 'doc',
          transform: `rotate(${deg} ${x + w / 2} ${y + h / 2})`,
          children: [
            clean(
              [
                {
                  t: 'poly',
                  pts: [
                    [x, y],
                    [x + w - 14, y],
                    [x + w, y + 14],
                    [x + w, y + h],
                    [x, y + h],
                  ],
                  closed: true,
                },
                line([x + w - 14, y], [x + w - 14, y + 14]),
                line([x + w - 14, y + 14], [x + w, y + 14]),
              ],
              String(key),
              6 + i,
              strokeCls({ pen: '035', ink: 'cyan', fill: 'paper' }),
            ),
          ],
        })),
      ),
    )

  // REV 4: the monitor watching the line, and the flange that failed and was fixed
  if (n === 4) {
    const [mx, my] = geo.monitor
    kids.push(
      group('monitor', [
        clean(
          [line([mx, my + 14 * k], geo.watch)],
          'signal',
          9,
          strokeCls({ pen: '018', ink: 'cyan-dim', dash: 'signal', draw: false }),
        ),
        ...recolor(symbol('sym.monitor', [mx, my], k, 'monitor', 9), INK_ON_DEEP),
      ]),
    )
    const [fx, fy] = geo.flange
    const s = 9 * k
    kids.push(
      group('flange', [
        clean(
          [line([fx - 3, fy - s], [fx - 3, fy + s]), line([fx + 3, fy - s], [fx + 3, fy + s])],
          'flange',
          10,
          strokeCls({ pen: '070', ink: 'orange', extra: 'pulse' }),
        ),
      ]),
    )
  }
  return { viewBox: ex.viewBox, groups: [{ layer: 'cad', rev, children: kids }] }
}

/** Every revision; a still stacks the revisions up to its own (ghost 1 keeps them at full ink). */
export const TICKET_STATES: readonly DocStateSpec[] = TICKET_REVS.map((rev, i) => ({
  rev,
  ground: 'paper',
  ...(i > 0 ? { ghost: 1 } : {}),
}))

export const drawing = docsBuilder(
  (family, rev) => (rev === 'rev0' ? asFound(family) : rewired(family, rev as TicketRev)),
  TICKET_STATES,
)

/** For the unit check: the graph is the counted one, untouched by the drawing tweaks. */
export const ticketCountsGraph = ticketGraph
