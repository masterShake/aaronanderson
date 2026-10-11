import type { Hold } from '@/content/types'
import { SHOW_HOLDS } from '@/content/hold'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/**
 * An inline HOLD marker: dashed graphite with a HOLD tab, never redline (D11).
 * Preview only: a production build renders the HOLD's fallback text, or nothing.
 */
export function HoldChip({ hold }: { hold: Hold }) {
  if (!SHOW_HOLDS) return hold.prodFallback ? <>{hold.prodFallback}</> : null
  return (
    <span className={s.holdChip} data-hold={hold.id} data-essential={hold.essential || undefined}>
      <span className={s.holdTab} aria-hidden="true">
        {site.marks.hold}
      </span>
      <span className="sr-only">{site.marks.holdLabel}</span> <span>{hold.note}</span>
    </span>
  )
}
