import { firmFigure } from '@/content/figures/firm'
import type { FigureCopy, ServiceId } from '@/content/types'
import { serviceById } from '@/content/services'
import { serviceHref } from '@/lib/routes'
import { firmGraph, FIRM_DETAILS, FIRM_PLACES } from '@/drawings/graphs/firm'
import { DRAWING_FILES, drawingSrc } from '@/drawings/files'
import { LazyDrawing } from '@/figures/LazyDrawing.client'
import { InlineDrawing } from '@/figures/InlineDrawing'
import { fill, schematicCopy } from './copy'
import { Schematic } from './Schematic'

/**
 * The example firm as an interactive schematic (Home B), ready to drop into a
 * section. Layers come from /drawings/firm.{family}.json once
 * src/figures/firm/drawing.server.ts serves firmDrawing; until then (or with
 * `inline`), the layers are rendered inline from the same renderer.
 */

export const FIRM_REWIRED_LABELS = { estimate: 'tool.estimate-rewired' } as const

/** Every label key the firm schematic shows (for the missing-copy list). */
const labelKeys = [
  ...new Set([
    ...firmGraph.nodes.map((n) => n.label),
    ...firmGraph.routes.flatMap((r) => (r.carries ? [r.carries] : [])),
    ...Object.values(FIRM_REWIRED_LABELS),
    ...Object.values(FIRM_PLACES),
    'sym.ai',
    'sym.valve',
    'tag.e',
    'tag.n',
  ]),
]

export async function FirmSchematic({
  copy = firmFigure,
  inline,
}: {
  copy?: FigureCopy
  inline?: boolean
}) {
  const c = schematicCopy(copy, labelKeys)
  const served = DRAWING_FILES.includes('firm.wide.json')
  const src = (f: string) => drawingSrc('firm', f)
  // the still files only exist once the route serves the firm; otherwise inline data URIs
  let stills = {
    wide: { asFound: src('wide.asFound.still.svg'), rewired: src('wide.rewired.still.svg') },
    tall: { asFound: src('tall.asFound.still.svg'), rewired: src('tall.rewired.still.svg') },
  }
  let drawing = (
    <LazyDrawing
      src={src('wide.json')}
      tallSrc={src('tall.json')}
      stillSrc={src('wide.asFound.still.svg')}
    />
  )
  if (inline || !served) {
    const { firmDrawing } = await import('@/drawings/render/firm')
    const uri = (f: string) => `data:image/svg+xml,${encodeURIComponent(firmDrawing.build(f))}`
    stills = {
      wide: { asFound: uri('wide.asFound.still.svg'), rewired: uri('wide.rewired.still.svg') },
      tall: { asFound: uri('tall.asFound.still.svg'), rewired: uri('tall.rewired.still.svg') },
    }
    const merge = (family: 'wide' | 'tall') => ({
      viewBox: firmGraph.viewBox[family],
      groups: firmGraph.revs.flatMap((rev) => firmDrawing.doc(family, rev).groups),
    })
    drawing = <InlineDrawing doc={merge('wide')} tall={merge('tall')} />
  }
  const details = (Object.entries(FIRM_DETAILS) as [ServiceId, string][]).map(([sheet, anchor]) => {
    const service = serviceById(sheet)
    const n = Number(sheet.slice(2))
    return {
      sheet,
      n,
      anchor,
      href: serviceHref(sheet),
      label: fill(c.ui('bubble'), { n, sheet, service: service.name }),
    }
  })
  return (
    <Schematic
      id="firm"
      graph={firmGraph}
      copy={c}
      drawing={drawing}
      stills={stills}
      rewiredLabels={FIRM_REWIRED_LABELS}
      places={FIRM_PLACES}
      details={details}
    />
  )
}
