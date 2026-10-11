import s from './ui.module.css'

/**
 * The Pause motion switch: a native checkbox with role="switch". The head
 * script ticks it and listens for changes, so it works before hydration;
 * CSS pauses everything through html:has(input[data-motion-switch]:checked).
 */
export function MotionSwitch({
  variant,
  label,
}: {
  variant: 'header' | 'strip' | 'footer' | 'menu'
  label: string
}) {
  return (
    <label className={s.switch} data-variant={variant}>
      <input
        type="checkbox"
        role="switch"
        data-motion-switch=""
        className="motion-switch"
        suppressHydrationWarning
      />
      <span>{label}</span>
    </label>
  )
}
