import s from './blueprint.module.css'

/** A graphic scale bar: alternating filled and open blocks with end ticks. Decorative. */
export function ScaleBar() {
  return (
    <svg className={s.scaleBar} aria-hidden="true" viewBox="0 0 120 14" focusable="false">
      <path d="M0.75 4h29.5v6H0.75zM60 4h30v6H60z" fill="currentColor" />
      <path
        d="M0.75 4h118.5v6H0.75zM0.75 1v12M30.25 1v12M60 1v12M90 1v12M119.25 1v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
