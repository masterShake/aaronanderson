import { about } from '@/content/pages/about'
import { SectionHead } from '@/components/blueprint/SectionHead'
import s from './about.module.css'

/** About: "Machines for the retyping. People for the judgment." Short lines, at most 58ch. */
export function Beliefs() {
  const c = about.beliefs
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.beliefs}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
    </section>
  )
}
