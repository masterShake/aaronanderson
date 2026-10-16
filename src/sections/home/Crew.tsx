import { IntentLink as Link } from '@/components/ui/IntentLink.client'
import type { Route } from 'next'
import { home } from '@/content/pages/home'
import { people } from '@/content/people'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { CrewCard, crewShown } from '@/sections/about/CrewCard'
import s from '@/sections/about/crew.module.css'

/**
 * Home section E: "The person on the call is the person on the tools."
 * Compact crew cards (photo HOLD, name, role, one-line background), then the
 * APPROVED BY: YOU cell and the link to About. Until a name or role is
 * confirmed the production look keeps the heading and the claim, with a plain
 * link to About and no cards.
 */
export function Crew() {
  const c = home.crew
  const link = crewShown ? c.link : c.linkNoCrew
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      {crewShown ? (
        <div className={s.homeLayout}>
          <ul className={s.list}>
            {people.people.map((p) => (
              <CrewCard key={p.id} person={p} compact />
            ))}
          </ul>
          <p className={s.approved}>
            <span className={s.approvedLabel}>{c.approvedBy.label}:</span>
            <span className={s.approvedValue}>{c.approvedBy.value}</span>
          </p>
        </div>
      ) : null}
      <p className={s.more}>
        <Link href={link.href as Route}>{link.label}</Link>
      </p>
    </section>
  )
}
