import { contact } from '@/content/pages/contact'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { noScheduler } from './scheduler'
import s from './contact-sections.module.css'

/**
 * "What we do with your details" (pages-drawings §8.4): the body lines carry
 * the promise (a CONFIRM) and the retention HOLD through {retention}; the
 * processors are listed by name.
 */
export function Privacy() {
  const c = contact.privacy
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.privacy}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul className={s.processors}>
        {c.processors
          .filter((p) => !(p.scheduler && noScheduler))
          .map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> {p.does}
            </li>
          ))}
      </ul>
    </section>
  )
}
