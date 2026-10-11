import type { MetadataRoute } from 'next'
import { robotsRules } from '@/lib/seo/site'

/** Crawl everything but the preview pages; point at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return robotsRules()
}
