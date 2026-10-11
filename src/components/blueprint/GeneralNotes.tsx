import type { Claim } from '@/content/types'
import { resolveClaim } from '@/content/hold'
import { Claimed } from '@/components/ui/Claimed'
import s from './blueprint.module.css'

/**
 * Numbered general notes, as on a drawing. Claims show only once confirmed
 * (or with a CONFIRM mark, in preview); numbering skips the ones left out.
 */
export function GeneralNotes({
  title,
  items,
}: {
  title: string
  items: readonly (string | Claim)[]
}) {
  const shown = items.filter((it) => resolveClaim(it).show !== 'omit')
  if (!shown.length) return null
  return (
    <div>
      <p className={s.notesTitle}>{title}</p>
      <ol className={s.notes}>
        {shown.map((it, i) => (
          <li key={i}>
            <Claimed value={it}>{(text) => text}</Claimed>
          </li>
        ))}
      </ol>
    </div>
  )
}
