import type { CtaBand as CtaBandCopy, ServiceId } from '@/content/types'
import { site } from '@/content/site'
import { fact } from '@/content/hold'
import { RichText } from '@/components/ui/RichText'
import { BookCallButton } from '@/components/ui/BookCallButton'
import s from './blueprint.module.css'

/** The closing band every page ends with: asphalt plate, H2, a line or two, Book a call. */
export function CtaBand({ content, sheet }: { content: CtaBandCopy; sheet?: ServiceId }) {
  const email = fact(site.email)
  return (
    <section id={content.id} aria-labelledby={`${content.id}-title`} className={s.cta}>
      <div className="wrap">
        <h2 id={`${content.id}-title`}>{content.h2}</h2>
        <RichText value={content.body} />
        <BookCallButton sheet={sheet} size="lg" />
        {email ? (
          <p>
            <a href={`mailto:${email}`}>{email}</a>
          </p>
        ) : null}
        {content.secondary ? <RichText value={content.secondary} /> : null}
      </div>
    </section>
  )
}
