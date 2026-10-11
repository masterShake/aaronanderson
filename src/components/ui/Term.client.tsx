'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import s from './ui.module.css'

/**
 * A glossary toggletip that reads its words from the legend (WCAG 1.4.13):
 * - shown on hover, focus or tap; the tip sits inside the hover area, so the
 *   pointer can move onto it (hoverable);
 * - stays until the pointer and focus leave, or the visitor dismisses it
 *   (persistent);
 * - Esc closes it from anywhere without moving focus or the pointer
 *   (dismissible). A tap toggles it, so touch visitors can close it too.
 * The term stays a real button with aria-expanded; the tip is announced through
 * aria-describedby while open.
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
  const [dismissed, setDismissed] = useState(false)
  const [alignEnd, setAlignEnd] = useState(false)
  const id = useId()
  const root = useRef<HTMLSpanElement>(null)
  const hover = useRef(false)
  const focus = useRef(false)
  const wasOpen = useRef<boolean | null>(null)

  const sync = () => setOpen(!dismissed && (hover.current || focus.current))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDismissed(true)
        setOpen(false)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    // Keep the tip on screen: flip it to the term's end edge near the right margin.
    const r = root.current?.getBoundingClientRect()
    if (r) setAlignEnd(r.left > window.innerWidth * 0.55)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <span
      ref={root}
      className={s.term}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        hover.current = true
        sync()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return
        hover.current = false
        setDismissed(false)
        setOpen(focus.current)
      }}
    >
      <button
        type="button"
        className={s.termButton}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-term={term}
        onPointerDown={() => {
          wasOpen.current = open
        }}
        onClick={() => {
          // A tap that focused the term (and so opened it) keeps it open; the next tap closes it.
          const close = wasOpen.current ?? open
          wasOpen.current = null
          setDismissed(close)
          setOpen(!close)
        }}
        onFocus={() => {
          focus.current = true
          sync()
        }}
        onBlur={() => {
          focus.current = false
          setDismissed(false)
          setOpen(hover.current)
        }}
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={s.termTip}
        data-align={alignEnd ? 'end' : undefined}
        hidden={!open}
      >
        {plain}
      </span>
    </span>
  )
}
