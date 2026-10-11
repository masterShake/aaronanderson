import { howItWorks } from '@/content/pages/how-it-works'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { TicketFigure } from '@/figures/ticket/TicketFigure'

/** One delivery ticket, start to finish (W0 stub; owner: how). */
export function TicketIntro() {
  const c = howItWorks.ticket
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <TicketFigure />
    </section>
  )
}
