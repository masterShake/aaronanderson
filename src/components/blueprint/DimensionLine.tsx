import type { CSSProperties } from 'react'
import s from './blueprint.module.css'

/**
 * A dimension line on a shared scale (for example 0 to 8 weeks). The drawn
 * length is decorative; the label carries the meaning in text. extendTo draws a
 * dashed extension past the span. Ends are architectural ticks or arrows;
 * variants: solid, range (a soft band), ticks (one per unit) and dots.
 */
export function DimensionLine({
  scale,
  span,
  extendTo,
  label,
  variant = 'solid',
  ends = 'ticks',
}: {
  scale: readonly [number, number]
  span: readonly [number, number]
  extendTo?: number
  label: string
  variant?: 'solid' | 'range' | 'ticks' | 'dots'
  ends?: 'ticks' | 'arrows'
}) {
  const total = Math.max(1, scale[1] - scale[0])
  const pct = (v: number) =>
    `${(Math.min(Math.max(v, scale[0]), scale[1]) - scale[0]) * (100 / total)}%`
  const style = {
    '--a': pct(span[0]),
    '--b': pct(Math.max(span[1], span[0] + total / 100)),
    '--x': pct(extendTo ?? span[1]),
    '--unit': `${100 / total}%`,
  } as CSSProperties
  return (
    <div className={s.dim} data-dim={variant} data-ends={ends} style={style}>
      <div className={s.dimTrack} aria-hidden="true">
        {extendTo !== undefined && extendTo > span[1] ? <span className={s.dimExt} /> : null}
        <span className={s.dimLine} />
      </div>
      <span className={s.dimLabel}>{label}</span>
    </div>
  )
}
