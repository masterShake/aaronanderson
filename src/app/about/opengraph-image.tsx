import { seo } from '@/content/seo'
import { ogImage } from '@/lib/seo/og'

/** G-02 project directory card. */
export const alt = seo.about.og.alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return ogImage('about')
}
