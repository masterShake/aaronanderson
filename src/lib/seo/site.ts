import type { MetadataRoute } from 'next'
import { site } from '@/content/site'
import { seo } from '@/content/seo'
import { PATH, SHEET_ORDER } from '@/lib/routes'
import { COLOR } from '@/styles/tokens'

/**
 * Site-level SEO files: sitemap, robots and the web manifest. Everything comes
 * from content and the frozen routes, so a new sheet needs no edit here.
 */

/** Preview-only pages: never in the sitemap, disallowed in robots, 404 in production. */
export const PREVIEW_PATHS = ['/kit', '/punch-list'] as const

/** The square brand PNG in public/, used as the JSON-LD logo and the large manifest icon. */
export const LOGO = { path: '/brand/logo-512.png', size: 512 } as const

const abs = (path: string) => (path === '/' ? site.url : `${site.url}${path}`)

export function sitemapEntries(): MetadataRoute.Sitemap {
  return SHEET_ORDER.map((key, i) => ({
    url: abs(PATH[key]),
    changeFrequency: 'monthly' as const,
    priority: i === 0 ? 1 : 0.8,
  }))
}

export function robotsRules(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...PREVIEW_PATHS] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}

export function webManifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: seo.home.description,
    lang: site.locale,
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: COLOR.paper,
    theme_color: COLOR.paper,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: LOGO.path, sizes: `${LOGO.size}x${LOGO.size}`, type: 'image/png' },
    ],
  }
}
