import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import { HeldText } from '@/components/ui/HeldText'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { Schedule } from '@/components/blueprint/Schedule'

/** The schedule, before the details (W0 stub; owner: services). */
export function ScheduleSection() {
  const c = servicesPage.schedule
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className="wrap">
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <Schedule
        caption={c.caption}
        stack
        columns={[
          { key: 'sheet', label: c.columns.sheet },
          { key: 'service', label: c.columns.service },
          { key: 'length', label: c.columns.length },
          { key: 'pricing', label: c.columns.pricing },
          { key: 'paired', label: c.columns.pairedWith },
        ]}
        rows={services.map((s) => ({
          sheet: s.id,
          service: s.name,
          length: s.lengthLabel,
          pricing: s.shape.price ? <HeldText value={s.shape.price.value} /> : c.quoted,
          paired: s.pairedWith.join(', '),
        }))}
      />
      <p>{c.chart.caption}</p>
    </section>
  )
}
