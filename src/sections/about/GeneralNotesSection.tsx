import { about } from '@/content/pages/about'
import { site } from '@/content/site'
import { resolveClaim } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'
import s from './about.module.css'

/**
 * About: general notes on how we work, numbered as on a drawing (each a CONFIRM).
 * In production, with every note still pending, the section and its heading are left out (D11).
 */
export function GeneralNotesSection() {
  const c = about.notes
  if (!c.items.some((it) => resolveClaim(it).show !== 'omit')) return null
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <div className={s.notes}>
        <GeneralNotes title={site.titleBlock.notes.title} items={c.items} />
      </div>
    </section>
  )
}
