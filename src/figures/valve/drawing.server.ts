import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { docsBuilder, partsNodes, type DocStateSpec } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { primD } from '@/drawings/lib/geometry'
import { primLength } from '@/drawings/lib/length'
import { aiPrims, placeSymbol, tolerancePrims } from '@/drawings/symbols'
import { VALVE_LAYOUT } from '@/drawings/views/valve'

/**
 * The sign-off detail's drawing files served by /drawings/[file] (owner: how):
 *   valve.{wide,tall}.json and valve.{family}.final.still.svg
 * One state, drawn at its final frame (D8: the base is always the finished
 * drawing): the needle at the low mark, the wheel turned, packet 4 at the
 * valve and the first three at the system of record. valve.module.css plays
 * the sequence from the start. No text: labels and the logbook are HTML.
 */

const path = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => ({
  el: 'path',
  d: prims.map(primD).join(''),
  len: Math.round(prims.reduce((s, p) => s + primLength(p), 0) * 100) / 100,
  part,
  i,
  cls,
})

const rect = ([x, y, w, h]: readonly [number, number, number, number]): Prim => ({
  t: 'rect',
  at: [x, y],
  size: [w, h],
})
const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a, b })
const rot = ([x, y]: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]
}
const scaleAt = (c: Pt, prims: readonly Prim[], k: number): Prim[] =>
  prims.map((p) => {
    // tolerancePrims and aiPrims are authored at size 1 around c: scale about c
    const s = (q: Pt): Pt => [c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k]
    switch (p.t) {
      case 'line':
        return { t: 'line', a: s(p.a), b: s(p.b) }
      case 'arc':
        return { ...p, r: p.r * k }
      case 'circle':
        return { ...p, r: p.r * k }
      default:
        return p
    }
  })

/** Where the wheel sits: above the valve body, turned with it. */
export function wheelCentre(family: LayoutId): Pt {
  const v = VALVE_LAYOUT[family]
  const o = rot([0, -16 * v.k], v.valveDeg)
  return [v.valve[0] + o[0], v.valve[1] + o[1]]
}

function valveDoc(family: LayoutId): SvgDoc {
  const v = VALVE_LAYOUT[family]
  const [, , w, h] = v.viewBox
  const k = v.k
  const cyan = (pen: '035' | '050' | '070') => strokeCls({ pen, ink: 'cyan' })
  const panel: SvgNode[] = [
    path([rect([0, 0, w, h])], 'panel', 0, strokeCls({ fill: 'deep', draw: false })),
  ]

  const ai = aiPrims(v.ai)
  const tol = tolerancePrims(v.tolerance, 200)
  const dir: Pt = v.line[1][0] !== v.line[0][0] ? [1, 0] : [0, 1]
  const flapEnd: Pt = [v.tee[0] + dir[0] * 16, v.tee[1] + dir[1] * 16]
  // the symbol's anchor sits 8 units above the body's centre: put the centre on the origin
  const body = placeSymbol('sym.hv-valve', [0, -8 * k], { k, prefix: 'valve' }).filter(
    (p) => !p.id.endsWith('wheel'),
  )
  const wc = wheelCentre(family)
  const r = 6 * k
  const cad: SvgNode[] = [
    group('incoming', [
      path([rect(v.incoming)], 'incoming', 0, strokeCls({ pen: '050', ink: 'cyan', fill: 'deep' })),
    ]),
    group('record', [
      path([rect(v.record)], 'record', 6, strokeCls({ pen: '050', ink: 'cyan', fill: 'deep' })),
    ]),
    group('line', [path([line(v.line[0], v.line[1])], 'line', 1, cyan('070'))]),
    group('branch', [path([{ t: 'poly', pts: v.branch, r: 8 }], 'branch', 3, cyan('050'))]),
    group('ai', [
      path(
        scaleAt(v.ai, ai.body, 1.2),
        'ai',
        2,
        strokeCls({ pen: '050', ink: 'cyan', fill: 'deep' }),
      ),
      path(scaleAt(v.ai, ai.ring, 1.2), 'ai.ring', 2, strokeCls({ pen: '070', ink: 'orange' })),
    ]),
    group('tolerance', [
      path(scaleAt(v.tolerance, tol.dial, k), 'tolerance.dial', 2, cyan('050')),
      path(
        scaleAt(v.tolerance, tol.band, k),
        'tolerance.band',
        2,
        strokeCls({ pen: '100', ink: 'cyan-dim' }),
      ),
      path(
        scaleAt(v.tolerance, tol.needle, k),
        'needle',
        4,
        strokeCls({ pen: '070', ink: 'orange', draw: false }),
      ),
    ]),
    group('flap', [
      path([line(v.tee, flapEnd)], 'flap', 4, strokeCls({ pen: '070', ink: 'cyan', draw: false })),
    ]),
    {
      el: 'g',
      part: 'valve',
      transform: `translate(${v.valve[0]} ${v.valve[1]}) rotate(${v.valveDeg})`,
      children: partsNodes(body, { variant: 'clean', seed: 'valve', i: 5 }).map((n) =>
        n.el === 'path' ? { ...n, cls: n.cls.replace('f-paper', 'f-deep') } : n,
      ),
    },
    group('wheel', [
      path(
        [{ t: 'circle', c: wc, r }, line([wc[0], wc[1] - r], [wc[0], wc[1] + r])],
        'wheel',
        5,
        strokeCls({ pen: '050', ink: 'orange', fill: 'deep', draw: false }),
      ),
    ]),
  ]
  if (v.person)
    cad.push(
      group(
        'signer',
        partsNodes(
          placeSymbol('fig.at-valve', v.person.feet, { k: v.person.k, prefix: 'signer' }),
          {
            variant: 'pencil',
            seed: `valve:${family}:signer`,
            i: 5,
            ink: 'pencil',
          },
        ),
        'person',
      ),
    )

  // packets: the first three end at the system of record, the fourth waits at the valve
  const end = v.line[1]
  const pk = (c: Pt, n: number) =>
    path(
      [line([c[0] - 4 * dir[0], c[1] - 4 * dir[1]], [c[0] + 4 * dir[0], c[1] + 4 * dir[1]])],
      `pk.${n}`,
      n,
      strokeCls({ pen: '100', ink: 'orange', draw: false, extra: 'pk' }),
    )
  const pkt: SvgNode[] = [pk(end, 1), pk(end, 2), pk(end, 3), pk(v.valve, 4)]

  return {
    viewBox: v.viewBox,
    groups: [
      { layer: 'panel', rev: 'final', children: panel },
      { layer: 'cad', rev: 'final', children: cad },
      { layer: 'pkt', rev: 'final', children: pkt },
    ],
  }
}

export const VALVE_STATES: readonly DocStateSpec[] = [{ rev: 'final', ground: 'deep' }]

export const drawing = docsBuilder((family) => valveDoc(family), VALVE_STATES)
