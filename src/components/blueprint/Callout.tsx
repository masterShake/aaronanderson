import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import s from './blueprint.module.css'

/** A callout box: a note, a machine spec, a redline problem, or a detail reference link. */
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
    <aside className={s.callout} data-variant={variant}>
      {href ? <Link href={href}>{children}</Link> : children}
    </aside>
  )
}
