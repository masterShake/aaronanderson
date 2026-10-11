'use client'
import { useId, useState, type ReactNode } from 'react'
import s from './ui.module.css'

/**
 * A glossary toggletip (WCAG 1.4.13): opens on hover, focus or tap, stays while
 * hovered, and Esc dismisses it.
 */
export function Term({
  term,
  plain,
  children,
}: {
  term: string
  plain: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className={s.term}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className={s.termButton}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        data-term={term}
      >
        {children}
      </button>
      <span id={id} role="tooltip" className={s.termTip} hidden={!open}>
        {plain}
      </span>
    </span>
  )
}
