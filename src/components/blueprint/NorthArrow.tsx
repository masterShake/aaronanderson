import s from './blueprint.module.css'

/**
 * The north arrow: back to top in the footer ('top'), START HERE on the sheet
 * index ('start-here'). A real link with real text; the drawn arrow is decorative.
 */
export function NorthArrow({
  label,
  href,
  variant,
}: {
  label: string
  href: '#main' | `#${string}`
  variant: 'top' | 'start-here'
}) {
  return (
    <a href={href} className={s.north} data-variant={variant}>
      <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <circle cx="14" cy="14" r="12.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 4.5 19 21 14 17.5Z" fill="currentColor" />
        <path d="M14 4.5 9 21 14 17.5Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
      <span>{label}</span>
    </a>
  )
}
