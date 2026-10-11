import { home } from '@/content/pages/home'
import { proof } from '@/content/proof'
import { SHOW_HOLDS } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { HoldCloud } from '@/components/blueprint/HoldCloud'

/** Home section F: proof. Preview only until a client agrees to be named (W0 stub; owner: home-about). */
export function AsBuilts() {
  if (!SHOW_HOLDS) return null
  const c = home.asBuilts
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      {proof.caseStudies.map((h) => (
        <HoldCloud key={h.id} hold={h} />
      ))}
    </section>
  )
}
