import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { cad, docsBuilder, partsNodes, pencil } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { seedFrom } from '@/drawings/lib/geometry'
import { placeSymbol } from '@/drawings/symbols'
import {
  S05_CREW,
  S05_GEO,
  S05_LEADER_DROP,
  S05_SCREEN,
  S05_VB,
  qCenter,
  toolAt,
  type S05Tool,
} from '@/drawings/views/s05'

/**
 * The S-05 drawing files (owner: services), served by /drawings/[file]:
 *   s05.{family}.json                 every layer
 *   s05.{family}.trained.still.svg    the final frame (p = 1)
 *
 * Paper only. Pencil: the ground, the crew in hard hats, their question
 * circles, the new hire, the screen. CAD (on paper): the handed tools (the
 * only orange: an asphalt keyline over a 3 u orange underlay), callout
 * leaders, blueprint ticks and the walkthrough's progress bar. Classes tag
 * each beat (gr, pp, qc, tl, ld, tk, nh, sc, pg) with --i the crew index;
 * src/figures/s05/s05.module.css runs them on --p.
 */

type Fam = LayoutId
const REV = 'trained'

const path = (prims: readonly Prim[], part: string, i: number, cls: string): SvgNode => {
  const c = cad(prims)
  return { el: 'path', d: c.d, len: c.len, part, i, cls }
}

const rough = (prims: readonly Prim[], seed: string, part: string, i: number, cls: string) =>
  pencil(prims, { seed: seedFrom(seed), preset: 'line' }).map((s): SvgNode => ({
    el: 'path',
    d: s.d,
    len: s.len,
    part,
    i,
    cls,
  }))

const pencilCls = (tag: string) => `${strokeCls({ pen: '035', ink: 'pencil' })} ${tag}`
const rect = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: [x, y],
  size: [w, h],
})

/** One handed tool: a 3 u orange underlay, a paper body with an asphalt keyline, and its details. */
function tool(kind: S05Tool, at: Pt, w: number, h: number, i: number): SvgNode {
  const [x, y] = at
  const u = 3
  const body: Prim =
    kind === 'guideline'
      ? {
          t: 'poly',
          closed: true,
          pts: [
            [x, y],
            [x + w - w * 0.3, y],
            [x + w, y + w * 0.3],
            [x + w, y + h],
            [x, y + h],
          ],
        }
      : kind === 'walkthrough'
        ? rect(x, y + h * 0.2, w, h * 0.6)
        : rect(x, y, w, h)
  const under: Prim =
    kind === 'walkthrough'
      ? rect(x - u, y + h * 0.2 - u, w + 2 * u, h * 0.6 + 2 * u)
      : rect(x - u, y - u, w + 2 * u, h + 2 * u)
  const line = (t: number, from = 0.2, to = 0.8): Prim => ({
    t: 'line',
    a: [x + w * from, y + h * t],
    b: [x + w * to, y + h * t],
  })
  const details: Prim[] =
    kind === 'playbook'
      ? [
          { t: 'line', a: [x + w * 0.18, y], b: [x + w * 0.18, y + h] },
          line(0.3, 0.32, 0.82),
          line(0.45, 0.32, 0.82),
        ]
      : kind === 'guideline'
        ? [
            {
              t: 'poly',
              pts: [
                [x + w * 0.7, y],
                [x + w * 0.7, y + w * 0.3],
                [x + w, y + w * 0.3],
              ],
            },
            line(0.42),
            line(0.56),
            line(0.7, 0.2, 0.6),
          ]
        : [
            {
              t: 'poly',
              closed: true,
              pts: [
                [x + w * 0.4, y + h * 0.36],
                [x + w * 0.64, y + h * 0.5],
                [x + w * 0.4, y + h * 0.64],
              ],
            },
          ]
  const part = `tool.${kind}`
  return group(part, [
    path([under], `${part}.under`, i, `${strokeCls({ fill: 'orange', draw: false })} tl`),
    path(
      [body],
      `${part}.body`,
      i,
      `${strokeCls({ pen: '050', ink: 'asphalt', fill: 'paper' })} tl`,
    ),
    path(details, `${part}.detail`, i, `${strokeCls({ pen: '025', ink: 'asphalt' })} tl`),
  ])
}

function make(family: Fam): SvgDoc {
  const g = S05_GEO[family]
  const pencilKids: SvgNode[] = []
  const cadKids: SvgNode[] = []
  const seed = (s: string) => `s05:${family}:${s}`

  // ground lines
  pencilKids.push(
    group('ground', [
      ...rough(
        [{ t: 'line', a: g.ground[0], b: g.ground[1] }],
        seed('ground'),
        'ground',
        0,
        pencilCls('gr'),
      ),
      ...(g.ground2
        ? rough(
            [{ t: 'line', a: g.ground2[0], b: g.ground2[1] }],
            seed('ground2'),
            'ground2',
            0,
            pencilCls('gr'),
          )
        : []),
    ]),
  )

  S05_CREW.forEach((c, i) => {
    const feet = g.crew[i]!
    const parts = placeSymbol(c.symbol, feet, { k: g.k, prefix: c.person })
    pencilKids.push(
      group(
        c.person,
        partsNodes(parts, { variant: 'pencil', seed: seed(c.person), i, ink: 'pencil' }).map((n) =>
          n.el === 'path' ? { ...n, cls: `${n.cls} pp` } : n,
        ),
        'person',
      ),
    )
    const qc = qCenter(family, i)
    pencilKids.push(
      group(
        `q.${c.person}`,
        rough(
          [{ t: 'circle', c: qc, r: g.q.r }],
          seed(`q${i}`),
          `q.${c.person}`,
          i,
          pencilCls('qc'),
        ),
      ),
    )
    // the handed tool, its callout leader and the tick that replaces the question mark
    const at = toolAt(family, i)
    cadKids.push(tool(c.tool, at, g.tool.w, g.tool.h, i))
    const top: Pt = [at[0] + g.tool.w / 2, at[1] - 4]
    const [lx, ly] = g.callout[i]!
    const elbow = ly + S05_LEADER_DROP[family]
    cadKids.push(
      group(`leader.${c.person}`, [
        path(
          [
            {
              t: 'poly',
              pts: [top, [top[0], elbow], [lx, elbow]],
            },
          ],
          `leader.${c.person}`,
          i,
          `${strokeCls({ pen: '025', ink: 'asphalt' })} ld`,
        ),
      ]),
    )
    const r = g.q.r
    cadKids.push(
      group(`tick.${c.person}`, [
        path(
          [
            {
              t: 'poly',
              pts: [
                [qc[0] - r * 0.45, qc[1]],
                [qc[0] - r * 0.1, qc[1] + r * 0.38],
                [qc[0] + r * 0.5, qc[1] - r * 0.42],
              ],
            },
          ],
          `tick.${c.person}`,
          i,
          `${strokeCls({ pen: '070', ink: 'cad' })} tk`,
        ),
      ]),
    )
  })

  // the new hire walks in from the right, facing left (mirrored about the feet)
  const [hx, hy] = g.hire.feet
  const hire = placeSymbol('fig.new-hire', [hx, hy], { k: g.hire.k, prefix: 'hire' })
  pencilKids.push({
    el: 'g',
    part: 'hire',
    cls: 's05-walk',
    children: [
      {
        el: 'g',
        transform: `translate(${2 * hx} 0) scale(-1 1)`,
        children: partsNodes(hire, {
          variant: 'pencil',
          seed: seed('hire'),
          i: 0,
          ink: 'pencil',
        }).map((n) => (n.el === 'path' ? { ...n, cls: `${n.cls} nh` } : n)),
      },
    ],
  })

  // the screen on its stand, and the walkthrough's progress bar
  const [sx, sy] = g.screen
  const { w: sw, h: sh } = S05_SCREEN
  const groundY = (g.ground2 ?? g.ground)[0][1]
  const screen: Prim[] = [
    rect(sx, sy, sw, sh),
    { t: 'line', a: [sx + sw / 2, sy + sh], b: [sx + sw / 2, groundY] },
    { t: 'line', a: [sx + sw / 2 - 12, groundY], b: [sx + sw / 2 + 12, groundY] },
    {
      t: 'poly',
      closed: true,
      pts: [
        [sx + sw * 0.43, sy + sh * 0.22],
        [sx + sw * 0.6, sy + sh * 0.4],
        [sx + sw * 0.43, sy + sh * 0.58],
      ],
    },
  ]
  pencilKids.push(
    group('screen', [
      path([screen[0]!], 'screen.face', 0, `${strokeCls({ fill: 'paper', draw: false })} sc`),
      ...rough(screen, seed('screen'), 'screen', 0, pencilCls('sc')),
    ]),
  )
  cadKids.push(
    group('progress', [
      path(
        [{ t: 'line', a: [sx + 6, sy + sh - 7], b: [sx + sw - 6, sy + sh - 7] }],
        'progress',
        0,
        `${strokeCls({ pen: '100', ink: 'cad' })} pg`,
      ),
    ]),
  )

  return {
    viewBox: S05_VB[family],
    groups: [
      { layer: 'pencil', rev: REV, children: pencilKids },
      { layer: 'cad', rev: REV, children: cadKids },
    ],
  }
}

export const S05_REV = REV

export const drawing = docsBuilder((family) => make(family), [{ rev: REV, ground: 'paper' }])
