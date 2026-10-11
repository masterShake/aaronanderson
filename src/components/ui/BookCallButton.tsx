import type { ServiceId } from '@/content/types'
import { site } from '@/content/site'
import { BOOK_HREF, talkHref } from '@/lib/routes'
import { Button } from './Button'

/** The orange Book a call: /contact#book, or with a sheet preselected. */
export function BookCallButton({
  sheet,
  size = 'md',
  className,
}: {
  sheet?: ServiceId
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <Button
      variant="book"
      size={size}
      href={sheet ? talkHref(sheet) : BOOK_HREF}
      className={className}
    >
      {site.cta.book}
    </Button>
  )
}
