import { contact } from '@/content/pages/contact'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'

export function Privacy() {
  const c = contact.privacy
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul>
        {c.processors.map((p) => (
          <li key={p.name}>
            <strong>{p.name}</strong> {p.does}
          </li>
        ))}
      </ul>
      <p>
        <HeldText value={c.retention} />
      </p>
    </section>
  )
}
