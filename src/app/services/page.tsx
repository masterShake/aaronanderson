import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { ServicesHead } from '@/sections/services/ServicesHead'
import { ScheduleSection } from '@/sections/services/ScheduleSection'
import { SheetRail } from '@/sections/services/SheetRail'
import { ServiceSheets } from '@/sections/services/ServiceSheets'
import { NotInContract } from '@/sections/services/NotInContract'
import { ServicesClosing } from '@/sections/services/ServicesClosing'
import { ServicesJsonLd } from '@/sections/services/ServicesJsonLd'

export const metadata: Metadata = pageMetadata('services')

/** Page shell (frozen after W0): one H1, the sections in order, the CTA band last. */
export default function ServicesPage() {
  return (
    <SheetTransition>
      <ServicesHead />
      <ScheduleSection />
      <SheetRail />
      <ServiceSheets />
      <NotInContract />
      <ServicesClosing />
      <ServicesJsonLd />
    </SheetTransition>
  )
}
