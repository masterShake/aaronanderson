import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { Claim } from '@/content/types'
import { resolveClaim } from '@/content/hold'
import { ConfirmMark } from '@/components/blueprint/ConfirmMark'

/**
 * A promise the owner may still have to CONFIRM. Pending: shown with a
 * CONFIRM mark in preview, left out in production. Cut: never shown.
 * When the render function returns an element (an <li>, a <p>), the mark goes
 * inside it, so lists and paragraphs keep valid structure.
 */
export function Claimed({
  value,
  children,
}: {
  value: Claim | string
  children: (text: string, pending: boolean) => ReactNode
}) {
  const r = resolveClaim(value)
  if (r.show === 'omit') return null
  const node = children(r.value, r.pending)
  if (!r.pending || !r.id) return <>{node}</>
  if (isValidElement(node) && typeof node.type === 'string') {
    const el = node as ReactElement<{ children?: ReactNode }>
    return cloneElement(el, {}, <ConfirmMark id={r.id}>{el.props.children}</ConfirmMark>)
  }
  return <ConfirmMark id={r.id}>{node}</ConfirmMark>
}
