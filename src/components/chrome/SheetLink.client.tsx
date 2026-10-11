'use client'
import { usePathname } from 'next/navigation'
import { transitionTypes } from '@/lib/routes'
import { IntentLink, type IntentLinkProps } from '@/components/ui/IntentLink.client'

/** A Link that prints the next sheet forward or back, by reading order (prefetched on intent). */
export function SheetLink({
  href,
  children,
  className,
  ...rest
}: IntentLinkProps & { className?: string }) {
  const pathname = usePathname()
  return (
    <IntentLink
      href={href}
      className={className}
      transitionTypes={transitionTypes(pathname, href)}
      {...rest}
    >
      {children}
    </IntentLink>
  )
}
