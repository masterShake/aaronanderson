import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { ContactHead } from '@/sections/contact/ContactHead'
import { BookSection } from '@/sections/contact/BookSection'
import { WriteBlock } from '@/sections/contact/WriteBlock'
import { ContactClosing } from '@/sections/contact/ContactClosing'

export const metadata: Metadata = pageMetadata('contact')

/**
 * Page shell: one H1, the sections in order, the CTA band last. The form, the
 * email address, the next steps (with their schematic) and the privacy note
 * share one block: side notes beside the form from 1024 px, stacked below.
 */
export default function ContactPage() {
  return (
    <SheetTransition>
      <ContactHead />
      <BookSection />
      <WriteBlock />
      <ContactClosing />
    </SheetTransition>
  )
}
