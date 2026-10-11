import type { LayoutId, Pt, ViewBox } from '../types'

/**
 * Layout of the sign-off detail (pages-drawings §6.8; wide 960 × 420, tall
 * 400 × 560): a conduit from INCOMING PAPERWORK to the SYSTEM OF RECORD past an
 * AI reader and a tolerance dial; a diverter tee sends exceptions down a
 * branch to the sign-off valve, which rejoins the line. Isomorphic, no strings.
 *
 * The motion in src/figures/valve/valve.module.css rotates the needle, the
 * flap and the wheel about the points named here, and moves packets by the
 * offsets below; keep the two in step.
 */

type Rect = readonly [x: number, y: number, w: number, h: number]

export interface ValveLayout {
  viewBox: ViewBox
  /** Symbol scale. */
  k: number
  incoming: Rect
  record: Rect
  /** The main line, start to end. */
  line: readonly [Pt, Pt]
  ai: Pt
  tolerance: Pt
  tee: Pt
  /** The exception branch, tee to rejoin. */
  branch: readonly Pt[]
  valve: Pt
  /** Valve body rotation (degrees): 0 on a horizontal run, 90 on a vertical one. */
  valveDeg: number
  person?: { feet: Pt; k: number }
  /** Label tags: x, y, width (user units). */
  tags: Readonly<Record<string, Rect>>
}

export const VALVE_LAYOUT: Readonly<Record<LayoutId, ValveLayout>> = {
  wide: {
    viewBox: [0, 0, 960, 420],
    k: 1.6,
    incoming: [24, 118, 180, 64],
    record: [756, 118, 180, 64],
    line: [
      [204, 150],
      [756, 150],
    ],
    ai: [300, 150],
    tolerance: [420, 150],
    tee: [520, 150],
    branch: [
      [520, 150],
      [520, 290],
      [680, 290],
      [680, 150],
    ],
    valve: [600, 290],
    valveDeg: 0,
    person: { feet: [556, 396], k: 1.3 },
    tags: {
      incoming: [34, 128, 160, 0],
      record: [766, 128, 160, 0],
      reader: [256, 70, 170, 0],
      tolerance: [384, 70, 120, 0],
      inRange: [446, 104, 80, 0],
      valve: [536, 168, 132, 0],
      approved: [600, 312, 100, 0],
      logbook: [712, 206, 236, 0],
    },
  },
  tall: {
    viewBox: [0, 0, 400, 560],
    k: 1.2,
    incoming: [110, 16, 180, 56],
    record: [110, 488, 180, 56],
    line: [
      [200, 72],
      [200, 488],
    ],
    ai: [200, 132],
    tolerance: [200, 204],
    tee: [200, 252],
    branch: [
      [200, 252],
      [330, 252],
      [330, 408],
      [200, 408],
    ],
    valve: [330, 330],
    valveDeg: 90,
    tags: {
      incoming: [120, 24, 160, 0],
      record: [120, 496, 160, 0],
      reader: [222, 108, 170, 0],
      tolerance: [226, 180, 160, 0],
      inRange: [226, 204, 160, 0],
      valve: [212, 268, 104, 0],
      approved: [212, 416, 120, 0],
      logbook: [8, 244, 176, 0],
    },
  },
}
