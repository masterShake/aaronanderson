import { seo } from '@/content/seo'
import { ogImage } from '@/lib/seo/og'

/** S-00 services card. */
export const alt = seo.services.og.alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return ogImage('services')
}
