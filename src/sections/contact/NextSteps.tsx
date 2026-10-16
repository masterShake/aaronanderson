import { contact } from '@/content/pages/contact'
import { RichText } from '@/components/ui/RichText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { AfterContactFigure } from '@/figures/after-contact/AfterContactFigure'
import { noScheduler } from './scheduler'
import s from './contact-sections.module.css'

/**
 * #next: the four steps as text (a numbered flow). Without a booking calendar the first step
 * says only what the page offers: writing to us. On its own (`aside` off) the flow runs in a
 * row and the four-node schematic follows; beside the form (WriteBlock) the flow is a column
 * and the schematic is placed by the block.
 */
export function NextSteps({
  className = 'wrap',
  aside = false,
}: {
  className?: string
  aside?: boolean
}) {
  const c = contact.next
  const steps = noScheduler ? [c.firstStepNoScheduler, ...c.steps.slice(1)] : c.steps
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={className}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ol className={`${s.flow} ${aside ? s.flowColumn : ''}`}>
        {steps.map((st, i) => (
          <RichText key={i} value={st} as="li" />
        ))}
      </ol>
      {aside ? null : <AfterContactFigure noScheduler={noScheduler} />}
    </section>
  )
}
