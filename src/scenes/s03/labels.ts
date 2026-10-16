import type { LayoutId, Pt } from '@/drawings/types'

/**
 * S-03 HTML label layout, shared by the figure (src/drawings/views/s03.ts re-exports it)
 * and the scene (its projected anchors). Kept apart so the scene chunk stays small.
 */

/**
 * HTML label keys, in the order they render. The hopper label carries the running
 * document's name as its second line; `card` is the data card readout (batch only).
 */
export type S03LabelKey = 'hopper' | 'reader' | 'tolerance' | 'tray' | 'output' | 'section' | 'card'

/**
 * Label top-left corners in viewBox units, per family. Every label box is at least
 * 104 × 36 CSS px (figure CSS), so these sit in clear space beside their objects and stay
 * apart at the narrowest container of each family (440 px wide, 360 px tall); the layout
 * tests check it. Labels away from their object get a leader (S03_LEADERS).
 */
export const S03_LABELS: Readonly<Record<S03LabelKey, Readonly<Record<LayoutId, Pt>>>> = {
  hopper: { wide: [128, 24], tall: [8, 8] },
  tolerance: { wide: [418, 40], tall: [118, 64] },
  card: { wide: [668, 16], tall: [250, 8] },
  output: { wide: [708, 380], tall: [262, 234] },
  reader: { wide: [214, 396], tall: [60, 318] },
  tray: { wide: [528, 616], tall: [180, 438] },
  section: { wide: [20, 628], tall: [8, 452] },
}
