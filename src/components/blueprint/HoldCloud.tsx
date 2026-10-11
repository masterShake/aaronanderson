import type { Hold } from '@/content/types'
import { SHOW_HOLDS } from '@/content/hold'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/**
 * A block HOLD standing in for a photo, logo, stat, quote or whole block:
 * a dashed graphite frame with a HOLD tab (photos are hatched). Never redline.
 * Preview only: production renders the fallback text, or nothing.
 */
export function HoldCloud({
  hold,
  kind = 'block',
  minHeight,
}: {
  hold: Hold
  kind?: 'block' | 'photo' | 'logo' | 'stat' | 'quote'
  minHeight?: number
}) {
  if (!SHOW_HOLDS) return hold.prodFallback ? <p>{hold.prodFallback}</p> : null
  return (
    <div
      className={s.holdCloud}
      data-hold={hold.id}
      data-hold-cloud={kind}
      data-essential={hold.essential || undefined}
      style={minHeight ? { minBlockSize: minHeight } : undefined}
    >
      <span className={s.holdTab} aria-hidden="true">
        {site.marks.hold}
      </span>
      <p className={s.holdNote}>
        <span className="sr-only">{site.marks.holdLabel}</span> {hold.note}
      </p>
    </div>
  )
}
