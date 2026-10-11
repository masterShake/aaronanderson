import type { Claim } from '@/content/types'
import { resolveClaim } from '@/content/hold'
import { Claimed } from '@/components/ui/Claimed'
import s from './blueprint.module.css'

/** Numbered general notes; claims show only once confirmed (or marked, in preview). */
export function GeneralNotes({
  title,
  items,
}: {
  title: string
  items: readonly (string | Claim)[]
}) {
  return (
    <div>
      <p className={s.strip}>{title}</p>
      <ol className={s.notes}>
        {items
          .filter((it) => resolveClaim(it).show !== 'omit')
          .map((it, i) => (
            <li key={i}>
              <Claimed value={it}>{(text) => text}</Claimed>
            </li>
          ))}
      </ol>
    </div>
  )
}
