import { contact } from '@/content/pages/contact'
import { services } from '@/content/services'
import { SHOW_HOLDS } from '@/content/hold'
import { RichText } from '@/components/ui/RichText'
import { scheduler } from './scheduler'

/** The fallback form (W0 stub: fields only; owner: contact builds the action and spam layers). */
export function WriteSection() {
  const f = contact.form
  const isBook = !scheduler && !SHOW_HOLDS
  const id = isBook ? 'book' : f.id
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="wrap">
      <h2 id={`${id}-title`}>{isBook ? f.headingNoScheduler : f.h2}</h2>
      <RichText value={f.intro} />
      <form>
        <p>
          <label htmlFor="cf-name">{f.fields.name.label}</label>
          <input id="cf-name" name="name" autoComplete="name" required />
        </p>
        <p>
          <label htmlFor="cf-email">{f.fields.email.label}</label>
          <input id="cf-email" name="email" type="email" autoComplete="email" required />
        </p>
        <p>
          <label htmlFor="cf-company">
            {f.fields.company.label} {f.fields.company.optional}
          </label>
          <input id="cf-company" name="company" autoComplete="organization" />
        </p>
        <p>
          <label htmlFor="cf-sheet">{f.fields.sheet.label}</label>
          <select id="cf-sheet" name="sheet" defaultValue="">
            <option value="">{f.fields.sheet.notSure}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.name}
              </option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="cf-message">{f.fields.message.label}</label>
          <textarea
            id="cf-message"
            name="message"
            required
            minLength={f.fields.message.min}
            maxLength={f.fields.message.max}
            rows={6}
          />
        </p>
        <p hidden>
          <label htmlFor="cf-extra">{f.honeypot}</label>
          <input id="cf-extra" name="extra_notes" tabIndex={-1} autoComplete="off" />
        </p>
        <button type="submit">{f.submit}</button>
      </form>
    </section>
  )
}
