import type { Part, Prim, Pt, SymbolDef, SymbolId } from '../types'

/**
 * Architect's scale figures (entourage; pages-drawings §5.3, _finish B4): one
 * body, varied only by joint angles. Artboard 40 × 72 u, figure 64 tall with
 * the feet at y = 72: eight heads (head 8 tall, centred at (20, 12)),
 * shoulders 13 wide at y = 19.5, waist at y = 34, hips at y = 40; legs 32
 * (thigh 16, shin 15) and arms 22 (11 + 11), as before, so anchors and
 * bounding boxes are unchanged.
 *
 * Each limb is ONE closed outline (a tapered capsule bent at the joint, round
 * at both ends), so there are no joint seams, diamonds or stick limbs. Every
 * shape is filled paper (a figure may restyle it to `f-tint`, an opaque light
 * tint of its panel) under a clean
 * outline, drawn far arm, far leg, torso, near leg, head, near arm, props.
 * No faces, hair, gendered clothes or smiles; never colored. The pencil
 * renderer draws people clean (the 'person' preset), so one figure reads the
 * same in pencil, CAD and on the iso sheet.
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
const unit = (a: Pt, b: Pt): Pt => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  return [dx / l, dy / l]
}
/** Left-hand normal of a direction (y down). */
const nrm = (d: Pt): Pt => [-d[1], d[0]]

/** Points on a circle of radius r about c, from angle a0 to a1 (radians), n steps, ends excluded. */
function arcPts(c: Pt, r: number, a0: number, a1: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * (i + 1)) / (n + 1)
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as Pt
  })
}

const ang = (v: Pt) => Math.atan2(v[1], v[0])
/** Shortest signed sweep from a0 to a1. */
const sweep = (a0: number, a1: number) => {
  let s = a1 - a0
  while (s > Math.PI) s -= 2 * Math.PI
  while (s < -Math.PI) s += 2 * Math.PI
  return s
}

/**
 * A limb through a → b → c, `w` wide at each point: one closed outline with
 * round ends, a rounded outer elbow and a mitred inner one (clamped, so tight
 * bends never spike).
 */
function limb(a: Pt, b: Pt, c: Pt, w: readonly [number, number, number]): Prim {
  const d1 = unit(a, b)
  const d2 = unit(b, c)
  const n1 = nrm(d1)
  const n2 = nrm(d2)
  const turn = d2[0] * n1[0] + d2[1] * n1[1] // > 0: bends toward +n (the + side is inner)
  const side = (s: 1 | -1): Pt[] => {
    const h0 = (w[0] / 2) * s
    const h1 = (w[1] / 2) * s
    const h2 = (w[2] / 2) * s
    const p0: Pt = [a[0] + n1[0] * h0, a[1] + n1[1] * h0]
    const p2: Pt = [c[0] + n2[0] * h2, c[1] + n2[1] * h2]
    const inner = s * turn > 1e-6
    let mid: Pt[]
    if (inner) {
      const m: Pt = [n1[0] + n2[0], n1[1] + n2[1]]
      const ml = Math.hypot(m[0], m[1]) || 1
      const cos = Math.max(0.62, ml / 2)
      const k = h1 / cos / ml
      mid = [[b[0] + m[0] * k, b[1] + m[1] * k]]
    } else {
      const s1: Pt = [n1[0] * h1, n1[1] * h1]
      const s2: Pt = [n2[0] * h1, n2[1] * h1]
      const a0 = ang(s1)
      const sw = sweep(a0, ang(s2))
      const steps = Math.min(3, Math.round(Math.abs(sw) / 0.45))
      mid = [
        [b[0] + s1[0], b[1] + s1[1]],
        ...arcPts(b, Math.abs(h1), a0, a0 + sw, steps),
        [b[0] + s2[0], b[1] + s2[1]],
      ]
    }
    return [p0, ...mid, p2]
  }
  const left = side(1)
  const right = side(-1).reverse()
  // round caps: at c from the + side to the − side (forward), at a from − to + (backward)
  const capC = arcPts(c, w[2] / 2, ang(n2), ang(n2) - Math.PI, 3)
  const capA = arcPts(a, w[0] / 2, ang(n1) + Math.PI, ang(n1), 2)
  return { t: 'poly', pts: [...left, ...capC, ...right, ...capA].map(R), closed: true }
}

function ellipse(c: Pt, rx: number, ry: number, n = 12): Prim {
  return {
    t: 'poly',
    pts: Array.from({ length: n }, (_, i) =>
      R([c[0] + rx * Math.cos((2 * Math.PI * i) / n), c[1] + ry * Math.sin((2 * Math.PI * i) / n)]),
    ),
    closed: true,
  }
}

const poly = (pts: readonly Pt[], closed = true): Prim => ({
  t: 'poly',
  pts: pts.map(R),
  closed,
})

const part = (id: string, prims: readonly Prim[], fill = true): Part => ({
  id,
  layer: 'pencil',
  prims,
  pen: '035',
  ink: 'pencil',
  fill: fill ? 'paper' : 'none',
  clean: true,
})

/** A sheet of paper (w × h) held at p, with a folded corner and two text rules. */
function sheet(p: Pt, w: number, h: number): Prim[] {
  const [x, y] = [p[0] - 1, p[1] - h + 1]
  const f = Math.min(w, h) * 0.3
  return [
    poly([
      [x, y],
      [x + w - f, y],
      [x + w, y + f],
      [x + w, y + h],
      [x, y + h],
    ]),
    { t: 'line', a: R([x + 1.4, y + h * 0.42]), b: R([x + w - 1.4, y + h * 0.42]) },
    { t: 'line', a: R([x + 1.4, y + h * 0.66]), b: R([x + w - 2.4, y + h * 0.66]) },
  ]
}

/** Build a figure from a pose: parts in draw order, plus anchors (feet, hands, head). */
export function figure(pose: Pose): { parts: Part[]; anchors: Record<string, Pt> } {
  const sit = pose.sit ?? 0
  const hip: Pt = [20, 40 + sit]
  const lean = rad(pose.lean ?? 0)
  const leanDeg = pose.lean ?? 0
  // upper-body points (authored standing) shift down by sit and rotate about the hip
  const up = (p: Pt): Pt => {
    const dx = p[0] - 20
    const dy = p[1] + sit - hip[1]
    return [
      hip[0] + dx * Math.cos(lean) - dy * Math.sin(lean),
      hip[1] + dx * Math.sin(lean) + dy * Math.cos(lean),
    ]
  }
  const torso = poly(
    (
      [
        [18.7, 15.4],
        [21.3, 15.4],
        [21.6, 17.6],
        [24.6, 18.6],
        [26.1, 19.9],
        [26.4, 22.4],
        [25.2, 28],
        [24.4, 34],
        [25.3, 38],
        [25.6, 41.6],
        [14.4, 41.6],
        [14.7, 38],
        [15.6, 34],
        [14.8, 28],
        [13.6, 22.4],
        [13.9, 19.9],
        [15.4, 18.6],
        [18.4, 17.6],
      ] as Pt[]
    ).map(up),
  )
  const headC = up([20, 12])
  const head = ellipse(headC, 3.2, 4)
  const neck = up([20, 17])
  const shoulderFar = up([16.5, 21.5])
  const shoulderNear = up([23.5, 21.5])
  const arm = (s: Pt, [a, e]: readonly [Deg, Deg]) => {
    const elbow = at(s, dir(a + leanDeg), 11)
    const hand = at(elbow, dir(a + e + leanDeg), 11)
    return { prims: [limb(s, elbow, hand, [3.6, 3, 2.5])], hand }
  }
  const leg = (h: Pt, [a, k]: readonly [Deg, Deg]) => {
    const top: Pt = [h[0], h[1] - 1]
    const knee = at(h, dir(a), 16)
    const ankle = at(knee, dir(a - k), 15)
    const [x, y] = ankle
    const shoe = poly([
      [x - 1.7, y - 1.3],
      [x + 1.3, y - 1.3],
      [x + 3.6, y - 0.4],
      [x + 4.5, y + 0.3],
      [x + 4.4, y + 1],
      [x - 1.9, y + 1],
      [x - 2.1, y + 0.1],
    ])
    return { prims: [limb(top, knee, ankle, [5.6, 4, 3.1]), shoe], ankle }
  }
  const armFar = arm(shoulderFar, pose.armFar)
  const armNear = arm(shoulderNear, pose.armNear)
  const legFar = leg([18, hip[1]], pose.legFar)
  const legNear = leg([22, hip[1]], pose.legNear)
  const parts: Part[] = [
    part('arm-far', armFar.prims),
    part('leg-far', legFar.prims),
    part('leg-near', legNear.prims),
    // the torso covers the tops of both legs, so the hips read as one shape
    part('torso', [torso]),
    part('head', [head]),
  ]
  const hand = armNear.hand
  const props: Prim[] = []
  const held: Prim[] = []
  for (const p of pose.props ?? []) {
    switch (p) {
      case 'sheet':
        held.push(...sheet(hand, 8, 10))
        break
      case 'box':
        held.push(poly(rectPts(hand[0] - 2, hand[1] - 8, 10, 8)), {
          t: 'line',
          a: R([hand[0] - 2, hand[1] - 5.5]),
          b: R([hand[0] + 8, hand[1] - 5.5]),
        })
        break
      case 'tablet':
        held.push(
          poly(rectPts(hand[0] - 1, hand[1] - 8, 6, 9)),
          poly(rectPts(hand[0], hand[1] - 7, 4, 6.4)),
        )
        break
      case 'phone': {
        const ear = up([23.2, 12.6])
        held.push(poly(rectPts(ear[0], ear[1] - 1.2, 2.2, 4.8)))
        break
      }
      case 'stamp':
        held.push(
          poly([
            [hand[0] - 1.2, hand[1] - 1.4],
            [hand[0] + 1.2, hand[1] - 1.4],
            [hand[0] + 1.2, hand[1] + 1.6],
            [hand[0] + 3.4, hand[1] + 2],
            [hand[0] + 3.4, hand[1] + 3.4],
            [hand[0] - 3.4, hand[1] + 3.4],
            [hand[0] - 3.4, hand[1] + 2],
            [hand[0] - 1.2, hand[1] + 1.6],
          ]),
        )
        break
      case 'binder':
        held.push(poly(rectPts(hand[0] - 2, hand[1] - 10, 7, 11)), {
          t: 'line',
          a: R([hand[0] - 0.6, hand[1] - 10]),
          b: R([hand[0] - 0.6, hand[1] + 1]),
        })
        break
      case 'hard-hat': {
        const c = up([20, 10.4])
        parts.push(
          part('hat', [
            poly([
              ...arcPts(c, 3.9, Math.PI, 2 * Math.PI, 7),
              [c[0] + 3.9, c[1]],
              [c[0] + 5.6, c[1] + 0.3],
              [c[0] + 5.6, c[1] + 1.1],
              [c[0] - 4.6, c[1] + 1.1],
              [c[0] - 4.6, c[1] + 0.3],
              [c[0] - 3.9, c[1]],
            ]),
          ]),
        )
        break
      }
      case 'stool': {
        const y = r2(hip[1] + 2)
        props.push(
          poly(rectPts(13, y, 13, 1.6)),
          { t: 'line', a: [15, y + 1.6], b: [14, 72] },
          { t: 'line', a: [24, y + 1.6], b: [25, 72] },
          { t: 'line', a: [14.6, 62], b: [24.4, 62] },
        )
        break
      }
      case 'desk':
        props.push(poly(rectPts(26, 43, 14, 2)), {
          t: 'line',
          a: [38, 45],
          b: [38, 72],
        })
        break
    }
  }
  // the near arm draws over what it holds, so the hand grips the sheet
  if (props.length) parts.push(part('props', props, false))
  if (held.length) parts.push({ ...part('props', held), id: 'props.held' })
  parts.push(part('arm-near', armNear.prims))
  return {
    parts,
    anchors: {
      feet: [20, 72],
      hand: R(hand),
      head: R(headC),
      neck: R(neck),
      ankle: R(legNear.ankle),
    },
  }
}

function rectPts(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
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
    armNear: [20, 60],
    legFar: [80, 80],
    legNear: [88, 88],
    props: ['stamp', 'stool', 'desk'],
  },
  'fig.walking': { armFar: [16, 10], armNear: [-16, 14], legFar: [-18, 6], legNear: [18, 12] },
  // the far arm hangs behind the body: half-raised, its forearm read as a stray stub
  'fig.survey': { lean: 8, armFar: [6, 10], armNear: [48, 20], legFar: [-8, 0], legNear: [12, 4] },
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
