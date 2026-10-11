import { JsonLd } from '@/components/seo/JsonLd'
import { servicesGraph } from '@/lib/jsonld'

/** Six Services and a BreadcrumbList, no offers. */
export function ServicesJsonLd() {
  return <JsonLd id="ld-services" data={servicesGraph()} />
}
