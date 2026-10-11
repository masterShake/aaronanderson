import type { Metadata, Viewport } from 'next'
import './globals.css'
import { fontVariables } from './fonts'
import { HEAD_SCRIPT } from '@/motion/head-script'
import { timingCss } from '@/motion/timing-css'
import { HtmlStateSync } from '@/motion/HtmlStateSync.client'
import { rootMetadata } from '@/lib/metadata'
import { siteGraph } from '@/lib/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'
import { SkipLink } from '@/components/chrome/SkipLink'
import { Header } from '@/components/chrome/Header'
import { Footer } from '@/components/chrome/Footer'
import { StageHost } from '@/stage/StageHost.client'

export const metadata: Metadata = rootMetadata()
export const viewport: Viewport = { themeColor: '#F4F2EC', colorScheme: 'light' }

/**
 * The root layout: one <main>, the skip link first, the head script before
 * anything paints, and the site JSON-LD. Frozen after W0.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en-US"
      className={fontVariables}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script id="ae-head" dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
        <style id="ae-timing" dangerouslySetInnerHTML={{ __html: timingCss }} />
        <JsonLd id="ld-site" data={siteGraph()} />
      </head>
      <body>
        <SkipLink />
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <StageHost />
        <HtmlStateSync />
      </body>
    </html>
  )
}
