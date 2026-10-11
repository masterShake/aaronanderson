import { seo } from '@/content/seo'
import { ogImage } from '@/lib/seo/og'

/** G-01 cover sheet card (also the fallback for every route without its own). */
export const alt = seo.home.og.alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return ogImage('home')
}
