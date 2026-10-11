'use client'
import './globals.css'
import { fontVariables } from './fonts'
import { errorPage } from '@/content/pages/not-found'
import { site } from '@/content/site'
import { ErrorSheet } from '@/components/chrome/ErrorSheet'
import navStyles from '@/components/chrome/chrome.module.css'

/**
 * The root layout itself threw: global-error replaces it, so it brings its own
 * <html>, <body>, styles and fonts, and a <title> (metadata is not supported
 * here). Every link is a plain <a>, since the router may be what broke.
 */
export default function GlobalError({
  retry,
  reset,
}: {
  error: Error & { digest?: string }
  retry?: () => void
  reset?: () => void
}) {
  return (
    <html lang="en-US" className={fontVariables}>
      <body>
        <title>{errorPage.h1}</title>
        <main id="main" tabIndex={-1}>
          <ErrorSheet
            copy={errorPage}
            strip={`${site.wordmark} · ${site.sheet.label} —`}
            nav={site.nav}
            book={{ label: site.cta.book, href: site.cta.href }}
            onRetry={() => (retry ?? reset)?.()}
            link={(it) => (
              <a href={it.href} className={navStyles.errorLink}>
                <span className={navStyles.indexSheet}>{it.sheet}</span> {it.label}
              </a>
            )}
          />
        </main>
      </body>
    </html>
  )
}
