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
  S04_LAYOUT,
  S04_TILES,
  capsulePts,
  type Rect,
  type S04Reading,
} from '@/drawings/views/s04'

/**
 * The S-04 drawing files (owner: scenes-a), served by /drawings/[file]:
 *   s04.{family}.json        every layer
 *   s04.{family}.still.svg   the still tier: the panel with needles in IN RANGE, the
 *                            owner's report out, the five tiles ghosted in their cells
 *
 * Layers: l-panel (the deep panel the scan reveals), l-ghost (five pencil tiles; the
 * controller writes each tile's start offset and tilt), l-cad (the instrument panel, the
 * data store and its risers; needles point straight up, IN RANGE, and CSS turns them),
 * l-pkt (packets on the risers). Draw-on windows come from S04Figure.module.css.
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
const PENCIL = 'draw pv p-035 i-pencil'
/** Degrees from straight up (clockwise) to the arc primitive's angle. */
const deg = (fromUp: number) => fromUp - 90
const polar = (c: Pt, r: number, fromUp: number): Pt => {
  const a = (deg(fromUp) * Math.PI) / 180
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]
}
const INK: Readonly<Record<S04Reading, string>> = { low: 'alu-500', in: 'cad', check: 'redline' }

/** A filled ring sector from r0 to r1 between two angles (degrees clockwise from up). */
function sector(c: Pt, r0: number, r1: number, a: number, b: number): Prim {
  const p = (r: number, t: number) => polar(c, r, t).map((v) => Math.round(v * 100) / 100)
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

function doc(family: LayoutId): SvgDoc {
  const l = S04_LAYOUT[family]
  const [, , W, H] = l.viewBox
  const seed = (id: string) => seedFrom(`s04:${SEED}:${family}:${id}`)

  const tiles: SvgNode[] = S04_TILES.map((t, i) => {
    const [x, y, w, h] = l.tiles[t].at
    const pts: Pt[] = [0, 1, 2, 3, 4, 5].map((k) => [
      x + w * (0.1 + 0.15 * k),
      y + h * (0.78 - ((k * 37 + i * 11) % 5) * 0.1),
    ])
    const kids = [
      ...pencil([rect(l.tiles[t].at)], { seed: seed(t), preset: 'box' }).map((s) =>
        node(s.d, s.len, `tile.${t}`, i, `${PENCIL} w-sk`),
      ),
      ...pencil([{ t: 'poly', pts }], { seed: seed(`${t}.chart`), preset: 'scribble' }).map((s) =>
        node(s.d, s.len, `tile.${t}`, i, `${PENCIL} w-sc`),
      ),
    ]
    return { el: 'g', cls: 'tile pv e-machine', part: `tile.${t}`, children: kids }
  })

  const [px, py, pw, ph] = l.panel
  const cad: SvgNode[] = [clean([rect(l.panel)], 'panel', 0, 'p-050 i-cyan')]
  cad.push(
    clean(
      [
        { t: 'line', a: [px + pw / 3, py], b: [px + pw / 3, py + ph] },
        { t: 'line', a: [px + (2 * pw) / 3, py], b: [px + (2 * pw) / 3, py + ph] },
        { t: 'line', a: [px, py + ph / 2], b: [px + pw, py + ph / 2] },
      ],
      'cells',
      0,
      'p-025 i-cyan-dim',
    ),
  )
  S04_DIALS.forEach((d, i) => {
    const { c, r } = l.dials[d]
    // The gauge kit's geometry (runtime/kit/gauges.ts), so the WebGL plan pose matches:
    // bands are ring sectors 0.72r–0.86r, ticks 0.88r–0.98r, a 3-wide needle 0.82r long, hub r 3.
    // the face is the kit's 48-sided CircleGeometry, drawn as the same polygon
    const face: Prim = {
      t: 'poly',
      pts: Array.from({ length: 48 }, (_, k): Pt => [
        c[0] + r * Math.cos((Math.PI * k) / 24),
        c[1] + r * Math.sin((Math.PI * k) / 24),
      ]),
      closed: true,
    }
    // its rim: a 24-sided outline, as the scene draws it (fewer joins, a closer seam)
    const rim: Prim = {
      t: 'poly',
      pts: Array.from({ length: 24 }, (_, k): Pt => [
        c[0] + r * Math.cos((Math.PI * k) / 12),
        c[1] + r * Math.sin((Math.PI * k) / 12),
      ]),
      closed: true,
    }
    const kids: SvgNode[] = [
      clean([face], `dial.${d}`, i, 'f-paper'),
      clean([rim], `dial.${d}`, i, 'p-035 i-cyan'),
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
      return { t: 'line', a: polar(c, r * 0.88, a), b: polar(c, r * 0.98, a) }
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
    kids.push({
      el: 'g',
      cls: 'needle',
      part: `needle.${d}`,
      children: [clean([needle], `needle.${d}`, i, 'f-asphalt')],
    })
    kids.push(clean([{ t: 'circle', c, r: 3 }], `hub.${d}`, i, 'f-asphalt'))
    cad.push(group(`dial.${d}`, kids))
  })
  cad.push(clean([rect(l.printer)], 'printer', 0, 'f-asphalt'))
  cad.push(clean([rect(l.slot)], 'slot', 0, 'f-asphalt'))
  cad.push(clean([rect(l.nameplate)], 'nameplate', 0, 'p-035 i-cyan f-alu-300'))
  cad.push({
    el: 'g',
    cls: 'card',
    part: 'card',
    children: [clean([rect(l.card)], 'card', 0, 'p-035 i-asphalt f-paper')],
  })
  const [tx, ty, tw, th] = l.tank
  cad.push(
    group('tank', [
      clean([capsule(l.tank)], 'tank', 0, 'draw pv w-tk p-050 i-cyan'),
      clean(
        [rect([tx + tw * 0.8, ty + th * 0.2, tw * 0.04, th * 0.6])],
        'tank',
        0,
        'draw pv w-tk p-035 i-cyan',
      ),
      clean(
        [rect([tx + tw * 0.8, ty + th * 0.4, tw * 0.04, th * 0.4])],
        'tank',
        0,
        'pv fade w-tk f-cyan-dim',
      ),
    ]),
  )
  l.risers.forEach(([a, b], i) =>
    cad.push(clean([{ t: 'line', a, b }], `riser.${i}`, i + 1, 'draw pv w-tk p-070 i-cyan')),
  )

  const pkt = l.risers.map(([a, b], i) =>
    clean([{ t: 'line', a, b }], `pk.${i}`, 0, 'pk p-100 i-orange'),
  )

  return {
    viewBox: l.viewBox,
    groups: [
      { layer: 'panel', children: [node(`M0 0H${W}V${H}H0Z`, 0, 'panel', 0, 'f-deep')] },
      { layer: 'ghost', children: tiles },
      { layer: 'cad', children: cad },
      { layer: 'pkt', children: pkt },
    ],
  }
}

const cache = new Map<LayoutId, SvgDoc>()
const docOf = (f: LayoutId) => {
  let d = cache.get(f)
  if (!d) cache.set(f, (d = doc(f)))
  return d
}

export const drawing: DrawingBuilder = {
  files: ['wide.json', 'tall.json', 'wide.still.svg', 'tall.still.svg'],
  build(file) {
    const family: LayoutId = file.startsWith('tall') ? 'tall' : 'wide'
    const d = docOf(family)
    if (file.endsWith('.json')) return JSON.stringify(bundle(d))
    return toStillSvg(
      d,
      { k: STILL_K[family], ground: 'deep', remap: { panel: 'deep' }, opacity: { ghost: 0.22 } },
      ['panel', 'ghost', 'cad'],
    )
  },
}
