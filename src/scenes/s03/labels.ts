import type { LayoutId, Pt } from '@/drawings/types'

/**
 * S-03 HTML label layout, shared by the figure (src/drawings/views/s03.ts re-exports it)
 * and the scene (its projected anchors). Kept apart so the scene chunk stays small.
 */

/** HTML label keys, in the order they render. `doc.*` show only while their document runs. */
export type S03LabelKey =
  | 'hopper'
  | 'reader'
  | 'tolerance'
  | 'gate'
  | 'tray'
  | 'output'
  | 'section'
  | 'doc.invoice'
  | 'doc.ticket'
  | 'doc.submittal'
  | 'card'

/**
 * Label top-left corners in viewBox units, per family. Every label box is at least
 * 104 × 36 CSS px (figure CSS), so these are spread to stay clear of each other at the
 * narrowest container of each family (440 px wide, 360 px tall); the layout tests check it.
 */
export const S03_LABELS: Readonly<Record<S03LabelKey, Readonly<Record<LayoutId, Pt>>>> = {
  hopper: { wide: [12, 14], tall: [8, 124] },
  tolerance: { wide: [442, 14], tall: [156, 124] },
  section: { wide: [12, 620], tall: [8, 450] },
  reader: { wide: [240, 400], tall: [70, 288] },
  gate: { wide: [646, 340], tall: [253, 190] },
  output: { wide: [720, 436], tall: [278, 288] },
  tray: { wide: [349, 584], tall: [176, 430] },
  'doc.invoice': { wide: [12, 262], tall: [8, 8] },
  'doc.ticket': { wide: [12, 262], tall: [8, 8] },
  'doc.submittal': { wide: [12, 262], tall: [8, 8] },
  card: { wide: [655, 109], tall: [248, 8] },
}
