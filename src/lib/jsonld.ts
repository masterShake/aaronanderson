import type { BreadcrumbList, Graph, Service as SchemaService } from 'schema-dts'
import { fact } from '@/content/hold'
import { site } from '@/content/site'
import { services } from '@/content/services'
import { seo } from '@/content/seo'

/**
 * Structured data (W0 stub; owner: platform lane). Only real facts go in:
 * fact() drops every HOLD, so JSON-LD never carries placeholder text. No
 * offers until prices are real.
 */

const ORG_ID = `${site.url}/#organization`
const SITE_ID = `${site.url}/#website`

/** Organization and WebSite, in one @graph at the root. */
export function siteGraph(): Graph {
  const email = fact(site.email)
  const legalName = fact(site.legalName)
  const areaServed = site.areaServed.map(fact).filter((v): v is string => Boolean(v))
  const sameAs = site.sameAs.map(fact).filter((v): v is string => Boolean(v))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: site.name,
        url: site.url,
        ...(legalName ? { legalName } : {}),
        ...(email ? { email } : {}),
        ...(areaServed.length ? { areaServed } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        name: site.name,
        url: site.url,
        inLanguage: site.locale,
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/** The six services and the breadcrumb for /services. */
export function servicesGraph(): Graph {
  const list: SchemaService[] = services.map((s) => ({
    '@type': 'Service',
    '@id': `${site.url}/services#${s.slug}`,
    name: s.name,
    serviceType: s.schemaType,
    description: s.promise,
    provider: { '@id': ORG_ID },
    url: `${site.url}/services#${s.slug}`,
  }))
  const crumbs: BreadcrumbList = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.name, item: site.url },
      { '@type': 'ListItem', position: 2, name: seo.services.title, item: `${site.url}/services` },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [...list, crumbs] }
}
