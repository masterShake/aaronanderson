import { contact } from '@/content/pages/contact'
import { RichText } from '@/components/ui/RichText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { AfterContactFigure } from '@/figures/after-contact/AfterContactFigure'

export function NextSteps() {
  const c = contact.next
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ol>
        {c.steps.map((st, i) => (
          <RichText key={i} value={st} as="li" />
        ))}
      </ol>
      <AfterContactFigure />
    </section>
  )
}
