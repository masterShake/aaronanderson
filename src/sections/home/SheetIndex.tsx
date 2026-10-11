import { home } from '@/content/pages/home'
import { services } from '@/content/services'
import { serviceHref } from '@/lib/routes'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { SheetIndexTable } from '@/components/blueprint/SheetIndexTable'

/** Home section C: the six sheets (W0 stub; owner: home-about). */
export function SheetIndex() {
  const c = home.sheetIndex
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <SheetIndexTable
        caption={c.caption}
        columns={c.columns}
        startHere={c.startHere}
        rows={services.map((s) => ({
          sheet: s.id,
          service: s.name,
          walkAway: s.walkAwayWith,
          length: s.lengthLabel,
          href: serviceHref(s.id),
        }))}
      />
    </section>
  )
}
