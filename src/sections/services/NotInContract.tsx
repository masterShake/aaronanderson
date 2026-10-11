import { servicesPage } from '@/content/pages/services'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { GeneralNotes } from '@/components/blueprint/GeneralNotes'

/** Not in contract: the claims the owner confirms (W0 stub; owner: services). */
export function NotInContract() {
  const c = servicesPage.nic
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <GeneralNotes title={c.h2} items={c.items} />
    </section>
  )
}
