import 'server-only'
import type { DrawingBuilder, LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { STILL_K, bundle, pencil } from '@/drawings/render'
import { group } from '@/drawings/render/cad'
import { primD, seedFrom } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { toStillSvg } from '@/drawings/lib/svg-string'
import {
  S04_BANDS,
  S04_DIALS,
  S04_END,
  S04_LAYOUT,
  S04_NEEDLE,
  S04_TILES,
  capsulePts,
  type Rect,
  type S04Reading,
  type S04Tile,
} from '@/drawings/views/s04'

/**
 * The S-04 drawing files (owner: svc-b), served by /drawings/[file]:
 *   s04.{family}.json        every layer
 *   s04.{family}.still.svg   the still tier: the finished panel, needles on their end
 *                            readings (S04_END), the owner's report out. No pencil ghost.
 *
 * Layers: l-panel (the deep panel the scan reveals), l-ghost (five pencil tiles, each with
 * the glyph of the report it is: ledger, Gantt bars, time card, spreadsheet, pay list; the
 * controller writes each tile's start offset and tilt), l-cad (the instrument panel: three
 * gauges, a cost chart, an open items list and the report printer; the data store with its
 * saddles, sight glass and flanged risers; needles point straight up, IN RANGE, and CSS
 * turns them), l-pkt (packets on the risers). Draw-on windows come from S04Figure.module.css.
 */

const SEED = 404
const node = (d: string, len: number, part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d,
  len: Math.round(len * 100) / 100,
  part,
  i,
  cls,
})
const clean = (prims: readonly Prim[], part: string, i: number, cls: string) =>
  node(
    prims.map(primD).join(''),
    prims.reduce((s, p) => s + primLength(p), 0),
    part,
    i,
    cls,
  )
const rect = ([x, y, w, h]: Rect): Prim => ({ t: 'rect', at: [x, y], size: [w, h] })
const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a, b })
const PENCIL = 'draw pv p-035 i-pencil'
/** Degrees from straight up (clockwise) to the arc primitive's angle. */
const deg = (fromUp: number) => fromUp - 90
const polar = (c: Pt, r: number, fromUp: number): Pt => {
  const a = (deg(fromUp) * Math.PI) / 180
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]
}
const INK: Readonly<Record<S04Reading, string>> = { low: 'alu-500', in: 'cad', check: 'redline' }
const r2 = (n: number) => Math.round(n * 100) / 100

/** A filled ring sector from r0 to r1 between two angles (degrees clockwise from up). */
function sector(c: Pt, r0: number, r1: number, a: number, b: number): Prim {
  const p = (r: number, t: number) => polar(c, r, t).map(r2)
  const [ax, ay] = p(r1, a)
  const [bx, by] = p(r1, b)
  const [cx, cy] = p(r0, b)
  const [dx, dy] = p(r0, a)
  return {
    t: 'path',
    d: `M${ax} ${ay}A${r1} ${r1} 0 0 1 ${bx} ${by}L${cx} ${cy}A${r0} ${r0} 0 0 0 ${dx} ${dy}Z`,
    len: 0,
  }
}

/** The capsule as the same polygon the WebGL scene extrudes (views/s04 capsulePts). */
const capsule = (r: Rect): Prim => ({ t: 'poly', pts: capsulePts(r), closed: true })

/**
 * The glyph that says which report a pencil tile is, in the tile's lower part (its label
 * sits in the top band): a ledger, Gantt bars, a time card, a spreadsheet, a pay list.
 */
function glyph(t: S04Tile, [tx, ty, tw, th]: Rect): Prim[] {
  const x = tx + tw * 0.14
  const y = ty + th * 0.44
  const w = tw * 0.72
  const h = th * 0.44
  const X = (k: number) => x + w * k
  const Y = (k: number) => y + h * k
  switch (t) {
    case 'accounting':
      // a ledger: ruled lines, a money column, a double rule under the total
      return [
        ...[0, 0.22, 0.44, 0.66].map((k) => line([X(0), Y(k)], [X(1), Y(k)])),
        line([X(0.68), Y(0)], [X(0.68), Y(0.84)]),
        line([X(0.68), Y(0.86)], [X(1), Y(0.86)]),
        line([X(0.68), Y(0.96)], [X(1), Y(0.96)]),
      ]
    case 'pm':
      // Gantt bars on a time line
      return [
        rect([X(0), Y(0.02), w * 0.38, h * 0.14]),
        rect([X(0.24), Y(0.28), w * 0.44, h * 0.14]),
        rect([X(0.5), Y(0.54), w * 0.36, h * 0.14]),
        rect([X(0.7), Y(0.8), w * 0.3, h * 0.14]),
        line([X(0.6), Y(-0.06)], [X(0.6), Y(1)]),
      ]
    case 'timesheets':
      // a time card: day columns, three rows
      return [
        rect([X(0), Y(0), w, h]),
        ...[0.2, 0.4, 0.6, 0.8].map((k) => line([X(k), Y(0)], [X(k), Y(1)])),
        ...[0.33, 0.66].map((k) => line([X(0), Y(k)], [X(1), Y(k)])),
      ]
    case 'estimate':
      // a spreadsheet: a header row and a narrow first column
      return [
        rect([X(0), Y(0), w, h]),
        line([X(0), Y(0.2)], [X(1), Y(0.2)]),
        line([X(0), Y(0.22)], [X(1), Y(0.22)]),
        ...[0.46, 0.7].map((k) => line([X(0), Y(k)], [X(1), Y(k)])),
        ...[0.16, 0.58].map((k) => line([X(k), Y(0)], [X(k), Y(1)])),
      ]
    case 'payroll':
      // a pay list: a check box and a name line per row
      return [0, 0.34, 0.68].flatMap((k) => [
        rect([X(0), Y(k), h * 0.2, h * 0.2]),
        line([X(0.22), Y(k + 0.1)], [X(k === 0.34 ? 0.7 : 0.86), Y(k + 0.1)]),
      ])
  }
}

function doc(family: LayoutId, still: boolean): SvgDoc {
  const l = S04_LAYOUT[family]
  const [, , W, H] = l.viewBox
  const seed = (id: string) => seedFrom(`s04:${SEED}:${family}:${id}`)
  const big = family === 'wide'

  const tiles: SvgNode[] = S04_TILES.map((t, i) => {
    const kids = [
      ...pencil([rect(l.tiles[t].at)], { seed: seed(t), preset: 'box' }).map((s) =>
        node(s.d, s.len, `tile.${t}`, i, `${PENCIL} w-sk`),
      ),
      ...pencil(glyph(t, l.tiles[t].at), { seed: seed(`${t}.glyph`), preset: 'box' }).map((s) =>
        node(s.d, s.len, `tile.${t}`, i, `${PENCIL} w-sc`),
      ),
    ]
    return { el: 'g', cls: 'tile pv e-machine', part: `tile.${t}`, children: kids }
  })

  const [px, py, pw, ph] = l.panel
  const cad: SvgNode[] = [clean([rect(l.panel)], 'panel', 0, 'p-070 i-cyan')]
  cad.push(
    clean(
      [
        line([px + pw / 3, py], [px + pw / 3, py + ph]),
        line([px + (2 * pw) / 3, py], [px + (2 * pw) / 3, py + ph]),
        line([px, py + ph / 2], [px + pw, py + ph / 2]),
      ],
      'cells',
      0,
      'p-035 i-cyan',
    ),
  )
  // panel screws at the four corners
  const sc = big ? 4 : 2.5
  const inset = big ? 10 : 6
  cad.push(
    clean(
      (
        [
          [px + inset, py + inset],
          [px + pw - inset, py + inset],
          [px + pw - inset, py + ph - inset],
          [px + inset, py + ph - inset],
        ] as Pt[]
      ).map((c): Prim => ({ t: 'circle', c, r: sc })),
      'screws',
      0,
      'p-025 i-cyan',
    ),
  )

  S04_DIALS.forEach((d, i) => {
    const { c, r } = l.dials[d]
    // The gauge kit's geometry (runtime/kit/gauges.ts), so the WebGL plan pose matches:
    // bands are ring sectors 0.72r–0.86r, ticks 0.88r–0.98r, a 3-wide needle 0.82r long, hub r 3.
    const face: Prim = {
      t: 'poly',
      pts: Array.from({ length: 48 }, (_, k): Pt => [
        c[0] + r * Math.cos((Math.PI * k) / 24),
        c[1] + r * Math.sin((Math.PI * k) / 24),
      ]),
      closed: true,
    }
    const kids: SvgNode[] = [
      clean([{ t: 'circle', c, r: r * 1.1 }], `bezel.${d}`, i, 'p-070 i-cyan f-deep'),
      clean([face], `dial.${d}`, i, 'f-paper'),
      clean([face], `dial.${d}`, i, 'p-035 i-asphalt'),
    ]
    for (const [band, [a, b]] of Object.entries(S04_BANDS) as [
      S04Reading,
      readonly [number, number],
    ][])
      kids.push(
        clean([sector(c, r * 0.72, r * 0.86, a, b)], `band.${d}.${band}`, i, `f-${INK[band]}`),
      )
    const ticks: Prim[] = Array.from({ length: 9 }, (_, k) => {
      const a = -120 + 30 * k
      return line(polar(c, r * 0.88, a), polar(c, r * 0.98, a))
    })
    kids.push(clean(ticks, `ticks.${d}`, i, 'p-018 i-asphalt'))
    const needle: Prim = {
      t: 'poly',
      pts: [
        [c[0] - 1.5, c[1]],
        [c[0], c[1] - r * 0.82],
        [c[0] + 1.5, c[1]],
      ],
      closed: true,
    }
    const turn = still ? S04_NEEDLE[S04_END[d]] : 0
    kids.push({
      el: 'g',
      cls: 'needle',
      part: `needle.${d}`,
      ...(still ? { transform: `rotate(${turn} ${r2(c[0])} ${r2(c[1])})` } : {}),
      children: [clean([needle], `needle.${d}`, i, 'f-asphalt')],
    })
    kids.push(clean([{ t: 'circle', c, r: 3 }], `hub.${d}`, i, 'f-asphalt'))
    cad.push(group(`dial.${d}`, kids))
  })

  // cell 3: cost against the estimate, a drawn line chart (no numbers)
  {
    const [x, y, w, h] = l.chart
    const at = (u: number, v: number): Pt => [x + w * u, y + h * v]
    const est = (u: number) => 0.86 - 0.62 * u
    const act = [0, 0.02, -0.01, 0.04, 0.1, 0.2]
    const actual: Pt[] = act.map((o, k) => at(k / 5, est(k / 5) - o))
    cad.push(
      group('chart', [
        clean(
          [{ t: 'poly', pts: [at(0, 0), at(0, 1), at(1, 1)] }],
          'chart.axes',
          3,
          'p-035 i-cyan',
        ),
        clean(
          [0.25, 0.5, 0.75].map((v) => line(at(0, v), at(1, v))),
          'chart.grid',
          3,
          'p-018 i-cyan-dim',
        ),
        clean(
          [line(at(0, est(0)), at(1, est(1)))],
          'chart.estimate',
          3,
          'p-035 i-cyan-dim d-hidden',
        ),
        clean([{ t: 'poly', pts: actual }], 'chart.actual', 3, 'p-050 i-cyan'),
        clean([{ t: 'circle', c: actual[5]!, r: big ? 4 : 2.5 }], 'chart.end', 3, 'f-redline'),
      ]),
    )
  }

  // cell 4: open items, a drawn list (boxes, name lines; two done, one needs a look)
  {
    const [x, y, w, h] = l.list
    const b = Math.min(h * 0.14, big ? 14 : 9)
    const rows = [0.08, 0.34, 0.6, 0.86]
    const lens = [0.62, 0.48, 0.7, 0.4]
    const kids: SvgNode[] = []
    rows.forEach((v, k) => {
      const ry = y + h * v - b / 2
      kids.push(clean([rect([x, ry, b, b])], `list.box.${k}`, 4, 'p-035 i-cyan'))
      kids.push(
        clean(
          [line([x + b * 1.8, ry + b / 2], [x + b * 1.8 + (w - b * 1.8) * lens[k]!, ry + b / 2])],
          `list.line.${k}`,
          4,
          'p-035 i-cyan-dim',
        ),
      )
      if (k < 2)
        kids.push(
          clean(
            [
              {
                t: 'poly',
                pts: [
                  [x + b * 0.2, ry + b * 0.55],
                  [x + b * 0.42, ry + b * 0.8],
                  [x + b * 0.85, ry + b * 0.2],
                ],
              },
            ],
            `list.check.${k}`,
            4,
            'p-035 i-cyan',
          ),
        )
      if (k === 2)
        kids.push(
          clean(
            [
              {
                t: 'circle',
                c: [x + b * 1.8 + (w - b * 1.8) * lens[k]! + b * 0.9, ry + b / 2],
                r: b * 0.3,
              },
            ],
            `list.flag`,
            4,
            'f-redline',
          ),
        )
    })
    cad.push(group('list', kids))
  }

  // cell 5: the report printer, the last page it printed, and the owner's report it prints
  {
    const [x, y, w, h] = l.printer
    // last week's page, already out and a little skewed in the tray, so the cell is never an
    // empty slot: a header rule, written lines and a small bar row (the new report, with its
    // orange tab, slides out over it)
    const off = big ? 6 : 4
    const [lx, ly, lw, lh] = l.card
    const px0 = lx + off
    const py0 = ly + off * 0.5
    const P = (u: number, v: number): Pt => [px0 + lw * u, py0 + lh * v]
    cad.push(
      group('report.last', [
        clean([rect([px0, py0, lw, lh])], 'report.last', 5, 'p-035 i-asphalt f-paper'),
        clean([line(P(0.1, 0.16), P(0.62, 0.16))], 'report.last.head', 5, 'p-050 i-asphalt'),
        clean(
          [0.3, 0.42, 0.54].map((v, k) => line(P(0.1, v), P(k === 2 ? 0.58 : 0.86, v))),
          'report.last.lines',
          5,
          'p-018 i-asphalt',
        ),
        clean(
          [0.4, 0.65, 0.5, 0.8, 0.7].map((v, k) =>
            rect([
              px0 + lw * (0.12 + k * 0.15),
              py0 + lh * (0.9 - 0.22 * v),
              lw * 0.08,
              lh * 0.22 * v,
            ]),
          ),
          'report.last.bars',
          5,
          'p-018 i-asphalt',
        ),
        clean([line(P(0.08, 0.9), P(0.9, 0.9))], 'report.last.base', 5, 'p-018 i-asphalt'),
      ]),
    )
    cad.push(
      group('printer', [
        clean(
          [rect([x + w * 0.12, y - h * 0.3, w * 0.76, h * 0.3])],
          'printer.feed',
          5,
          'p-025 i-cyan-dim',
        ),
        clean([rect(l.printer)], 'printer', 5, 'p-050 i-cyan f-deep'),
        clean(
          [line([x + w * 0.08, y + h * 0.8], [x + w * 0.92, y + h * 0.8])],
          'printer.slot',
          5,
          'p-070 i-cyan',
        ),
        clean(
          [{ t: 'circle', c: [x + w * 0.88, y + h * 0.3], r: big ? 3.5 : 2 }],
          'printer.lamp',
          5,
          'f-cyan',
        ),
      ]),
    )
    const [cx, cy, cw, ch] = l.card
    const bars = [0.5, 0.75, 0.6, 0.9]
    cad.push({
      el: 'g',
      cls: 'card',
      part: 'card',
      children: [
        clean([rect(l.card)], 'card', 0, 'p-035 i-asphalt f-paper'),
        clean([rect([cx, cy, cw, ch * 0.12])], 'card.tab', 0, 'f-orange'),
        clean(
          bars.map((v, k) => {
            const bw = (cw * 0.7) / 4
            const bh = ch * 0.3 * v
            return rect([cx + cw * 0.15 + k * bw + bw * 0.15, cy + ch * 0.92 - bh, bw * 0.7, bh])
          }),
          'card.bars',
          0,
          'p-025 i-asphalt',
        ),
        clean(
          [line([cx + cw * 0.1, cy + ch * 0.92], [cx + cw * 0.9, cy + ch * 0.92])],
          'card.base',
          0,
          'p-018 i-asphalt',
        ),
      ],
    })
  }

  // the data store: a horizontal vessel with head seams, saddles, a sight glass with its
  // level and ticks, and a flange where each riser joins
  const [tx, ty, tw, th] = l.tank
  const r = th / 2
  const sad = big ? 16 : 10
  const fl = big ? 9 : 6
  const flH = big ? 4 : 3
  const glass: Rect = [tx + tw * 0.8, ty + th * 0.2, tw * 0.04, th * 0.6]
  cad.push(
    group('tank', [
      clean([capsule(l.tank)], 'tank', 0, 'draw pv w-tk p-070 i-cyan'),
      clean(
        [line([tx + r, ty], [tx + r, ty + th]), line([tx + tw - r, ty], [tx + tw - r, ty + th])],
        'tank.seams',
        1,
        'draw pv w-tk p-025 i-cyan-dim',
      ),
      clean(
        [0.24, 0.76].map((k): Prim => ({
          t: 'poly',
          pts: [
            [tx + tw * k - tw * 0.06, ty + th - th * 0.04],
            [tx + tw * k - tw * 0.08, ty + th + sad],
            [tx + tw * k + tw * 0.08, ty + th + sad],
            [tx + tw * k + tw * 0.06, ty + th - th * 0.04],
          ],
        })),
        'tank.saddles',
        2,
        'draw pv w-tk p-050 i-cyan',
      ),
      clean(
        [line([tx - tw * 0.04, ty + th + sad], [tx + tw * 1.04, ty + th + sad])],
        'tank.floor',
        2,
        'draw pv w-tk p-025 i-cyan-dim',
      ),
      clean([rect(glass)], 'tank.glass', 3, 'draw pv w-tk p-035 i-cyan'),
      clean(
        [0.25, 0.5, 0.75].map((k) =>
          line(
            [glass[0] + glass[2], glass[1] + glass[3] * k],
            [glass[0] + glass[2] * 1.8, glass[1] + glass[3] * k],
          ),
        ),
        'tank.ticks',
        3,
        'draw pv w-tk p-018 i-cyan',
      ),
      clean(
        [rect([glass[0], glass[1] + glass[3] * 0.34, glass[2], glass[3] * 0.66])],
        'tank.level',
        3,
        'pv fade w-tk f-cyan-dim',
      ),
    ]),
  )
  const bottom = py + ph
  l.risers.forEach(([a, b], i) => {
    const mid = (a[1] + b[1]) / 2
    cad.push(
      group(`riser.${i}`, [
        clean([line(a, b)], `riser.${i}`, i + 1, 'draw pv w-tk p-070 i-cyan'),
        clean(
          // at the tank, a bolted pair mid-run, and at the panel
          [ty - flH, mid - flH - 0.5, mid + 0.5, bottom].map((fy) =>
            rect([a[0] - fl, fy, fl * 2, flH]),
          ),
          `riser.${i}.flanges`,
          i + 1,
          'pv fade w-fl p-035 i-cyan f-deep',
        ),
      ]),
    )
  })

  const pkt = l.risers.map(([a, b], i) => clean([line(a, b)], `pk.${i}`, 0, 'pk p-100 i-orange'))

  return {
    viewBox: l.viewBox,
    groups: [
      { layer: 'panel', children: [node(`M0 0H${W}V${H}H0Z`, 0, 'panel', 0, 'f-deep')] },
      ...(still ? [] : [{ layer: 'ghost' as const, children: tiles }]),
      { layer: 'cad', children: cad },
      ...(still ? [] : [{ layer: 'pkt' as const, children: pkt }]),
    ],
  }
}

const cache = new Map<string, SvgDoc>()
const docOf = (f: LayoutId, still: boolean) => {
  const k = `${f}:${still}`
  let d = cache.get(k)
  if (!d) cache.set(k, (d = doc(f, still)))
  return d
}

export const drawing: DrawingBuilder = {
  files: ['wide.json', 'tall.json', 'wide.still.svg', 'tall.still.svg'],
  build(file) {
    const family: LayoutId = file.startsWith('tall') ? 'tall' : 'wide'
    if (file.endsWith('.json')) return JSON.stringify(bundle(docOf(family, false)))
    return toStillSvg(
      docOf(family, true),
      { k: STILL_K[family], ground: 'deep', remap: { panel: 'deep' } },
      ['panel', 'cad'],
    )
  },
}
