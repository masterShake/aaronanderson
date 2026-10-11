import s from './blueprint.module.css'

/** The north arrow: back to top in the footer, START HERE on the sheet index. */
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
    <a href={href} className={s.strip} data-variant={variant}>
      <span aria-hidden="true">{'↑'}</span> {label}
    </a>
  )
}
