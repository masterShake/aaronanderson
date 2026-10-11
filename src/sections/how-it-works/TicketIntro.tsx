import { howItWorks } from '@/content/pages/how-it-works'
import { SectionHead } from '@/components/blueprint/SectionHead'
import s from './how.module.css'

/** One delivery ticket, start to finish: the intro only (the figure lives with the steps). */
export function TicketIntro() {
  const c = howItWorks.ticket
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.intro}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
    </section>
  )
}
