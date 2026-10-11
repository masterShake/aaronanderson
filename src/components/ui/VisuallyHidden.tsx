import type { ReactNode } from 'react'

/** Text for screen readers only. */
export function VisuallyHidden({
  as: As = 'span',
  children,
}: {
  as?: 'span' | 'div' | 'p'
  children: ReactNode
}) {
  return <As className="sr-only">{children}</As>
}
