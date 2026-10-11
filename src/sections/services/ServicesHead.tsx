import { servicesPage } from '@/content/pages/services'
import { site } from '@/content/site'
import { PageHead } from '@/components/blueprint/PageHead'

/** Services sheet head (W0 stub; owner: services). */
export function ServicesHead() {
  return (
    <PageHead sheet="S-00" scale={site.sheet.scale} h1={servicesPage.h1} deck={servicesPage.deck} />
  )
}
