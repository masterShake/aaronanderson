import s from './blueprint.module.css'

/**
 * A rubber stamp, rotated −4°, with a double rule. Asphalt by default; redline
 * only for problems. live makes it a polite status, for stamps that land after
 * an action (the figure plays the ae-stamp keyframes from motion.css).
 */
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
      className={`stamp ${s.stamp} ${tone === 'redline' ? s.redline : ''}`.trim()}
      data-tone={tone}
      {...(live ? { role: 'status' } : {})}
    >
      {text}
    </span>
  )
}
