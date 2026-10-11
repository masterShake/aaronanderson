import type { MetadataRoute } from 'next'
import { webManifest } from '@/lib/seo/site'

/** The web app manifest: name, colors and icons, all from content and tokens. */
export default function manifest(): MetadataRoute.Manifest {
  return webManifest()
}
