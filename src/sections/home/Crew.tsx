import Link from 'next/link'
import { home } from '@/content/pages/home'
import { site } from '@/content/site'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { SpecGrid } from '@/components/blueprint/SpecGrid'

/** Home section E: the crew, as a title-block strip (W0 stub; owner: home-about). */
export function Crew() {
  const c = home.crew
  const tb = site.titleBlock
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <SpecGrid
        cells={[
          { label: tb.drawnBy.label, value: <HeldText value={tb.drawnBy.value} /> },
          { label: tb.checkedBy.label, value: <HeldText value={tb.checkedBy.value} /> },
          { label: c.approvedBy.label, value: c.approvedBy.value },
        ]}
      />
      <p>
        <Link href={c.link.href as '/about'}>{c.link.label}</Link>
      </p>
    </section>
  )
}
