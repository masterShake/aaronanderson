import type { Claimable } from '@/content/types'
import { RichText } from '@/components/ui/RichText'

/** A section's heading (H2 by default) and its short body. */
export function SectionHead({
  id,
  h2,
  level = 2,
  body,
}: {
  id: string
  h2: string
  level?: 2 | 3
  body?: readonly Claimable[]
}) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <>
      <H id={`${id}-title`}>{h2}</H>
      {body?.map((b, i) => (
        <RichText key={i} value={b} />
      ))}
    </>
  )
}
