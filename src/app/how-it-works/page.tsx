import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { ProcessHead } from '@/sections/how-it-works/ProcessHead'
import { TicketIntro } from '@/sections/how-it-works/TicketIntro'
import { ProcessSteps } from '@/sections/how-it-works/ProcessSteps'
import { ControlSection } from '@/sections/how-it-works/ControlSection'
import { LegendSection } from '@/sections/how-it-works/LegendSection'
import { FaqSection } from '@/sections/how-it-works/FaqSection'
import { ProcessClosing } from '@/sections/how-it-works/ProcessClosing'

export const metadata: Metadata = pageMetadata('how-it-works')

/** Page shell (frozen after W0): one H1, the sections in order, the CTA band last. */
export default function HowItWorksPage() {
  return (
    <SheetTransition>
      <ProcessHead />
      <TicketIntro />
      <ProcessSteps />
      <ControlSection />
      <LegendSection />
      <FaqSection />
      <ProcessClosing />
    </SheetTransition>
  )
}
