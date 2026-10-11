import type { Layer, LayoutId, SvgDoc, SvgNode } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'
import { layerClass } from '@/figures/types'

/**
 * The hero's stacked layer <svg>s, both families (the container query shows one). The hero is
 * the only inline drawing and its markup is repeated by the RSC payload, so it is written
 * compactly: the class vocabulary of lib/svg-string, but pathLength="1" and --len only on the
 * paths that use them (draw-on and packets), --i only where it is not 0, and no data-part.
 * `prefix` replaces the l-{layer} class for the still tier's inset, so no figure rule or
 * Stage query ever mistakes it for a live layer.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function node(n: SvgNode): string {
  if (n.el === 'g')
    return `<g${n.cls ? ` class="${esc(n.cls)}"` : ''}>${n.children.map(node).join('')}</g>`
  const dashed = /(^|\s)(draw|pk)(\s|$)/.test(n.cls)
  const vars = [n.i ? `--i:${n.i}` : '', dashed ? `--len:${Math.round(n.len)}` : '']
    .filter(Boolean)
    .join(';')
  return `<path d="${esc(n.d)}"${dashed ? ' pathLength="1"' : ''} class="${esc(n.cls)}"${vars ? ` style="${vars}"` : ''}/>`
}

/** One layer's markup, or '' when the doc has nothing on it. */
export function heroLayerMarkup(doc: SvgDoc, layer: Layer): string {
  return doc.groups
    .filter((g) => g.layer === layer)
    .map((g) => g.children.map(node).join(''))
    .join('')
}

export function HeroLayers({
  wide,
  tall,
  prefix,
}: {
  wide: SvgDoc
  tall: SvgDoc
  prefix?: string
}) {
  const one = (doc: SvgDoc, family: LayoutId) =>
    LAYERS.map((layer) => {
      const html = heroLayerMarkup(doc, layer)
      if (!html) return null
      return (
        <svg
          key={`${family}-${layer}`}
          className={prefix ? `${prefix} ${prefix}-${layer}` : layerClass(layer)}
          data-family={family}
          viewBox={doc.viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    })
  return (
    <>
      {one(wide, 'wide')}
      {one(tall, 'tall')}
    </>
  )
}
