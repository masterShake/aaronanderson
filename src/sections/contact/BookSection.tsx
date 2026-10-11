import { contact } from '@/content/pages/contact'
import { site } from '@/content/site'
import { SHOW_HOLDS, isHold } from '@/content/hold'
import { HoldCloud } from '@/components/blueprint/HoldCloud'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { scheduler } from './scheduler'

/**
 * #book. While the booking link is a HOLD: preview shows a HOLD cloud,
 * production hides this block and the form section takes id="book"
 * (W0 stub; owner: contact, which builds the Cal.com facade).
 */
export function BookSection() {
  const c = contact.book
  if (!scheduler && !SHOW_HOLDS) return null
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap" data-book="">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      {scheduler ? (
        <p>
          <a href={scheduler.bookingUrl} target="_blank" rel="noopener noreferrer">
            {c.facade.newTab}
          </a>
        </p>
      ) : isHold(site.scheduler.url) ? (
        <HoldCloud hold={site.scheduler.url} minHeight={240} />
      ) : null}
    </section>
  )
}
