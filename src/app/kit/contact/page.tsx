import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contact, contactUi } from '@/content/pages/contact'
import { site } from '@/content/site'
import { PREVIEW_PAGES } from '@/lib/env'
import { pageMetadata } from '@/lib/metadata'
import { resolveScheduler } from '@/lib/scheduler'
import { PageHead } from '@/components/blueprint/PageHead'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { BookFacade } from '@/sections/contact/BookFacade'

export const metadata: Metadata = pageMetadata('kit')

/** A sample Cal.com link: the e2e specs stub its embed.js, so nothing leaves the machine. */
const SAMPLE = resolveScheduler('https://cal.com/example/intro', new URL(site.url).host)

/**
 * Preview only (C1): the booking facade with a sample link, because
 * site.scheduler.url is still a HOLD and /contact never renders it.
 */
export default function KitContactPage() {
  if (!PREVIEW_PAGES || SAMPLE?.provider !== 'cal') notFound()
  const c = contact.book
  return (
    <>
      <PageHead
        sheet="G-03"
        scale={site.sheet.scale}
        h1={contactUi.bench.h1}
        deck={contactUi.bench.deck}
      />
      <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
        <SectionHead id={c.id} h2={c.h2} body={c.body} />
        <BookFacade scheduler={SAMPLE} />
      </section>
    </>
  )
}
