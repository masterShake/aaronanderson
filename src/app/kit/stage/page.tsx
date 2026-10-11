import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { preview } from '@/content/pages/preview'
import { site } from '@/content/site'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { PageHead } from '@/components/blueprint/PageHead'
import { ProbeLoader } from './ProbeLoader.client'
import { RichText } from '@/components/ui/RichText'
import { DemoFigure } from './DemoFigure'

export const metadata: Metadata = pageMetadata('kit')

/**
 * Preview only: the Stage on its own. The demo figure runs src/scenes/_demo.ts
 * through the full hand-off on the webgl tier (and stays SVG on the others).
 * ?probe=1 also loads src/scenes/_probe.ts, the whole planned three subset,
 * so its chunk can be measured.
 */
export default function KitStagePage() {
  if (!PREVIEW_PAGES) notFound()
  const c = preview.kit.stage
  return (
    <>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={c.h1} deck={c.deck} />
      <section aria-labelledby="probe-title" className="wrap">
        <h2 id="probe-title" className="sr-only">
          {c.h1}
        </h2>
        <DemoFigure caption={<RichText value={c.deck} as="span" />} />
        <ProbeLoader loaded={c.probe} />
      </section>
    </>
  )
}
