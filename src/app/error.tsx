'use client'
import { errorPage } from '@/content/pages/not-found'
import { site } from '@/content/site'
import { ErrorSheet } from '@/components/chrome/ErrorSheet'
import { IntentLink } from '@/components/ui/IntentLink.client'
import navStyles from '@/components/chrome/chrome.module.css'

/**
 * A route that threw (critic gap 2): the sheet-styled error page inside the
 * normal header and footer. Try again re-renders the segment (retry in Next
 * 16.3; reset where retry is absent); links to all five sheets and Book a call.
 * Error boundaries must be client components, so the copy is imported here.
 */
export default function Error({
  retry,
  reset,
}: {
  error: Error & { digest?: string }
  retry?: () => void
  reset?: () => void
}) {
  return (
    <ErrorSheet
      copy={errorPage}
      strip={`${site.sheet.label} — · ${site.sheet.scale}`}
      nav={site.nav}
      book={{ label: site.cta.book, href: site.cta.href }}
      onRetry={() => (retry ?? reset)?.()}
      link={(it) => (
        <IntentLink href={it.href} className={navStyles.errorLink}>
          <span className={navStyles.indexSheet}>{it.sheet}</span> {it.label}
        </IntentLink>
      )}
    />
  )
}
