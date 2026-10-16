import type { LayoutId, Pt, ViewBox } from '../types'

/**
 * Layout of the sign-off detail (pages-drawings §6.8; wide 960 × 420, tall
 * 400 × 720): a pipe from INCOMING PAPERWORK (an in-tray) to the SYSTEM OF
 * RECORD (a filing cabinet), past an AI reader (a reading instrument with a
 * lens) and a tolerance gauge. A tee sends exceptions down a branch to the
 * sign-off valve (body, bonnet, handwheel, flanges), where a person stands;
 * the branch rejoins the line. The logbook card fills as records go by.
 * Isomorphic, no strings.
 *
 * The motion in src/figures/valve/valve.module.css moves packets along these
 * points and turns the needle and the wheel about them; keep the two in step
 * (VALVE_PATHS below gives the packet routes).
 */

type Rect = readonly [x: number, y: number, w: number, h: number]

export interface ValveLayout {
  viewBox: ViewBox
  /** The in-tray (incoming paperwork): its box; the outlet sits on the main line. */
  tray: Rect
  /** The main line, outlet to cabinet inlet. */
  line: readonly [Pt, Pt]
  /** The AI reader: the sight window's centre on the line; 0 = housing above, -90 = housing left. */
  reader: { c: Pt; rot: 0 | -90 }
  /** The tolerance gauge: dial centre, radius, and the tap on the line. */
  gauge: { c: Pt; r: number; tap: Pt }
  /** The tee, then the exception branch back to the line. */
  branch: readonly Pt[]
  /** The valve body's centre; 0 = on a horizontal run (stem up), 90 = on a vertical run (stem right). */
  valve: { c: Pt; rot: 0 | 90 }
  /** The filing cabinet (system of record). */
  cabinet: Rect
  /** The logbook card. */
  logbook: Rect
  /** The person at the valve: the hand on the wheel, scale, facing left (mirrored). */
  person: { hand: Pt; k: number }
  /** Thin leader lines from a label to its object. */
  leaders: readonly (readonly [Pt, Pt])[]
  /** Label tags: x, y, width (user units). */
  tags: Readonly<Record<string, Rect>>
}

export const VALVE_LAYOUT: Readonly<Record<LayoutId, ValveLayout>> = {
  wide: {
    viewBox: [0, 0, 960, 420],
    tray: [28, 112, 140, 92],
    line: [
      [168, 160],
      [792, 160],
    ],
    reader: { c: [292, 160], rot: 0 },
    gauge: { c: [430, 84], r: 36, tap: [430, 160] },
    branch: [
      [530, 160],
      [530, 270],
      [740, 270],
      [740, 160],
    ],
    valve: { c: [610, 270], rot: 0 },
    cabinet: [792, 100, 144, 196],
    logbook: [28, 286, 340, 116],
    person: { hand: [638, 214], k: 1.7 },
    leaders: [
      [
        [474, 90],
        [441, 68],
      ],
    ],
    tags: {
      incoming: [28, 214, 160, 0],
      reader: [240, 6, 200, 0],
      tolerance: [478, 48, 140, 0],
      inRange: [478, 82, 120, 0],
      valve: [548, 292, 180, 0],
      approved: [552, 348, 120, 0],
      record: [792, 46, 144, 0],
      logbook: [40, 294, 324, 0],
    },
  },
  tall: {
    viewBox: [0, 0, 400, 720],
    tray: [120, 40, 160, 80],
    line: [
      [200, 120],
      [200, 636],
    ],
    reader: { c: [200, 190], rot: -90 },
    gauge: { c: [302, 290], r: 34, tap: [200, 290] },
    branch: [
      [200, 380],
      [64, 380],
      [64, 500],
      [200, 500],
    ],
    valve: { c: [64, 440], rot: 90 },
    cabinet: [120, 636, 160, 72],
    logbook: [216, 506, 176, 114],
    person: { hand: [128, 440], k: 1.25 },
    leaders: [
      [
        [302, 246],
        [302, 272],
      ],
    ],
    tags: {
      incoming: [16, 58, 100, 0],
      reader: [222, 166, 170, 0],
      tolerance: [262, 334, 130, 0],
      inRange: [268, 226, 120, 0],
      valve: [216, 396, 176, 0],
      approved: [216, 448, 120, 0],
      record: [16, 650, 96, 0],
      logbook: [222, 512, 166, 0],
    },
  },
}

/** Where a packet starts (just out of the tray) and how the exception travels, per family. */
export function valvePaths(family: LayoutId): { straight: readonly Pt[]; divert: readonly Pt[] } {
  const v = VALVE_LAYOUT[family]
  const [a, b] = v.line
  const start: Pt = family === 'wide' ? [a[0] + 10, a[1]] : [a[0], a[1] + 10]
  return {
    straight: [start, b],
    divert: [start, ...v.branch.slice(0, 2), v.valve.c, ...v.branch.slice(2), b],
  }
}

/** Where the handwheel sits: above the valve body (or right of it on a vertical run). */
export function wheelCentre(family: LayoutId): Pt {
  const v = VALVE_LAYOUT[family].valve
  return v.rot === 0 ? [v.c[0], v.c[1] - 56] : [v.c[0] + 56, v.c[1]]
}
