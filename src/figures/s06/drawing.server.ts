import 'server-only'
import type { LayoutId, SvgDoc } from '@/drawings/types'
import { docsBuilder, frameNodes, isoPrintDoc } from '@/drawings/render'
import { planFrame } from '@/drawings/lib/frame'
import { buildS06Model, S06_VIEWBOX } from '@/drawings/views/s06'

/**
 * The s06 drawing files served by /drawings/[file] (owner: hero):
 *   s06.{family}.json            the plan (panel + CAD frame) and the iso print, as layers
 *   s06.{family}.plan.still.svg  the rewired plan on blueprint-deep
 *   s06.{family}.print.still.svg the iso print with every month added (the still tier)
 */

function make(family: LayoutId, rev: string): SvgDoc {
  const m = buildS06Model(family)
  const vb = S06_VIEWBOX[family]
  if (rev === 'print') {
    const iso = isoPrintDoc(m.spec)
    return { viewBox: vb, groups: iso.groups.map((g) => ({ ...g, rev })) }
  }
  return {
    viewBox: vb,
    groups: [
      {
        layer: 'panel',
        rev,
        children: [
          {
            el: 'path',
            d: `M0 0H${vb[2]}V${vb[3]}H0Z`,
            len: 0,
            part: 'panel',
            i: 0,
            cls: 'f-deep',
          },
        ],
      },
      { layer: 'cad', rev, children: frameNodes(planFrame(m.spec)) },
    ],
  }
}

export const drawing = docsBuilder(make, [
  { rev: 'plan', ground: 'deep' },
  { rev: 'print', ground: 'deep' },
])
