import type { SeamScene } from '../../../e2e/helpers/seam'

/**
 * S-06's entry in the seam check (e2e/seam.spec.ts): the /kit/fig/s06 harness pinned at the
 * hand-off progress (?p=0.15: the CAD plan drawn, no print, no months yet). While SHIP.s06 is
 * 'svg' it runs only with SEAM_SCENES=s06 (the spec adds ?ship=s06). The plan is the hero's wide
 * model plus the flange and the monitor gauge, so the probes follow the hero's.
 * Test-only: app code never imports this file.
 */
export const SEAM: SeamScene | null = {
  scene: 's06',
  path: '/kit/fig/s06?p=0.15',
  figure: '#fig-s06',
  viewBox: [0, 0, 960, 640],
  probes: {
    lines: [
      [130, 60],
      [480, 60],
      [830, 60],
      [130, 580],
      [480, 580],
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
      [544, 376],
      [930, 320],
      [469, 362],
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
      [560, 440],
      [700, 460],
      [60, 450],
      [250, 160],
    ],
  },
}
