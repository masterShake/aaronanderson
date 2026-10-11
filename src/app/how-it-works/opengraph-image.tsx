import { seo } from '@/content/seo'
import { ogImage } from '@/lib/seo/og'

/** P-00 process card. */
export const alt = seo['how-it-works'].og.alt
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return ogImage('how-it-works')
}
