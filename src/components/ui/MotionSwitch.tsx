import s from './ui.module.css'

/**
 * The Pause motion switch: a native checkbox with role="switch" (checked =
 * paused). The head script ticks every switch to match html[data-motion] and
 * listens for changes, so it works before hydration; with JS off, CSS pauses
 * everything through html:has(input[data-motion-switch]:checked). React never
 * writes the state. 32 px tall in strips and the header, 44 px in the menu.
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
        className={`motion-switch ${s.switchInput}`}
        suppressHydrationWarning
      />
      <span className={s.switchLabel}>{label}</span>
    </label>
  )
}
