import type { Held } from '@/content/types'
import { resolveHeld } from '@/content/hold'
import { HoldChip } from '@/components/blueprint/HoldChip'
import { HoldCloud } from '@/components/blueprint/HoldCloud'

/** Text, a HOLD chip or cloud (preview), the production fallback, or nothing. */
export function HeldText({
  value,
  variant = 'inline',
}: {
  value: Held
  variant?: 'inline' | 'block'
}) {
  const r = resolveHeld(value)
  if (r.show === 'omit') return null
  if (r.show === 'text') return <>{r.text}</>
  return variant === 'block' ? <HoldCloud hold={r.hold} /> : <HoldChip hold={r.hold} />
}
