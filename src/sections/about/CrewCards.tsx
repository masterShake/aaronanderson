import { about } from '@/content/pages/about'
import { people } from '@/content/people'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { CrewCard } from './CrewCard'
import s from './crew.module.css'

/** About: "Who you'll actually talk to." Crew cards laid out as title-block cells. */
export function CrewCards() {
  const c = about.crew
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
