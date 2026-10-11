import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/metadata'
import { SheetTransition } from '@/components/chrome/SheetTransition'
import { ContactHead } from '@/sections/contact/ContactHead'
import { BookSection } from '@/sections/contact/BookSection'
import { WriteSection } from '@/sections/contact/WriteSection'
import { EmailSection } from '@/sections/contact/EmailSection'
import { NextSteps } from '@/sections/contact/NextSteps'
import { Privacy } from '@/sections/contact/Privacy'
import { ContactClosing } from '@/sections/contact/ContactClosing'

export const metadata: Metadata = pageMetadata('contact')

/** Page shell (frozen after W0): one H1, the sections in order, the CTA band last. */
export default function ContactPage() {
  return (
    <SheetTransition>
      <ContactHead />
      <BookSection />
      <WriteSection />
      <EmailSection />
      <NextSteps />
      <Privacy />
      <ContactClosing />
    </SheetTransition>
  )
}
