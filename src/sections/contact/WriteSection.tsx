import { contact, contactUi } from '@/content/pages/contact'
import { afterContactFigure } from '@/content/figures/after-contact'
import { services } from '@/content/services'
import { SHOW_HOLDS } from '@/content/hold'
import { drawingSrc } from '@/drawings/files'
import { RECEIVED_LABELS } from '@/drawings/graphs/after-contact'
import { RichText } from '@/components/ui/RichText'
import { ContactForm } from '@/components/contact/ContactForm.client'
import { LIMITS } from '@/lib/contact/fields'
import { scheduler } from './scheduler'
import { plain, splitRich } from './rich'

/**
 * The fallback form (pages-drawings §8.1). Every string is rendered or
 * resolved here and passed down (C3); the action lives in
 * src/app/contact/actions.ts. Without a scheduler in production this section
 * takes id="book" and the no-scheduler heading.
 */
export function WriteSection() {
  const f = contact.form
  const isBook = !scheduler && !SHOW_HOLDS
  const id = isBook ? 'book' : f.id
  const msg = f.fields.message
  const short = LIMITS.name
  const [before, after] = splitRich(f.success.body, 'name')
  const ui = afterContactFigure.ui
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="wrap">
      <h2 id={`${id}-title`}>{isBook ? f.headingNoScheduler : f.h2}</h2>
      <RichText value={f.intro} />
      <noscript>
        <RichText value={f.noScript} />
      </noscript>
      <ContactForm
        limits={{ min: msg.min, max: msg.max }}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
        copy={{
          labels: {
            name: f.fields.name.label,
            email: f.fields.email.label,
            company: f.fields.company.label,
            sheet: f.fields.sheet.label,
            message: msg.label,
          },
          optional: f.fields.company.optional,
          hints: {
            email: plain(f.fields.email.hint ?? ''),
            company: plain(f.fields.company.hint ?? ''),
            message: plain(msg.hint ?? ''),
          },
          notSure: f.fields.sheet.notSure,
          sheets: services.map((s) => ({ id: s.id, label: `${s.id} · ${s.name}` })),
          honeypot: f.honeypot,
          submit: f.submit,
          pending: f.pending,
          verifying: contactUi.verifying,
          errorSummary: f.errorSummary,
          fieldErrors: {
            required: f.errors.required,
            email: f.errors.email,
            tooShort: <RichText value={f.errors.tooShort} vars={{ min: msg.min }} as="span" />,
            tooLongMessage: <RichText value={f.errors.tooLong} vars={{ max: msg.max }} as="span" />,
            tooLongShort: <RichText value={f.errors.tooLong} vars={{ max: short }} as="span" />,
          },
          formErrors: {
            rate_limited: f.errors.rateLimited,
            turnstile: f.errors.verify,
            send_failed: f.errors.server,
            not_configured: f.errors.notConfigured,
          },
          success: {
            title: f.success.title,
            before,
            after,
            live: f.success.live,
            sooner: isBook ? undefined : plain(ui.sooner),
          },
        }}
        drawing={{
          src: drawingSrc('after-contact', 'wide.received.still.svg'),
          ourNode: plain(ui.ourNode),
          theirNode: plain(ui.theirNode),
          received: plain(ui.received),
          at: RECEIVED_LABELS,
          aspect: RECEIVED_LABELS.aspect,
        }}
      />
    </section>
  )
}
