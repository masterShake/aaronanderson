import { about } from '@/content/pages/about'
import { SectionHead } from '@/components/blueprint/SectionHead'

export function Beliefs() {
  const c = about.beliefs
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
    </section>
  )
}
