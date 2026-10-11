import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { preview } from '@/content/pages/preview'
import { site } from '@/content/site'
import { glossary, legendSymbols } from '@/content/legend'
import { howItWorks } from '@/content/pages/how-it-works'
import { home } from '@/content/pages/home'
import { processSteps } from '@/content/process'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { PageHead } from '@/components/blueprint/PageHead'
import { LegendTable } from '@/components/blueprint/LegendTable'
import { Stamp } from '@/components/blueprint/Stamp'
import { HeldText } from '@/components/ui/HeldText'
import { BookCallButton } from '@/components/ui/BookCallButton'
import { CtaBand } from '@/components/blueprint/CtaBand'

export const metadata: Metadata = pageMetadata('kit')

/** Preview only: the design-system sheet (W0 stub; owner: kit lane). */
export default function KitPage() {
  if (!PREVIEW_PAGES) notFound()
  const c = preview.kit
  return (
    <SheetTransition>
      <PageHead sheet="G-01" scale={site.sheet.scale} h1={c.h1} deck={c.deck} />
      <section aria-labelledby="kit-ui" className="wrap">
        <h2 id="kit-ui">{site.cta.book}</h2>
        <BookCallButton />
        <p>
          <HeldText value={site.email} />
        </p>
        <Stamp text={processSteps[1]!.stamp} />
      </section>
      <section aria-labelledby="kit-legend" className="wrap">
        <h2 id="kit-legend">{howItWorks.legend.h2}</h2>
        <LegendTable
          symbols={legendSymbols}
          glossary={glossary}
          columns={howItWorks.legend.columns}
        />
      </section>
      <CtaBand content={home.closing} />
    </SheetTransition>
  )
}
