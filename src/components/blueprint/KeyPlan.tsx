import Link from 'next/link'
import type { Route } from 'next'

/** A small key plan locating a detail on the Home drawing (owner: drawings lane). W0: an empty frame. */
export function KeyPlan({
  view,
  highlight,
  href,
  size = 120,
}: {
  view: string
  highlight: readonly string[]
  href?: Route
  size?: 120
}) {
  const box = (
    <svg
      aria-hidden="true"
      width={size}
      height={size * 0.66}
      data-view={view}
      data-highlight={highlight.join(' ')}
    >
      <rect
        x="1"
        y="1"
        width={size - 2}
        height={size * 0.66 - 2}
        fill="none"
        stroke="currentColor"
      />
    </svg>
  )
  return href ? <Link href={href}>{box}</Link> : box
}
