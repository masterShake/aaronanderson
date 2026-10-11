import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { Href } from '@/content/types'

/** A blueprint-colored text link; external links get a drawn ↗. */
export function TextLink({
  href,
  external,
  children,
}: {
  href: Href
  external?: boolean
  children: ReactNode
}) {
  if (href.startsWith('/')) return <Link href={href as Route}>{children}</Link>
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
      {external ? <span aria-hidden="true">{'↗'}</span> : null}
    </a>
  )
}
