import { contact } from '@/content/pages/contact'
import { RichText } from '@/components/ui/RichText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { AfterContactFigure } from '@/figures/after-contact/AfterContactFigure'
import s from './contact-sections.module.css'

/** #next: the four steps as text (a numbered flow), then the four-node schematic. */
export function NextSteps() {
  const c = contact.next
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ol className={s.flow}>
        {c.steps.map((st, i) => (
          <RichText key={i} value={st} as="li" />
        ))}
      </ol>
      <AfterContactFigure />
    </section>
  )
}
