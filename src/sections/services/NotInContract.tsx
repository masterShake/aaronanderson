import { servicesPage } from '@/content/pages/services'
import { resolveClaim } from '@/content/hold'
import { SectionHead } from '@/components/blueprint/SectionHead'
import { Claimed } from '@/components/ui/Claimed'
import s from './services.module.css'

/**
 * Not in contract (N.I.C.): what the work never includes. Every item is a
 * CONFIRM, so preview shows the marks and production shows only confirmed
 * items; with none confirmed, the section is left out.
 */
export function NotInContract() {
  const c = servicesPage.nic
  if (!c.items.some((it) => resolveClaim(it).show !== 'omit')) return null
  return (
    <section id={c.id} aria-labelledby={`${c.id}-title`} className={`wrap ${s.nic}`}>
      <SectionHead id={c.id} h2={c.h2} body={c.body} />
      <ul className={s.nicList}>
        {c.items.map((it) => (
          <Claimed key={it.id} value={it}>
            {(text) => <li>{text}</li>}
          </Claimed>
        ))}
      </ul>
    </section>
  )
}
