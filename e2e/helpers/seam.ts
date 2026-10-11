import type { Pt, ViewBox } from '../../src/drawings/types'

/**
 * One scene's entry in the seam check (e2e/seam.spec.ts, stage-hero §5.1). Each figure lane
 * owns src/figures/<id>/seam.ts and sets its SEAM once the scene hands off; null keeps the
 * scene out of `npm run seam`.
 *   scene    the SceneId the figure registers with the Stage
 *   path     a page or /kit/fig harness path that shows the figure, without a query string
 *   figure   the figure root selector, for example '#fig-s02'
 *   viewBox  the hand-off frame's viewBox (src/drawings/lib/frame.ts)
 *   probes   points in viewBox units: centres of drawn lines, and bare panel
 */
export interface SeamScene {
  readonly scene: string
  readonly path: string
  readonly figure: string
  readonly viewBox: ViewBox
  readonly probes: { readonly lines: readonly Pt[]; readonly panel: readonly Pt[] }
}
