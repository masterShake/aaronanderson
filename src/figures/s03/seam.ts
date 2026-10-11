import type { SeamScene } from '../../../e2e/helpers/seam'
import type { Pt } from '../../drawings/types'
import { S03_FAMILY, place, sectionFrame } from '../../scenes/s03/section'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts): the S-03 front elevation,
 * section A–A, pinned at the hand-off (p = .38) on the /kit/fig harness. Line probes are
 * midpoints of the long straight lines of the hand-off frame (src/scenes/s03/section.ts,
 * drawn by both renderers); panel probes are bare blueprint, inside and outside the machine.
 * Test-only: app code never imports this file.
 */

const frame = sectionFrame('wide')

const lines: Pt[] = frame.lines
  .filter((l) => (l.pen === '050' || l.pen === '070') && !l.id.startsWith('person'))
  .flatMap((l) => {
    const out: Pt[] = []
    const n = l.pts.length
    for (let i = 0; i < (l.closed ? n : n - 1); i++) {
      const a = l.pts[i]!
      const b = l.pts[(i + 1) % n]!
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      // straight, axis-aligned runs only: their centre pixel is the line's centre
      if (len >= 48 && (a[0] === b[0] || a[1] === b[1]))
        out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
    }
    return out
  })
  .slice(0, 24)

/** Bare panel in design units: inside the body (the back plate in 3D) and around the machine. */
const PANEL: readonly Pt[] = [
  [60, 60],
  [400, 60],
  [740, 60],
  [60, 300],
  [760, 200],
  [600, 230],
  [230, 380],
  [300, 400],
  [400, 380],
  [480, 380],
  [470, 240],
  [60, 450],
  [100, 570],
  [300, 570],
  [500, 570],
  [760, 450],
  [620, 400],
  [740, 300],
  [120, 200],
  [330, 140],
  [560, 140],
  [150, 400],
  [640, 570],
  [740, 570],
]

export const SEAM: SeamScene | null = {
  scene: 's03',
  path: '/kit/fig/s03?p=0.38',
  figure: '#fig-s03',
  viewBox: S03_FAMILY.wide.vb,
  probes: { lines, panel: PANEL.map((p) => place('wide', p)) },
}
