import { seo } from '@/content/seo'
import { ogImage } from '@/lib/seo/og'

/** G-03 request-for-information card. */
export const alt = seo.contact.og.alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return ogImage('contact')
}
