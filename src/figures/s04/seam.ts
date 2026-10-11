import type { SeamScene } from '../../../e2e/helpers/seam'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts). Set it once the s04 scene hands
 * off, for example { scene: 's04', path: '/kit/fig/s04', figure: '#fig-s04', viewBox, probes },
 * with the viewBox and probes taken from the hand-off frame in src/drawings/lib/frame.ts.
 * While SHIP.s04 is 'svg' the check runs it only with SEAM_SCENES=s04 (it adds ?ship=s04).
 * null keeps the scene out of `npm run seam`. Test-only: app code never imports this file.
 */
export const SEAM: SeamScene | null = null
