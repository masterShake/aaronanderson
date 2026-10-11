import type { SeamScene } from '../../../e2e/helpers/seam'

/**
 * The hero's entry in the seam check (e2e/seam.spec.ts): /?frame=plan pins the SVG at the CAD
 * plan (HERO.decisionAt; no pencil, packets or iso) and the Stage holds the scene at its plan
 * pose. Probes are in viewBox units (wide 960 × 640): centres of drawn lines (the tool boxes'
 * top and bottom edges, the tank's west point, straight pipe runs) and bare panel.
 * Test-only: app code never imports this file.
 */
export const SEAM: SeamScene | null = {
  scene: 'hero',
  path: '/?frame=plan',
  figure: '#fig-hero',
  viewBox: [0, 0, 960, 640],
  probes: {
    lines: [
      [130, 60],
      [480, 60],
      [830, 60],
      [130, 132],
      [480, 132],
      [130, 284],
      [130, 580],
      [480, 580],
      [438, 320],
      [305, 300],
      [305, 260],
      [880, 180],
      [130, 400],
      [300, 96],
      [330, 96],
      [430, 205],
      [560, 211],
      [30, 330],
      [230, 330],
      [580, 90],
      [730, 320],
      [930, 320],
      [880, 160],
      [700, 205],
    ],
    panel: [
      [60, 20],
      [300, 20],
      [600, 20],
      [940, 20],
      [940, 200],
      [940, 620],
      [700, 620],
      [300, 620],
      [10, 620],
      [10, 200],
      [600, 160],
      [560, 260],
      [760, 250],
      [880, 420],
      [880, 480],
      [760, 560],
      [620, 600],
      [260, 470],
      [200, 250],
      [400, 280],
      [560, 400],
      [700, 460],
      [60, 450],
      [250, 160],
    ],
  },
}
