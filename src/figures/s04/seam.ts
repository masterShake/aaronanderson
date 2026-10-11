import type { SeamScene } from '../../../e2e/helpers/seam'
import type { Pt } from '../../drawings/types'
import { S04_DIALS, S04_LAYOUT } from '../../drawings/views/s04'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts): the wide hand-off frame at
 * p = S04.handoffP on the harness. While SHIP.s04 is 'svg' the check runs it only with
 * SEAM_SCENES=s04 (it adds ?ship=s04). Line probes sit on horizontal lines (see
 * src/figures/s02/seam.ts on the canvas's pixel snapping); panel probes sit on the paper
 * dial faces, the slots, the nameplate, inside the store and on open panel, clear of the
 * ghosted tiles. Test-only: app code never imports this file.
 */

const L = S04_LAYOUT.wide
const [px, py, pw, ph] = L.panel
const [nx, ny, nw, nh] = L.nameplate
const [tx, ty, tw, th] = L.tank

const lines: Pt[] = [
  [px + pw * 0.11, py],
  [px + pw * 0.5, py],
  [px + pw * 0.89, py],
  [px + pw * 0.11, py + ph],
  [px + pw * 0.89, py + ph],
  [px + pw * 0.11, py + ph / 2],
  [px + pw * 0.5, py + ph / 2],
  [px + pw * 0.89, py + ph / 2],
  [nx + nw * 0.3, ny],
  [nx + nw * 0.7, ny + nh],
  [tx + tw * 0.33, ty],
  [tx + tw * 0.56, ty],
  [tx + tw * 0.33, ty + th],
  [tx + tw * 0.5, ty + th],
  [tx + tw * 0.67, ty + th],
  ...S04_DIALS.map((d): Pt => [L.dials[d].c[0], L.dials[d].c[1] - L.dials[d].r]),
]

const panel: Pt[] = [
  ...S04_DIALS.map((d): Pt => [L.dials[d].c[0], L.dials[d].c[1] + L.dials[d].r * 0.5]),
  [L.printer[0] + L.printer[2] / 2, L.printer[1] + L.printer[3] / 2],
  [L.slot[0] + L.slot[2] / 2, L.slot[1] + L.slot[3] / 2],
  [nx + nw / 2, ny + nh / 2],
  [tx + tw * 0.3, ty + th / 2],
  [tx + tw * 0.6, ty + th / 2],
  [60, 60],
  [900, 60],
  [60, 300],
  [900, 300],
  [60, 520],
  [900, 520],
  [150, 680],
  [800, 680],
  [200, 600],
]

export const SEAM: SeamScene | null = {
  scene: 's04',
  path: '/kit/fig/s04?p=0.5',
  figure: '#fig-s04',
  viewBox: L.viewBox,
  probes: { lines, panel },
}
