import { home } from '@/content/pages/home'
import { proof } from '@/content/proof'
import { SHOW_HOLDS } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { HoldCloud } from '@/components/blueprint/HoldCloud'
import s from './as-builts.module.css'

/**
 * Home section F: as-builts (proof). HOLD clouds in preview; left out of the
 * production build entirely until a client agrees to be named (D2, D11).
 */
export function AsBuilts() {
  if (!SHOW_HOLDS) return null
  const c = home.asBuilts
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul className={s.sheets}>
        {proof.caseStudies.map((h) => (
          <li key={h.id}>
            <HoldCloud hold={h} minHeight={200} />
          </li>
        ))}
      </ul>
      {proof.testimonials.map((h) => (
        <div key={h.id} className={s.quote}>
          <HoldCloud hold={h} kind="quote" />
        </div>
      ))}
    </section>
  )
}
