import 'server-only'
import type { LayoutId, Prim, Pt, SvgDoc, SvgNode } from '@/drawings/types'
import { cad, docsBuilder, partsNodes, pencil } from '@/drawings/render'
import { group, strokeCls } from '@/drawings/render/cad'
import { seedFrom } from '@/drawings/lib/geometry'
import { placeSymbol } from '@/drawings/symbols'
import {
  S05_CREW,
  S05_GEO,
  S05_VB,
  feetAt,
  leaderEnds,
  monitorAt,
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
 * bubbles, the new hire, the desk and its monitor. CAD (on paper): the handed
 * tools (the only orange: an asphalt keyline over a 3 u orange underlay),
 * callout leaders, blueprint ticks, the walkthrough's checklist and progress
 * bar. Classes tag each beat (gr, pp, qc, tl, ld, tk, nh, sc, sl, pg) with --i
 * the crew index (or the checklist row); src/figures/s05/s05.module.css runs
 * them on --p.
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

const pencilCls = (tag: string, pen: '025' | '035' | '050' = '035') =>
  `${strokeCls({ pen, ink: 'pencil' })} ${tag}`
const rect = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: [x, y],
  size: [w, h],
})
const line = (a: Pt, b: Pt): Prim => ({ t: 'line', a, b })

/** One handed tool: a 3 u orange underlay, a paper body with an asphalt keyline, and its details. */
function tool(kind: S05Tool, at: Pt, w: number, h: number, i: number): SvgNode {
  const [x, y] = at
  const u = 3
  const fold = w * 0.3
  const body: Prim =
    kind === 'guideline'
      ? {
          t: 'poly',
          closed: true,
          pts: [
            [x, y],
            [x + w - fold, y],
            [x + w, y + fold],
            [x + w, y + h],
            [x, y + h],
          ],
        }
      : rect(x, y, w, h)
  const under: Prim =
    kind === 'guideline'
      ? {
          t: 'poly',
          closed: true,
          pts: [
            [x - u, y - u],
            [x + w - fold + u * 0.4, y - u],
            [x + w + u, y + fold - u * 0.4],
            [x + w + u, y + h + u],
            [x - u, y + h + u],
          ],
        }
      : rect(x - u, y - u, w + 2 * u, h + 2 * u)
  const row = (t: number, from: number, to: number): Prim =>
    line([x + w * from, y + h * t], [x + w * to, y + h * t])
  let details: Prim[]
  if (kind === 'playbook') {
    // a binder: the spine band, three rings, a title plate and its lines
    const sx = x + w * 0.2
    details = [
      line([sx, y], [sx, y + h]),
      ...[0.22, 0.5, 0.78].map((t): Prim => ({
        t: 'circle',
        c: [x + w * 0.1, y + h * t],
        r: w * 0.04,
      })),
      rect(x + w * 0.34, y + h * 0.16, w * 0.52, h * 0.24),
      row(0.25, 0.42, 0.78),
      row(0.32, 0.42, 0.66),
      row(0.56, 0.34, 0.86),
      row(0.66, 0.34, 0.86),
      row(0.76, 0.34, 0.7),
    ]
  } else if (kind === 'guideline') {
    // a sheet with a folded corner: a heading and plain lines of text
    details = [
      {
        t: 'poly',
        pts: [
          [x + w - fold, y],
          [x + w - fold, y + fold],
          [x + w, y + fold],
        ],
      },
      row(0.18, 0.14, 0.56),
      row(0.42, 0.14, 0.86),
      row(0.54, 0.14, 0.86),
      row(0.66, 0.14, 0.86),
      row(0.78, 0.14, 0.6),
    ]
  } else {
    // a tablet: the screen, a play mark and a scrub bar
    const sx = x + w * 0.1
    const sy = y + h * 0.1
    const sw = w * 0.8
    const sh = h * 0.7
    details = [
      rect(sx, sy, sw, sh),
      {
        t: 'poly',
        closed: true,
        pts: [
          [sx + sw * 0.4, sy + sh * 0.32],
          [sx + sw * 0.64, sy + sh * 0.5],
          [sx + sw * 0.4, sy + sh * 0.68],
        ],
      },
      line([sx + sw * 0.1, sy + sh * 0.88], [sx + sw * 0.9, sy + sh * 0.88]),
      { t: 'circle', c: [x + w / 2, y + h * 0.9], r: w * 0.04 },
    ]
  }
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

/** The desk, its monitor and the walkthrough on it (checklist rows, play mark, progress bar). */
function desk(family: Fam, seed: (s: string) => string): { pencil: SvgNode; cad: SvgNode } {
  const g = S05_GEO[family]
  const { x, y, w, h } = g.desk
  const top = Math.max(6, h * 0.07)
  const [mx, my] = monitorAt(family)
  const { w: mw, h: mh } = g.monitor
  const bez = Math.max(4, mw * 0.05)
  const cx = mx + mw / 2
  const sx = mx + bez
  const sy = my + bez
  const sw = mw - 2 * bez
  const sh = mh - 2 * bez
  const shape: Prim[] = [
    // desk: the top slab, two legs and a modesty rail
    rect(x, y, w, top),
    line([x + w * 0.06, y + top], [x + w * 0.06, y + h]),
    line([x + w * 0.94, y + top], [x + w * 0.94, y + h]),
    line([x + w * 0.06, y + h * 0.55], [x + w * 0.94, y + h * 0.55]),
    // monitor: the bezel, the screen, the neck and foot
    rect(mx, my, mw, mh),
    rect(sx, sy, sw, sh),
    line([cx, my + mh], [cx, y]),
    line([cx - mw * 0.2, y], [cx + mw * 0.2, y]),
  ]
  const face = path(
    [rect(mx, my, mw, mh)],
    'desk.face',
    0,
    `${strokeCls({ fill: 'paper', draw: false })} sc`,
  )
  const pencilNode = group('desk', [
    face,
    ...rough(shape, seed('desk'), 'desk', 0, pencilCls('sc')),
  ])
  // the walkthrough on screen: three checklist rows, a play mark, the progress bar
  const rows: SvgNode[] = [0, 1, 2].map((r) => {
    const ry = sy + sh * (0.22 + r * 0.2)
    const b = sh * 0.1
    return path(
      [
        rect(sx + sw * 0.08, ry - b / 2, b, b),
        line([sx + sw * 0.08 + b * 1.8, ry], [sx + sw * (r === 1 ? 0.48 : 0.56), ry]),
      ],
      `walk.row${r}`,
      r,
      `${strokeCls({ pen: '025', ink: 'cad' })} sl`,
    )
  })
  const play = path(
    [
      {
        t: 'poly',
        closed: true,
        pts: [
          [sx + sw * 0.7, sy + sh * 0.26],
          [sx + sw * 0.86, sy + sh * 0.42],
          [sx + sw * 0.7, sy + sh * 0.58],
        ],
      },
    ],
    'walk.play',
    0,
    `${strokeCls({ pen: '035', ink: 'cad' })} sc`,
  )
  const track = path(
    [line([sx + sw * 0.08, sy + sh * 0.84], [sx + sw * 0.92, sy + sh * 0.84])],
    'walk.track',
    0,
    `${strokeCls({ pen: '018', ink: 'pencil' })} sc`,
  )
  const bar = path(
    [line([sx + sw * 0.08, sy + sh * 0.84], [sx + sw * 0.92, sy + sh * 0.84])],
    'progress',
    0,
    `${strokeCls({ pen: '070', ink: 'cad' })} pg`,
  )
  return { pencil: pencilNode, cad: group('walkthrough', [...rows, play, track, bar]) }
}

function make(family: Fam): SvgDoc {
  const g = S05_GEO[family]
  const pencilKids: SvgNode[] = []
  const cadKids: SvgNode[] = []
  const seed = (s: string) => `s05:${family}:${s}`

  // ground lines
  pencilKids.push(
    group('ground', [
      ...rough([line(g.ground[0], g.ground[1])], seed('ground'), 'ground', 0, pencilCls('gr')),
      ...(g.ground2
        ? rough([line(g.ground2[0], g.ground2[1])], seed('ground2'), 'ground2', 0, pencilCls('gr'))
        : []),
    ]),
  )

  S05_CREW.forEach((c, i) => {
    const feet = feetAt(family, i)
    // the pose's own hand prop (a tablet or binder sheet) is left out: the handed tool takes its
    // place, so the hand is empty until then; the hard hat stays
    const parts = placeSymbol(c.symbol, feet, { k: g.k, prefix: c.person }).flatMap((p) => {
      if (!p.id.endsWith('.props')) return [p]
      const prims = p.prims.filter((q) => q.t !== 'rect')
      return prims.length ? [{ ...p, prims }] : []
    })
    pencilKids.push(
      group(
        c.person,
        partsNodes(parts, { variant: 'pencil', seed: seed(c.person), i, ink: 'pencil' }).map((n) =>
          n.el === 'path' ? { ...n, cls: `${n.cls} pp` } : n,
        ),
        'person',
      ),
    )
    // the question bubble beside the head, with a short tail toward it
    const qc = qCenter(family, i)
    const r = g.q.r
    pencilKids.push(
      group(`q.${c.person}`, [
        path(
          [{ t: 'circle', c: qc, r }],
          `q.${c.person}.face`,
          i,
          `${strokeCls({ fill: 'paper', draw: false })} qc`,
        ),
        ...rough(
          [
            { t: 'circle', c: qc, r },
            line([qc[0] + r * 0.72, qc[1] + r * 0.72], [qc[0] + r * 1.15, qc[1] + r * 1.2]),
          ],
          seed(`q${i}`),
          `q.${c.person}`,
          i,
          pencilCls('qc'),
        ),
      ]),
    )
    // the handed tool, its callout leader and the tick that replaces the question mark
    cadKids.push(tool(c.tool, toolAt(family, i), g.tool.w, g.tool.h, i))
    const { top, foot, elbowX } = leaderEnds(family, i)
    const pts: Pt[] = elbowX === undefined ? [foot, top] : [foot, top, [elbowX, top[1]]]
    cadKids.push(
      group(`leader.${c.person}`, [
        path(
          [
            { t: 'poly', pts },
            { t: 'circle', c: foot, r: family === 'wide' ? 2.5 : 1.6 },
          ],
          `leader.${c.person}`,
          i,
          `${strokeCls({ pen: '025', ink: 'asphalt' })} ld`,
        ),
      ]),
    )
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

  // the desk and the walkthrough on its monitor
  const d = desk(family, seed)
  pencilKids.push(d.pencil)
  cadKids.push(d.cad)

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
