import type { SeamScene } from '../../../e2e/helpers/seam'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts). Set it once the s03 scene hands
 * off, for example { scene: 's03', path: '/kit/fig/s03', figure: '#fig-s03', viewBox, probes },
 * with the viewBox and probes taken from the hand-off frame (frontFrame for S-03) in
 * src/drawings/lib/frame.ts. null keeps the scene out of `npm run seam`. Test-only: app code
 * never imports this file.
 */
export const SEAM: SeamScene | null = null
