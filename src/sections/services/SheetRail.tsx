import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import s from './services.module.css'

/**
 * The jump list to each sheet, after the schedule: a 2 × 3 grid of links,
 * never sticky. Shown below 1280 px; from 1280 px the sticky rail inside
 * ServiceSheets takes over.
 */
export function SheetRail() {
  return (
    <nav aria-label={servicesPage.rail.jump} className={`wrap ${s.jump}`}>
      <ul className={s.jumpList}>
        {services.map((sv) => (
          <li key={sv.id}>
            <a href={`#${sv.slug}`} className={s.jumpLink}>
              {sv.name} <span className={s.jumpId}>{sv.id}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
