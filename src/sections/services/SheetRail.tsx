import Link from 'next/link'
import { servicesPage } from '@/content/pages/services'
import { services } from '@/content/services'
import { serviceHref } from '@/lib/routes'

/** The jump list to each sheet (sticky rail at 1280 px and up, later; W0 stub; owner: services). */
export function SheetRail() {
  return (
    <nav aria-label={servicesPage.rail.label} className="wrap">
      <ul>
        {services.map((s) => (
          <li key={s.id}>
            <Link href={serviceHref(s.id)}>
              {s.id} · {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
