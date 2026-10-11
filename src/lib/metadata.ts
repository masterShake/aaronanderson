import type { Metadata } from 'next'
import { site } from '@/content/site'
import { seo } from '@/content/seo'
import type { SeoKey } from '@/content/types'
import { IS_PRODUCTION } from './env'
import { PATH } from './routes'

/** Page metadata, all from src/content/seo.ts. Only production is indexable. */

const OG = { siteName: site.name, locale: 'en_US', type: 'website' } as const

export const rootMetadata = (): Metadata => ({
  metadataBase: new URL(site.url),
  title: { default: seo.home.title, template: `%s · ${site.name}` },
  description: seo.home.description,
  applicationName: site.name,
  openGraph: { ...OG },
  twitter: { card: 'summary_large_image' },
  robots: IS_PRODUCTION ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
})

export function pageMetadata(key: SeoKey): Metadata {
  const s = seo[key]
  const path = key in PATH ? PATH[key as keyof typeof PATH] : undefined
  const hidden = key === 'not-found' || key === 'punch-list' || key === 'kit'
  return {
    title: s.absolute ? { absolute: s.title } : s.title,
    description: s.description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      ...OG,
      title: s.og.title,
      description: s.description,
      ...(path ? { url: path } : {}),
    },
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
  }
}
