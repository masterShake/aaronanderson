'use client'
import Link, { type LinkProps } from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { transitionTypes } from '@/lib/routes'

/** A Link that prints the next sheet forward or back, by reading order. */
export function SheetLink({
  href,
  children,
  className,
  ...rest
}: Omit<LinkProps<Route>, 'href'> & { href: Route; children: ReactNode; className?: string }) {
  const pathname = usePathname()
  return (
    <Link
      href={href}
      className={className}
      transitionTypes={transitionTypes(pathname, href)}
      {...rest}
    >
      {children}
    </Link>
  )
}
