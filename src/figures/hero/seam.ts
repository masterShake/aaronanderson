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
      [130, 284],
      [30, 330],
      [130, 580],
      [480, 580],
      [930, 320],
      [438, 320],
      [130, 430],
      [260, 526],
      [305, 300],
      [305, 400],
      [400, 205],
      [500, 211],
      [311, 260],
      [650, 96],
      [655, 400],
      [620, 544],
      [480, 450],
      [560, 193],
      [850, 170],
      [600, 320],
      [300, 96],
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
