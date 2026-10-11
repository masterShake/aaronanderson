import { about } from '@/content/pages/about'
import { site } from '@/content/site'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'
import s from './about.module.css'

/** About: general notes on how we work, numbered as on a drawing (each a CONFIRM). */
export function GeneralNotesSection() {
  const c = about.notes
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <div className={s.notes}>
        <GeneralNotes title={site.titleBlock.notes.title} items={c.items} />
      </div>
    </section>
  )
}
