import s from './ui.module.css'

/**
 * The Pause motion switch: a native checkbox with role="switch" (checked =
 * paused). The head script ticks every switch to match html[data-motion] and
 * listens for changes, so it works before hydration; with JS off, CSS pauses
 * everything through html:has(input[data-motion-switch]:checked). React never
 * writes the state. 32 px tall in strips and the header, 44 px in the menu.
 *
 * `short` (the header) is the label's first word or words: where the bar is
 * tight, CSS hides the rest visually but keeps it in the accessible name, so
 * the name always starts with the visible words (WCAG 2.5.3).
 */
export function MotionSwitch({
  variant,
  label,
  short,
}: {
  variant: 'header' | 'strip' | 'footer' | 'menu'
  label: string
  short?: string
}) {
  const split = short && label.startsWith(short) && label.length > short.length
  return (
    <label className={s.switch} data-variant={variant}>
      <input
        type="checkbox"
        role="switch"
        data-motion-switch=""
        className={`motion-switch ${s.switchInput}`}
        suppressHydrationWarning
      />
      {split ? (
        <span className={s.switchLabel}>
          {short}
          <span data-switch-more="">{label.slice(short.length)}</span>
        </span>
      ) : (
        <span className={s.switchLabel}>{label}</span>
      )}
    </label>
  )
}
