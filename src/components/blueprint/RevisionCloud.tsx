import { cloudPrim, deltaTag } from '@/drawings/symbols/clouds'
import { primD } from '@/drawings/lib/geometry'
import s from './RevisionCloud.module.css'

/**
 * A revision cloud around a box (pages-drawings §5.1): scallops of r = 7 along
 * the rect, redline for markups or dashed graphite for HOLDs, with a Δ tag at
 * the top left whose text is HTML. Static: no draw-on (B12 item 7). The width
 * and height are user units; the SVG scales with its container.
 */
export function RevisionCloud({
  width,
  height,
  tag,
  seed = 7,
  tone = 'redline',
}: {
  width: number
  height: number
  tag?: string
  seed?: number
  tone?: 'redline' | 'hold'
}) {
  const inset = 14
  const cloud = cloudPrim(
    { x: inset, y: inset, w: width - 2 * inset, h: height - 2 * inset },
    { seed: seed || 7 },
  )
  const delta = deltaTag([inset + 4, inset + 4], 18)
  return (
    <span className={s.wrap} data-tone={tone} style={{ aspectRatio: `${width} / ${height}` }}>
      <svg
        aria-hidden="true"
        focusable="false"
        className={s.svg}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
      >
        <path d={primD(cloud)} pathLength={1} className={s.cloud} />
        {tag ? <path d={primD(delta)} className={s.delta} /> : null}
      </svg>
      {tag ? (
        <span
          className={s.tag}
          style={{
            left: `${((inset + 4) / width) * 100}%`,
            top: `${((inset + 4) / height) * 100}%`,
          }}
        >
          {tag}
        </span>
      ) : null}
    </span>
  )
}
