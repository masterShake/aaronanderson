'use client'
import s from './ui.module.css'

export interface SegmentedToggleProps {
  label: string
  options: readonly [{ value: string; label: string }, { value: string; label: string }]
  value: string
  onChange(v: string): void
}

/** Two buttons with aria-pressed, e.g. As found / Rewired. */
export function SegmentedToggle({ label, options, value, onChange }: SegmentedToggleProps) {
  return (
    <div role="group" aria-label={label} className={s.toggle}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
