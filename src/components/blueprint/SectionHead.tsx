import type { Claimable } from '@/content/types'
import { RichText } from '@/components/ui/RichText'
import s from './blueprint.module.css'

/**
 * A section's heading (H2 by default, H3 inside a section) with id
 * `{id}-title` for aria-labelledby, and its short body. Body lines may be
 * claims; RichText leaves pending ones out of production.
 */
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
    <div className={s.sectionHead}>
      <H id={`${id}-title`}>{h2}</H>
      {body?.map((b, i) => (
        <RichText key={i} value={b} />
      ))}
    </div>
  )
}
