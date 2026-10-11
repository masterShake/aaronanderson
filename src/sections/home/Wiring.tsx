import { home } from '@/content/pages/home'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { FirmFigure } from '@/figures/firm/FirmFigure'

/** Home section B: the example firm, as found (W0 stub; owner: home-about). */
export function Wiring() {
  const c = home.wiring
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <FirmFigure />
      <p>{c.kicker}</p>
    </section>
  )
}
