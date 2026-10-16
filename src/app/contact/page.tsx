import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { ContactHead } from '@/sections/contact/ContactHead'
import { BookSection } from '@/sections/contact/BookSection'
import { WriteBlock } from '@/sections/contact/WriteBlock'
import { NextSteps } from '@/sections/contact/NextSteps'
import { ContactClosing } from '@/sections/contact/ContactClosing'

export const metadata: Metadata = pageMetadata('contact')

/**
 * Page shell: one H1, the sections in order, the CTA band last. The form, the
 * email address and the privacy note share one block (side by side from 1024 px).
 */
export default function ContactPage() {
  return (
    <SheetTransition>
      <ContactHead />
      <BookSection />
      <WriteBlock />
      <NextSteps />
      <ContactClosing />
    </SheetTransition>
  )
}
