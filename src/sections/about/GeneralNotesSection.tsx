import { about } from '@/content/pages/about'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'

export function GeneralNotesSection() {
  const c = about.notes
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <GeneralNotes title={c.h2} items={c.items} />
    </section>
  )
}
