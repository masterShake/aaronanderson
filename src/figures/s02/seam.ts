import type { SeamScene } from '../../../e2e/helpers/seam'
import type { Pt } from '../../drawings/types'
import { S02_LAYOUT, S02_TOOLS } from '../../drawings/views/s02'

/**
 * This figure's entry in the seam check (e2e/seam.spec.ts): the wide hand-off frame at
 * p = S02.handoffP on the harness, where the SVG shows planFrame(s02Model('wide')) at rest
 * with an empty l-pkt. Probes, in viewBox units: centres of drawn lines (box edges, conduit
 * legs, flange ticks) and bare panel (inside the enclosures, which WebGL draws as faces
 * flat at the panel tone, and open panel clear of the ghost). Test-only: app code never
 * imports this file.
 */

const L = S02_LAYOUT.wide
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

const along = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
/*
 * Line probes sit on horizontal lines only. The art box starts on a whole CSS px row (the
 * figure snaps its strip and width), but its left edge follows the page margin, which can be
 * fractional; the Stage's canvas is pixel-snapped and the SVG is not, so at 1× a vertical
 * line can sit up to a fifth of a pixel apart (requested: runtime subpixel compensation).
 */
const edges: Pt[] = S02_TOOLS.flatMap((t) => {
  const [x, y, w, h] = L.boxes[t]
  return [
    [x + w * 0.3, y],
    [x + w * 0.7, y],
    [x + w * 0.3, y + h],
    [x + w * 0.7, y + h],
  ] as Pt[]
})
const legs: Pt[] = [
  along(L.routes.lead[0]!, L.routes.lead[1]!, 0.25),
  mid(L.routes.lead[0]!, L.routes.lead[1]!),
  along(L.routes.lead[0]!, L.routes.lead[1]!, 0.75),
  along(L.routes.pm[0]!, L.routes.pm[1]!, 0.3),
  mid(L.routes.pm[0]!, L.routes.pm[1]!),
  along(L.routes.pm[0]!, L.routes.pm[1]!, 0.6),
  mid(L.routes.est[1]!, L.routes.est[2]!),
  mid(L.routes.acct[1]!, L.routes.acct[2]!),
]
/* Inside each enclosure, clear of its glyph (the glyph fills the middle of the bottom half). */
const inside: Pt[] = S02_TOOLS.flatMap((t) => {
  const [x, y, w, h] = L.boxes[t]
  return [
    [x + w * 0.25, y + h * 0.5],
    [x + w * 0.5, y + h * 0.35],
    [x + w * 0.75, y + h * 0.65],
  ] as Pt[]
})
/* Open panel, clear of every enclosure, conduit and glyph at the hand-off frame (the pencil
   ghost and the carrier are gone by then). */
const open: Pt[] = [
  [120, 100],
  [300, 60],
  [520, 80],
  [560, 24],
  [60, 650],
  [300, 650],
  [580, 700],
  [940, 700],
  [944, 420],
  [60, 200],
  [220, 560],
  [800, 476],
]

export const SEAM: SeamScene | null = {
  scene: 's02',
  path: '/kit/fig/s02?p=0.44',
  figure: '#fig-s02',
  viewBox: L.viewBox,
  probes: { lines: [...edges, ...legs].slice(0, 24), panel: [...inside, ...open] },
}
