import type { BreadcrumbList, Graph, Organization, Service as SchemaService } from 'schema-dts'
import { fact } from '@/content/hold'
import { site } from '@/content/site'
import { services } from '@/content/services'
import { seo } from '@/content/seo'
import { PATH } from '@/lib/routes'
import { LOGO } from '@/lib/seo/site'

/**
 * Structured data. Only real facts go in: fact() drops every HOLD (and never
 * substitutes a production fallback), so JSON-LD never carries placeholder
 * text. No offers until prices are real. The <script> itself comes from the
 * frozen JsonLd component, which escapes every '<'.
 */

export const ORG_ID = `${site.url}/#organization`
export const SITE_ID = `${site.url}/#website`

const abs = (path: string) => (path === '/' ? site.url : `${site.url}${path}`)
const facts = (list: readonly Parameters<typeof fact>[0][]) =>
  list.map(fact).filter((v): v is string => Boolean(v))

/** Organization and WebSite, in one @graph at the root. */
export function siteGraph(): Graph {
  const email = fact(site.email)
  const legalName = fact(site.legalName)
  const areaServed = facts(site.areaServed)
  const sameAs = facts(site.sameAs)
  const org: Organization = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    url: site.url,
    description: seo.home.description,
    logo: {
      '@type': 'ImageObject',
      url: abs(LOGO.path),
      width: `${LOGO.size}`,
      height: `${LOGO.size}`,
    },
    ...(legalName ? { legalName } : {}),
    ...(email
      ? {
          email,
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'sales',
            email,
            url: abs(PATH.contact),
          },
        }
      : {}),
    ...(areaServed.length ? { areaServed } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        name: site.name,
        url: site.url,
        description: seo.home.description,
        inLanguage: site.locale,
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/** The six services and the breadcrumb for /services. Never any offers. */
export function servicesGraph(): Graph {
  const areaServed = facts(site.areaServed)
  const list: SchemaService[] = services.map((s) => ({
    '@type': 'Service',
    '@id': `${abs(PATH.services)}#${s.slug}`,
    name: s.name,
    serviceType: s.schemaType,
    description: s.promise,
    provider: { '@id': ORG_ID },
    url: `${abs(PATH.services)}#${s.slug}`,
    ...(areaServed.length ? { areaServed } : {}),
  }))
  const home = site.nav.find((n) => n.page === 'home')?.label ?? site.name
  const crumbs: BreadcrumbList = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: home, item: site.url },
      { '@type': 'ListItem', position: 2, name: seo.services.title, item: abs(PATH.services) },
    ],
  }
  return { '@context': 'https://schema.org', '@graph': [...list, crumbs] }
}
