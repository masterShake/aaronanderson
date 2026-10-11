import { iconImage } from '@/lib/seo/og'

/** The home-screen icon: the junction-box mark in paper on asphalt. */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return iconImage(180)
}
