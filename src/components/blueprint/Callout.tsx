import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import s from './blueprint.module.css'

/**
 * A callout box: a note, a machine spec (mono, blueprint), a redline problem
 * (clouded in redline), or a detail reference that links to the detail.
 */
export function Callout({
  variant,
  href,
  children,
}: {
  variant: 'note' | 'machine' | 'redline' | 'detail-ref'
  href?: Route
  children: ReactNode
}) {
  return (
    <div className={s.callout} data-variant={variant}>
      {href ? <Link href={href}>{children}</Link> : children}
    </div>
  )
}
