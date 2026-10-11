import type { SeamScene } from '../../../e2e/helpers/seam'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts). Set it once the hero scene hands
 * off, for example { scene: 'hero', path: '/', figure: '#fig-hero', viewBox, probes }, with the
 * viewBox and probes taken from the hand-off frame in src/drawings/lib/frame.ts. null keeps
 * the scene out of `npm run seam`. Test-only: app code never imports this file.
 */
export const SEAM: SeamScene | null = null
