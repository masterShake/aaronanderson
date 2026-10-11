import s from './blueprint.module.css'

/** A rubber stamp, rotated −4°. Asphalt by default; redline only for problems. */
export function Stamp({
  text,
  tone = 'asphalt',
  live,
}: {
  text: string
  tone?: 'asphalt' | 'redline'
  live?: boolean
}) {
  return (
    <span
      className={`${s.stamp} ${tone === 'redline' ? s.redline : ''}`}
      {...(live ? { role: 'status' } : {})}
    >
      {text}
    </span>
  )
}
