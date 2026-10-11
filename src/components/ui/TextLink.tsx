import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { Href } from '@/content/types'
import s from './ui.module.css'

/**
 * A blueprint-colored text link. Internal routes use next/link; external
 * links get a drawn ↗ (an aria-hidden stroke, not a glyph).
 */
export function TextLink({
  href,
  external,
  children,
}: {
  href: Href
  external?: boolean
  children: ReactNode
}) {
  if (href.startsWith('/'))
    return (
      <Link href={href as Route} className={s.link}>
        {children}
      </Link>
    )
  return (
    <a
      href={href}
      className={s.link}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {external ? (
        <svg className={s.ext} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M2 8 8 2M3.5 2H8V6.5" />
        </svg>
      ) : null}
    </a>
  )
}
