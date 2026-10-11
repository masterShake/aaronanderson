import type { LayoutId, SvgDoc } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'
import { layerMarkup } from '@/drawings/lib/svg-string'
import { layerClass } from './types'

/**
 * The hero's inline drawing: one HTML-level <svg> per layer, server-rendered
 * through lib/svg-string (the same markup the layer bundles carry). Only the
 * hero is inline, because the RSC payload repeats inline SVG. With a tall doc,
 * both families render and the figure's container query shows one.
 */

function Layers({ doc, family }: { doc: SvgDoc; family?: LayoutId }) {
  return (
    <>
      {LAYERS.map((layer) => {
        const html = layerMarkup(doc, layer)
        if (!html) return null
        return (
          <svg
            key={`${family ?? 'any'}-${layer}`}
            className={layerClass(layer)}
            data-family={family}
            viewBox={doc.viewBox.join(' ')}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </>
  )
}

export function InlineDrawing({ doc, tall }: { doc: SvgDoc; tall?: SvgDoc }) {
  return (
    <>
      {/* without a tall doc the wide layers show in both families */}
      <Layers doc={doc} family={tall ? 'wide' : undefined} />
      {tall ? <Layers doc={tall} family="tall" /> : null}
    </>
  )
}
