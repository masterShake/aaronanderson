import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { AboutHead } from '@/sections/about/AboutHead'
import { CrewCards } from '@/sections/about/CrewCards'
import { Strata } from '@/sections/about/Strata'
import { GeneralNotesSection } from '@/sections/about/GeneralNotesSection'
import { Beliefs } from '@/sections/about/Beliefs'
import { OrgChart } from '@/sections/about/OrgChart'
import { AboutClosing } from '@/sections/about/AboutClosing'

export const metadata: Metadata = pageMetadata('about')

/** Page shell (frozen after W0): one H1, the sections in order, the CTA band last. */
export default function AboutPage() {
  return (
    <SheetTransition>
      <AboutHead />
      <CrewCards />
      <Strata />
      <GeneralNotesSection />
      <Beliefs />
      <OrgChart />
      <AboutClosing />
    </SheetTransition>
  )
}
