import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { HomeHero } from '@/sections/home/Hero'
import { Wiring } from '@/sections/home/Wiring'
import { SheetIndex } from '@/sections/home/SheetIndex'
import { ProcessStrip } from '@/sections/home/ProcessStrip'
import { Crew } from '@/sections/home/Crew'
import { AsBuilts } from '@/sections/home/AsBuilts'
import { HomeClosing } from '@/sections/home/Closing'

export const metadata: Metadata = pageMetadata('home')

/** Page shell (frozen after W0): one H1, the sections in order, the CTA band last. */
export default function HomePage() {
  return (
    <SheetTransition>
      <HomeHero />
      <Wiring />
      <SheetIndex />
      <ProcessStrip />
      <Crew />
      <AsBuilts />
      <HomeClosing />
    </SheetTransition>
  )
}
