import { about } from '@/content/pages/about'
import { people } from '@/content/people'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { CrewCard, crewShown } from './CrewCard'
import s from './crew.module.css'

/**
 * About: "Who you'll actually talk to." Crew cards laid out as title-block cells. Until a
 * name or role is confirmed the production look leaves the section out, heading included.
 */
export function CrewCards() {
  const c = about.crew
  if (!crewShown) return null
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul className={`${s.list} ${s.cardsAbout}`}>
        {people.people.map((p) => (
          <CrewCard key={p.id} person={p} />
        ))}
      </ul>
    </section>
  )
}
