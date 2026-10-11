'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/content/types'
import { transitionTypes } from '@/lib/routes'

/** The five sheets, in reading order. The current one gets aria-current="page". */
export function NavLinks({
  items,
  variant,
}: {
  items: readonly NavItem[]
  variant: 'bar' | 'menu'
}) {
  const pathname = usePathname()
  return (
    <ul data-variant={variant}>
      {items.map((it) => (
        <li key={it.page}>
          <Link
            href={it.href}
            aria-current={pathname === it.href ? 'page' : undefined}
            transitionTypes={transitionTypes(pathname, it.href)}
          >
            {it.label}
            {variant === 'menu' ? <span aria-hidden="true"> · {it.sheet}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
