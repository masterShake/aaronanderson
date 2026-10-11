import type { Part, Prim, Pt, SymbolDef, SymbolId } from '../types'

/**
 * Architect's scale figures (pages-drawings §5.3): one skeleton, varied only
 * by joint angles. Artboard 40 × 72 u, figure height 64 with the feet at
 * y = 72; head an ellipse at (20, 13); shoulders 14 wide at y = 20; waist 10
 * at y = 38; hips 12 at y = 40; legs 32 (thigh 16, shin 15) tapering 5 → 3;
 * arms 11 + 11 tapering 3.5 → 2.5. No faces, hair, gendered clothes or smiles;
 * never colored. Body parts are separate closed shapes in draw order: far arm,
 * far leg, torso, near leg, head, near arm, accessories. They render in pencil
 * (fill paper-2, rough outline at the person preset), never as stick figures.
 */

type Deg = number
export interface Pose {
  /** Upper-body lean about the hips, degrees (positive leans forward, +x). */
  lean?: Deg
  /** Hip height drop (seated figures sit lower). */
  sit?: number
  /** [upper arm, elbow bend] from hanging straight down; positive swings forward. */
  armFar: readonly [Deg, Deg]
  armNear: readonly [Deg, Deg]
  /** [thigh, knee bend] from straight down; positive swings forward. */
  legFar: readonly [Deg, Deg]
  legNear: readonly [Deg, Deg]
  props?: readonly PropId[]
}

export type PropId =
  'sheet' | 'box' | 'tablet' | 'phone' | 'stamp' | 'hard-hat' | 'desk' | 'stool' | 'binder'

const rad = (d: number) => (d * Math.PI) / 180
const dir = (deg: Deg): Pt => [Math.sin(rad(deg)), Math.cos(rad(deg))]
const at = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l]
const r2 = (n: number) => Math.round(n * 100) / 100
const R = (p: Pt): Pt => [r2(p[0]), r2(p[1])]

/** A tapered limb from a to b as a closed outline with blunt rounded ends. */
function limb(a: Pt, b: Pt, w0: number, w1: number): Prim {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const nx = -dy / l
  const ny = dx / l
  const ux = dx / l
  const uy = dy / l
  const pts: Pt[] = [
    [a[0] + (nx * w0) / 2, a[1] + (ny * w0) / 2],
    [b[0] + (nx * w1) / 2, b[1] + (ny * w1) / 2],
    [b[0] + (ux * w1) / 2, b[1] + (uy * w1) / 2],
    [b[0] - (nx * w1) / 2, b[1] - (ny * w1) / 2],
    [a[0] - (nx * w0) / 2, a[1] - (ny * w0) / 2],
    [a[0] - (ux * w0) / 3, a[1] - (uy * w0) / 3],
  ]
  return { t: 'poly', pts: pts.map(R), closed: true }
}

function ellipse(c: Pt, rx: number, ry: number, n = 14): Prim {
  return {
    t: 'poly',
    pts: Array.from({ length: n }, (_, i) =>
      R([c[0] + rx * Math.cos((2 * Math.PI * i) / n), c[1] + ry * Math.sin((2 * Math.PI * i) / n)]),
    ),
    closed: true,
  }
}

const rect = (x: number, y: number, w: number, h: number): Prim => ({
  t: 'rect',
  at: [r2(x), r2(y)],
  size: [w, h],
})

const part = (id: string, prims: readonly Prim[], fill = true): Part => ({
  id,
  layer: 'pencil',
  prims,
  pen: '035',
  ink: 'pencil',
  fill: fill ? 'paper' : 'none',
})

/** Build a figure from a pose: parts in draw order, plus anchors (feet, hands, head). */
export function figure(pose: Pose): { parts: Part[]; anchors: Record<string, Pt> } {
  const sit = pose.sit ?? 0
  const hip: Pt = [20, 40 + sit]
  const lean = rad(pose.lean ?? 0)
  // upper-body points rotate about the hip
  const up = (p: Pt): Pt => {
    const dx = p[0] - hip[0]
    const dy = p[1] - (40 + sit) + 0
    return [
      hip[0] + dx * Math.cos(lean) - dy * Math.sin(lean),
      hip[1] + dx * Math.sin(lean) + dy * Math.cos(lean),
    ]
  }
  const shift = (p: Pt): Pt => [p[0], p[1] + sit]
  const torso: Prim = {
    t: 'poly',
    pts: [
      up(shift([13, 20])),
      up(shift([27, 20])),
      up(shift([25, 38])),
      up(shift([26, 41])),
      up(shift([14, 41])),
      up(shift([15, 38])),
    ].map(R),
    closed: true,
  }
  const head = ellipse(up(shift([20, 13])), 3.6, 4.6)
  const neck = up(shift([20, 18]))
  const shoulderFar = up(shift([16.5, 21.5]))
  const shoulderNear = up(shift([23.5, 21.5]))
  const leanDeg = pose.lean ?? 0
  const arm = (s: Pt, [a, e]: readonly [Deg, Deg]) => {
    const elbow = at(s, dir(a + leanDeg), 11)
    const hand = at(elbow, dir(a + e + leanDeg), 11)
    return { prims: [limb(s, elbow, 3.5, 3), limb(elbow, hand, 3, 2.5)], hand }
  }
  const leg = (h: Pt, [a, k]: readonly [Deg, Deg]) => {
    const knee = at(h, dir(a), 16)
    const ankle = at(knee, dir(a - k), 15)
    const toe: Pt = [ankle[0] + 5, ankle[1] + 1]
    const foot: Prim = {
      t: 'poly',
      pts: [
        R([ankle[0] - 1.5, ankle[1] - 1.5]),
        R([ankle[0] + 1.5, ankle[1] - 1.5]),
        R(toe),
        R([ankle[0] - 1.5, ankle[1] + 1]),
      ],
      closed: true,
    }
    return { prims: [limb(h, knee, 5, 4), limb(knee, ankle, 4, 3), foot], ankle }
  }
  const armFar = arm(shoulderFar, pose.armFar)
  const armNear = arm(shoulderNear, pose.armNear)
  const legFar = leg([18, hip[1]], pose.legFar)
  const legNear = leg([22, hip[1]], pose.legNear)
  const parts: Part[] = [
    part('arm-far', armFar.prims),
    part('leg-far', legFar.prims),
    part('torso', [torso]),
    part('leg-near', legNear.prims),
    part('head', [head]),
    part('arm-near', armNear.prims),
  ]
  const hand = armNear.hand
  const props: Prim[] = []
  for (const p of pose.props ?? []) {
    switch (p) {
      case 'sheet':
        props.push(rect(hand[0] - 1, hand[1] - 9, 8, 10))
        break
      case 'box':
        props.push(rect(hand[0] - 2, hand[1] - 8, 10, 8))
        break
      case 'tablet':
        props.push(rect(hand[0] - 1, hand[1] - 8, 6, 9))
        break
      case 'phone': {
        const ear = up(shift([23, 13]))
        props.push(rect(ear[0], ear[1] - 1, 2.5, 5))
        break
      }
      case 'stamp':
        props.push(rect(hand[0] - 2, hand[1] - 1, 4, 3), rect(hand[0] - 3.5, hand[1] + 2, 7, 1.5))
        break
      case 'binder':
        props.push(rect(hand[0] - 2, hand[1] - 10, 7, 11))
        break
      case 'hard-hat': {
        const c = up(shift([20, 9.5]))
        props.push(
          { t: 'arc', c: R(c), r: 4.4, from: 180, to: 360 },
          { t: 'line', a: R([c[0] - 5.5, c[1]]), b: R([c[0] + 5.5, c[1]]) },
        )
        break
      }
      case 'stool':
        props.push(
          { t: 'line', a: [14, R([0, hip[1] + 2])[1]], b: [26, R([0, hip[1] + 2])[1]] },
          { t: 'line', a: [16, R([0, hip[1] + 2])[1]], b: [15, 72] },
          { t: 'line', a: [24, R([0, hip[1] + 2])[1]], b: [25, 72] },
        )
        break
      case 'desk':
        props.push({ t: 'line', a: [26, 44], b: [40, 44] }, { t: 'line', a: [38, 44], b: [38, 72] })
        break
    }
  }
  if (props.length) parts.push(part('props', props, false))
  return {
    parts,
    anchors: {
      feet: [20, 72],
      hand: R(hand),
      head: R(up(shift([20, 13]))),
      neck: R(neck),
      ankle: R(legNear.ankle),
    },
  }
}

/** The poses (D10 plus survey, receive, tablet and phone). */
export const POSES: Readonly<Partial<Record<SymbolId, Pose>>> = {
  'fig.standing': { armFar: [4, 4], armNear: [-4, 8], legFar: [-2, 0], legNear: [3, 2] },
  'fig.carrying-paper': {
    armFar: [12, 70],
    armNear: [18, 78],
    legFar: [-16, 4],
    legNear: [16, 10],
    props: ['sheet'],
  },
  'fig.at-valve': { armFar: [10, 20], armNear: [62, 12], legFar: [-6, 0], legNear: [10, 4] },
  'fig.desk-stamp': {
    sit: 8,
    armFar: [30, 60],
    armNear: [150, 40],
    legFar: [80, 80],
    legNear: [88, 88],
    props: ['stamp', 'stool', 'desk'],
  },
  'fig.walking': { armFar: [16, 10], armNear: [-16, 14], legFar: [-18, 6], legNear: [18, 12] },
  'fig.survey': { lean: 8, armFar: [18, 30], armNear: [48, 20], legFar: [-8, 0], legNear: [12, 4] },
  'fig.receive': {
    armFar: [56, 22],
    armNear: [64, 16],
    legFar: [-4, 0],
    legNear: [6, 4],
    props: ['sheet'],
  },
  'fig.tablet': {
    armFar: [14, 76],
    armNear: [20, 84],
    legFar: [-2, 0],
    legNear: [4, 2],
    props: ['tablet'],
  },
  'fig.phone': {
    armFar: [4, 4],
    armNear: [-20, 160],
    legFar: [-3, 0],
    legNear: [5, 2],
    props: ['phone'],
  },
  'fig.hardhat-field': {
    armFar: [4, 4],
    armNear: [-4, 8],
    legFar: [-2, 0],
    legNear: [3, 2],
    props: ['hard-hat'],
  },
  'fig.hardhat-estimator': {
    armFar: [14, 76],
    armNear: [20, 84],
    legFar: [-2, 0],
    legNear: [4, 2],
    props: ['hard-hat', 'tablet'],
  },
  'fig.hardhat-pm': {
    armFar: [12, 70],
    armNear: [18, 78],
    legFar: [-6, 0],
    legNear: [8, 4],
    props: ['hard-hat', 'binder'],
  },
  'fig.new-hire': {
    armFar: [16, 10],
    armNear: [-16, 14],
    legFar: [-18, 6],
    legNear: [18, 12],
    props: ['hard-hat'],
  },
  'fig.owner': {
    armFar: [56, 22],
    armNear: [64, 16],
    legFar: [-4, 0],
    legNear: [6, 4],
    props: ['sheet'],
  },
}

/** Every scale figure as a SymbolDef (artboard 40 × 72). */
export const PEOPLE: Readonly<Partial<Record<SymbolId, SymbolDef>>> = Object.fromEntries(
  Object.entries(POSES).map(([id, pose]) => {
    const f = figure(pose!)
    return [id, { id: id as SymbolId, viewBox: [0, 0, 40, 72], parts: f.parts, anchors: f.anchors }]
  }),
)

/** Figures are 40 u tall in firm drawings; never drawn under 24 CSS px tall. */
export const PERSON_HEIGHT = 40
export const PERSON_MIN_PX = 24
