import { about } from '@/content/pages/about'
import { people } from '@/content/people'
import { resolveHeld } from '@/content/hold'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'

/** Crew cards laid out as title-block cells (W0 stub; owner: home-about). */
export function CrewCards() {
  const c = about.crew
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul>
        {people.people.map((p) => (
          <li key={p.id}>
            <HeldText value={p.photo} variant="block" />
            <h3>
              {resolveHeld(p.name).show === 'omit' ? (
                <HeldText value={p.role} />
              ) : (
                <HeldText value={p.name} />
              )}
            </h3>
            <p>
              <HeldText value={p.role} />
            </p>
            <p>{p.tags.map((t) => c.tags[t]).join(' · ')}</p>
            <p>
              {c.askLabel} <HeldText value={p.askMeAbout} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
