import 'server-only'
import type { DrawingBuilder, LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { docsBuilder, partsNodes, type DocStateSpec } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { primD } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { placeSymbol, symbolDef } from '@/drawings/symbols'
import { VALVE_LAYOUT, wheelCentre } from '@/drawings/views/valve'
import { cabinet, envelope, flange, lineP, rectP, type Glyph } from '@/figures/ticket/glyphs'

/**
 * The sign-off detail's drawing files served by /drawings/[file] (owner: howcontact):
 *   valve.{wide,tall}.json and valve.{family}.final.still.svg
 *
 * One state, drawn at its final frame (D8: the base is the finished drawing).
 * Draw order, written as --i (valve.module.css staggers on it): structure
 * (0–5: in-tray, reader, gauge, valve, cabinet, logbook), connections (6–8:
 * the line, the branch, the flanges), details (9–15), then the person. Pens:
 * outlines 070, details 035, hatch and leaders 018 (finish standard B2).
 * Packets live in the pkt layer of the bundle only; the still shows the drawing
 * at rest. No text: labels and the logbook lines are HTML.
 */

const path = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  cls,
})

const OUTLINE = strokeCls({ pen: '070', ink: 'cyan' })
const OUTLINE_FILLED = strokeCls({ pen: '070', ink: 'cyan', fill: 'deep' })
const DETAIL = strokeCls({ pen: '035', ink: 'cyan' })
const THIN = strokeCls({ pen: '018', ink: 'cyan-dim' })
const FLANGE = strokeCls({ pen: '050', ink: 'cyan' })

/** A glyph inked with the outline and detail pens. */
const glyph = (g: Glyph, part: string, i: number, d = i): SvgNode[] => [
  path(g.outline, part, i, OUTLINE_FILLED),
  path(g.detail, `${part}.detail`, d, DETAIL),
]

function ellipse(c: Pt, rx: number, ry: number, n = 28): Prim {
  return {
    t: 'poly',
    pts: Array.from(
      { length: n },
      (_, k) =>
        [
          Math.round((c[0] + rx * Math.cos((2 * Math.PI * k) / n)) * 100) / 100,
          Math.round((c[1] + ry * Math.sin((2 * Math.PI * k) / n)) * 100) / 100,
        ] as Pt,
    ),
    closed: true,
  }
}

const at = (c: Pt, deg: number, r: number): Pt => [
  Math.round((c[0] + r * Math.cos((deg * Math.PI) / 180)) * 100) / 100,
  Math.round((c[1] + r * Math.sin((deg * Math.PI) / 180)) * 100) / 100,
]

const placed = (c: Pt, rot: number, part: string, children: SvgNode[], cls?: string): SvgNode => ({
  el: 'g',
  part,
  ...(cls ? { cls } : {}),
  transform: `translate(${c[0]} ${c[1]})${rot ? ` rotate(${rot})` : ''}`,
  children,
})

/** The in-tray: sheets standing in it, the box, its feed slot and an envelope plate. */
function tray(family: LayoutId): SvgNode {
  const [x, y, w, h] = VALVE_LAYOUT[family].tray
  const sheets: SvgNode[] = [0, 1, 2].map((n) => {
    const sx = x + w * 0.16 + n * 10
    const sy = y - 34 + n * 8
    return path(
      [rectP(sx, sy, w * 0.56, 44)],
      `tray.sheet${n}`,
      9,
      strokeCls({ pen: '035', ink: 'cyan', fill: 'deep' }),
    )
  })
  const rules: Prim[] = [0, 1, 2].flatMap((n) => {
    const sx = x + w * 0.16 + n * 10
    const sy = y - 34 + n * 8
    return n === 2 ? [lineP([sx + 8, sy + 9], [sx + w * 0.56 - 12, sy + 9])] : []
  })
  const env = envelope([x + w / 2, y + h * 0.6], Math.min(w, h) * 0.44)
  return group('tray', [
    ...sheets,
    path(rules, 'tray.rules', 9, DETAIL),
    path([rectP(x, y, w, h)], 'tray.box', 0, OUTLINE_FILLED),
    path(
      [lineP([x + 14, y + 12], [x + w - 14, y + 12]), ...env.outline, ...env.detail],
      'tray.detail',
      9,
      DETAIL,
    ),
  ])
}

/** The AI reader: a housing with a lens looking down at a sight window in the line. */
function reader(family: LayoutId): SvgNode {
  const { c, rot } = VALVE_LAYOUT[family].reader
  return placed(c, rot, 'reader', [
    path(
      [rectP(-40, -88, 80, 52), rectP(-10, -36, 20, 10), rectP(-26, -8, 52, 16)],
      'reader.body',
      1,
      OUTLINE_FILLED,
    ),
    path(
      [
        { t: 'circle', c: [0, -62], r: 16 },
        { t: 'circle', c: [0, -62], r: 10 },
        { t: 'arc', c: [0, -62], r: 6, from: 200, to: 250 },
        lineP([-34, -80], [-24, -80]),
        lineP([24, -80], [34, -80]),
      ],
      'reader.lens',
      10,
      DETAIL,
    ),
    path(
      [lineP([-6, -26], [-18, -8]), lineP([6, -26], [18, -8])],
      'reader.beam',
      10,
      strokeCls({ pen: '018', ink: 'cyan-dim', dash: 'hidden', draw: false }),
    ),
  ])
}

/** The tolerance gauge: bezel, ticks, the IN RANGE band, the needle; a stem to the tap. */
function gauge(family: LayoutId): SvgNode[] {
  const { c, r, tap } = VALVE_LAYOUT[family].gauge
  const vertical = tap[0] === c[0]
  const stem: Prim[] = vertical
    ? [lineP([c[0], c[1] + r], [tap[0], tap[1] - 8]), rectP(tap[0] - 9, tap[1] - 8, 18, 16)]
    : [lineP([c[0] - r, c[1]], [tap[0] + 8, tap[1]]), rectP(tap[0] - 8, tap[1] - 9, 16, 18)]
  const ticks: Prim[] = []
  for (let k = 0; k <= 8; k++) {
    const deg = 200 + (140 * k) / 8
    ticks.push(lineP(at(c, deg, r * (k % 4 === 0 ? 0.62 : 0.7)), at(c, deg, r * 0.82)))
  }
  return [
    group('gauge', [
      path(stem, 'gauge.stem', 2, OUTLINE_FILLED),
      path([{ t: 'circle', c, r }], 'gauge.bezel', 2, OUTLINE_FILLED),
      path([{ t: 'circle', c, r: r * 0.86 }, ...ticks], 'gauge.ticks', 11, DETAIL),
      path(
        [
          {
            t: 'poly',
            pts: [
              ...Array.from({ length: 9 }, (_, k) => at(c, 242 + k * 7, r * 0.56)),
              ...Array.from({ length: 9 }, (_, k) => at(c, 298 - k * 7, r * 0.42)),
            ],
            closed: true,
          },
        ],
        'gauge.band',
        11,
        strokeCls({ pen: '035', ink: 'cyan-dim', fill: 'cyan-dim' }),
      ),
    ]),
    group('needle', [
      path(
        [lineP(at(c, 90, r * 0.16), at(c, 270, r * 0.7))],
        'needle.hand',
        11,
        strokeCls({ pen: '070', ink: 'orange', draw: false }),
      ),
      path(
        [{ t: 'circle', c, r: 3.5 }],
        'needle.pivot',
        11,
        strokeCls({ pen: '035', ink: 'orange', fill: 'orange', draw: false }),
      ),
    ]),
  ]
}

/** The sign-off valve: necks, globe body, bonnet, gland and stem; the handwheel apart (it turns). */
function valve(family: LayoutId): SvgNode[] {
  const { c, rot } = VALVE_LAYOUT[family].valve
  const body = placed(c, rot, 'valve', [
    path(
      [
        rectP(-32, -9, 14, 18),
        rectP(18, -9, 14, 18),
        { t: 'circle', c: [0, 0], r: 18 },
        rectP(-10, -38, 20, 20),
        rectP(-6, -46, 12, 8),
      ],
      'valve.body',
      3,
      OUTLINE_FILLED,
    ),
    path(
      [
        lineP([0, -46], [0, -52]),
        lineP([-10, -24], [10, -24]),
        { t: 'circle', c: [-6, -31], r: 1.5 },
        { t: 'circle', c: [6, -31], r: 1.5 },
        lineP([-8, 0], [8, 0]),
      ],
      'valve.detail',
      12,
      DETAIL,
    ),
    path([...flange([-35, 0], 'h', 15), ...flange([35, 0], 'h', 15)], 'valve.flanges', 8, FLANGE),
  ])
  const w = wheelCentre(family)
  const horizontal = rot === 0
  const rim = horizontal ? ellipse(w, 26, 6) : ellipse(w, 6, 26)
  const spoke = horizontal
    ? lineP([w[0] - 26, w[1]], [w[0] + 26, w[1]])
    : lineP([w[0], w[1] - 26], [w[0], w[1] + 26])
  const wheel: SvgNode = {
    el: 'g',
    part: 'wheel',
    cls: 'wheel',
    children: [
      path([rim], 'wheel.rim', 12, strokeCls({ pen: '070', ink: 'orange', fill: 'deep' })),
      path(
        [spoke, { t: 'circle', c: w, r: 3 }],
        'wheel.hub',
        12,
        strokeCls({ pen: '035', ink: 'orange' }),
      ),
    ],
  }
  return [body, wheel]
}

/** The person at the valve, facing it (mirrored), the hand on the wheel's rim. */
function person(family: LayoutId): SvgNode {
  const { hand, k } = VALVE_LAYOUT[family].person
  const def = symbolDef('fig.at-valve')
  const h = def.anchors!.hand!
  const f = def.anchors!.feet!
  const feet: Pt = [hand[0] + (h[0] - f[0]) * k, hand[1] - (h[1] - f[1]) * k]
  const parts = placeSymbol('fig.at-valve', feet, { k, prefix: 'signer' })
  return {
    el: 'g',
    part: 'signer',
    cls: 'person',
    transform: `translate(${2 * feet[0]} 0) scale(-1 1)`,
    children: partsNodes(parts, { variant: 'clean', seed: `valve:${family}:signer`, i: 14 }),
  }
}

function connections(family: LayoutId): SvgNode[] {
  const v = VALVE_LAYOUT[family]
  const [a, b] = v.line
  const h = a[1] === b[1]
  const dir = h ? 'h' : 'v'
  const along = (p: Pt, d: number): Pt => (h ? [p[0] + d, p[1]] : [p[0], p[1] + d])
  const rc = v.reader.c
  const joints: Prim[] = [
    ...flange(along(a, 8), dir, 12),
    ...flange(along(rc, -32), dir, 12),
    ...flange(along(rc, 32), dir, 12),
    ...flange(along(b, -8), dir, 12),
  ]
  const [t0, t1, , t3] = v.branch
  // the tee and the rejoin: a flange on the branch just off the line
  const off = (p: Pt, q: Pt, d: number): Pt => {
    const dx = Math.sign(q[0] - p[0])
    const dy = Math.sign(q[1] - p[1])
    return [p[0] + dx * d, p[1] + dy * d]
  }
  const bdir = (p: Pt, q: Pt) => (p[0] === q[0] ? 'v' : 'h')
  joints.push(...flange(off(t0!, t1!, 16), bdir(t0!, t1!), 11))
  const last = v.branch[v.branch.length - 1]!
  const prev = v.branch[v.branch.length - 2]!
  joints.push(...flange(off(last, prev, 16), bdir(last, prev), 11))
  void t3
  return [
    group('line', [path([lineP(a, b)], 'line', 6, OUTLINE)]),
    group('branch', [path([{ t: 'poly', pts: v.branch, r: 10 }], 'branch', 7, OUTLINE)]),
    group('joints', [
      path(joints, 'joints', 8, FLANGE),
      path(
        [
          { t: 'circle', c: t0!, r: 4 },
          { t: 'circle', c: last, r: 4 },
        ],
        'tees',
        8,
        strokeCls({ pen: '050', ink: 'cyan', fill: 'deep', draw: false }),
      ),
    ]),
  ]
}

/** The logbook card: a bound ledger, with a spine strip; the lines are HTML. */
function logbook(family: LayoutId): SvgNode {
  const [x, y, w, h] = VALVE_LAYOUT[family].logbook
  return group('logbook', [
    path(
      [rectP(x, y, w, h)],
      'logbook.card',
      5,
      strokeCls({ pen: '050', ink: 'cyan', fill: 'deep' }),
    ),
    path(
      [lineP([x + 6, y + 6], [x + 6, y + h - 6]), lineP([x + w - 1, y + 8], [x + w - 1, y + h])],
      'logbook.spine',
      15,
      THIN,
    ),
  ])
}

function cabinetNode(family: LayoutId): SvgNode {
  const [x, y, w, h] = VALVE_LAYOUT[family].cabinet
  const drawers = family === 'wide' ? 4 : 2
  return group('cabinet', glyph(cabinet(x, y, w, h, drawers), 'cabinet', 4, 13))
}

function leaders(family: LayoutId): SvgNode {
  return group(
    'leaders',
    VALVE_LAYOUT[family].leaders.map(([p, q], n) => path([lineP(p, q)], `leader${n}`, 16, THIN)),
  )
}

/** A packet: a small orange sheet, drawn at the cabinet inlet (where each record ends). */
function packets(family: LayoutId): SvgNode[] {
  const end = VALVE_LAYOUT[family].line[1]
  const c: Pt = family === 'wide' ? [end[0] - 18, end[1]] : [end[0], end[1] - 18]
  const sheet: Prim = {
    t: 'poly',
    pts: [
      [c[0] - 6, c[1] - 8],
      [c[0] + 3, c[1] - 8],
      [c[0] + 6, c[1] - 5],
      [c[0] + 6, c[1] + 8],
      [c[0] - 6, c[1] + 8],
    ],
    closed: true,
  }
  return [1, 2, 3, 4].map((n) =>
    path(
      [sheet],
      `pk.${n}`,
      n,
      strokeCls({ pen: '035', ink: 'orange', fill: 'orange', draw: false, extra: 'pk' }),
    ),
  )
}

function valveDoc(family: LayoutId, withPackets: boolean): SvgDoc {
  const v = VALVE_LAYOUT[family]
  const [, , w, h] = v.viewBox
  const panel: SvgNode[] = [
    path([rectP(0, 0, w, h)], 'panel', 0, strokeCls({ fill: 'deep', draw: false })),
  ]
  const cad: SvgNode[] = [
    ...connections(family),
    tray(family),
    reader(family),
    ...gauge(family),
    ...valve(family),
    cabinetNode(family),
    logbook(family),
    leaders(family),
    person(family),
  ]
  return {
    viewBox: v.viewBox,
    groups: [
      { layer: 'panel', rev: 'final', children: panel },
      { layer: 'cad', rev: 'final', children: cad },
      ...(withPackets ? [{ layer: 'pkt' as const, rev: 'final', children: packets(family) }] : []),
    ],
  }
}

export const VALVE_STATES: readonly DocStateSpec[] = [{ rev: 'final', ground: 'deep' }]

const live = docsBuilder((family) => valveDoc(family, true), VALVE_STATES)
const still = docsBuilder((family) => valveDoc(family, false), VALVE_STATES)

/** The bundle carries the packets; the stills show the drawing at rest, with no records in flight. */
export const drawing: DrawingBuilder = {
  files: live.files,
  build(file) {
    return file.endsWith('.still.svg') ? still.build(file) : live.build(file)
  },
}
