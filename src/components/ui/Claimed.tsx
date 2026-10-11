import type { ReactNode } from 'react'
import type { Claim } from '@/content/types'
import { resolveClaim } from '@/content/hold'
import { ConfirmMark } from '@/components/blueprint/ConfirmMark'

/**
 * A promise the owner may still have to CONFIRM. Pending: shown with a
 * CONFIRM mark in preview, left out in production. Cut: never shown.
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
  return r.pending && r.id ? <ConfirmMark id={r.id}>{node}</ConfirmMark> : <>{node}</>
}
