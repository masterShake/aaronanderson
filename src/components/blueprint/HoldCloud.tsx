import type { Hold } from '@/content/types'
import { site } from '@/content/site'
import s from './blueprint.module.css'

/** A block HOLD: a dashed cloud standing in for a photo, logo, stat, quote or section. */
export function HoldCloud({
  hold,
  kind = 'block',
  minHeight,
}: {
  hold: Hold
  kind?: 'block' | 'photo' | 'logo' | 'stat' | 'quote'
  minHeight?: number
}) {
  return (
    <div
      className={s.holdCloud}
      data-hold={hold.id}
      data-hold-cloud={kind}
      style={minHeight ? { minHeight } : undefined}
    >
      <span className={s.holdTab}>{site.marks.hold}</span>
      <span className="sr-only">{site.marks.holdLabel}</span>
      <span>{hold.note}</span>
    </div>
  )
}
