'use client'
import Link, { type LinkProps } from 'next/link'
import type { Route } from 'next'
import {
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from 'react'

export type IntentLinkProps = Omit<LinkProps<Route>, 'href' | 'prefetch'> & {
  href: Route
  children: ReactNode
}

/**
 * A next/link to another route that prefetches on intent, not on viewport
 * (W2 handover #1, §B10 initial JS budget). It starts with prefetch={false}
 * and switches to the default (null) on pointerenter, focus or touchstart;
 * the link is then observed again and prefetched as usual.
 */
export function IntentLink({
  onPointerEnter,
  onFocus,
  onTouchStart,
  children,
  ...rest
}: IntentLinkProps) {
  const [intent, setIntent] = useState(false)
  return (
    <Link
      {...rest}
      prefetch={intent ? null : false}
      onPointerEnter={(e: PointerEvent<HTMLAnchorElement>) => {
        setIntent(true)
        onPointerEnter?.(e)
      }}
      onFocus={(e: FocusEvent<HTMLAnchorElement>) => {
        setIntent(true)
        onFocus?.(e)
      }}
      onTouchStart={(e: TouchEvent<HTMLAnchorElement>) => {
        setIntent(true)
        onTouchStart?.(e)
      }}
    >
      {children}
    </Link>
  )
}
