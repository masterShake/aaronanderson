import type { MetadataRoute } from 'next'
import { sitemapEntries } from '@/lib/seo/site'

/** Exactly the five sheets. Preview pages (/kit, /punch-list) are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries()
}
