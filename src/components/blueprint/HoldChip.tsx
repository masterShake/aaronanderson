import type { Hold } from '@/content/types'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/** An inline HOLD marker: dashed graphite with a HOLD tab. Preview only; never redline. */
export function HoldChip({ hold }: { hold: Hold }) {
  return (
    <span className={s.holdChip} data-hold={hold.id}>
      <span className={s.holdTab} aria-hidden="true">
        {site.marks.hold}
      </span>
      <span className="sr-only">{site.marks.holdLabel}</span>
      <span>{hold.note}</span>
    </span>
  )
}
