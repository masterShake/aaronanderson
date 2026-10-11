import { home } from '@/content/pages/home'
import { services } from '@/content/services'
import { serviceHref } from '@/lib/routes'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { SheetIndexTable } from '@/components/blueprint/SheetIndexTable'
import { KeyPlan, KEYPLAN_HIGHLIGHT } from '@/components/blueprint/KeyPlan'
import s from './sheet-index.module.css'

/**
 * Home section C: "Six sheets. Start with the first." The sheet index, whose
 * rows link to each service sheet, and from 1024 px a key-plan panel beside
 * it: hovering or focusing a row shows that sheet's key plan (CSS only, no JS);
 * S-01 shows by default. The panel is a decorative duplicate of the table.
 */
export function SheetIndex() {
  const c = home.sheetIndex
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.sheets}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <div className={s.layout}>
        <div className={s.table}>
          <SheetIndexTable
            caption={c.caption}
            columns={c.columns}
            startHere={c.startHere}
            rows={services.map((sv) => ({
              sheet: sv.id,
              service: sv.name,
              walkAway: sv.walkAwayWith,
              length: sv.lengthLabel,
              href: serviceHref(sv.id),
            }))}
          />
        </div>
        <div className={s.plans} aria-hidden="true">
          {services.map((sv) => (
            <div key={sv.id} className={s.plan} data-plan={sv.id}>
              <KeyPlan view="firm" highlight={KEYPLAN_HIGHLIGHT[sv.id] ?? []} />
              <p className={s.planLabel}>
                {sv.id} · {sv.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
