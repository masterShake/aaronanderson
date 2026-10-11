import type { SvgDoc, SvgNode } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'
import { layerClass } from './types'

/**
 * The hero's inline drawing: one HTML-level <svg> per layer, server-rendered.
 * Only the hero is inline (the RSC payload repeats inline SVG). W0 minimal;
 * owner: drawings lane, which swaps in lib/svg-string.ts.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function node(n: SvgNode): string {
  if (n.el === 'path') {
    return `<path d="${esc(n.d)}" pathLength="1" class="${esc(n.cls)}" data-part="${esc(n.part)}" style="--i:${n.i};--len:${n.len}"/>`
  }
  const attrs = [
    n.cls ? ` class="${esc(n.cls)}"` : '',
    n.part ? ` data-part="${esc(n.part)}"` : '',
    n.transform ? ` transform="${esc(n.transform)}"` : '',
  ].join('')
  return `<g${attrs}>${n.children.map(node).join('')}</g>`
}

function Layers({ doc, family }: { doc: SvgDoc; family: 'wide' | 'tall' }) {
  return (
    <>
      {LAYERS.map((layer) => {
        const groups = doc.groups.filter((g) => g.layer === layer)
        if (!groups.length) return null
        const html = groups
          .map(
            (g) =>
              `<g data-layer="${layer}"${g.rev ? ` data-rev="${esc(g.rev)}"` : ''}>${g.children.map(node).join('')}</g>`,
          )
          .join('')
        return (
          <svg
            key={layer}
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
      <Layers doc={doc} family="wide" />
      {tall ? <Layers doc={tall} family="tall" /> : null}
    </>
  )
}
