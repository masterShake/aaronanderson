'use client'
import { useEffect, useRef, useState } from 'react'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle.client'

/**
 * The org chart's two-state toggle (The usual chain / Ours) and its one-time
 * reveal (pages-drawings §6.9). The server renders "ours", which is also what
 * no-JS, reduced-motion and still-tier visitors keep. With motion running, a
 * figure still off screen switches to the chain, and once it is half visible
 * it waits a moment and scans to ours, once per page view. Any press of the
 * toggle cancels the reveal. Labels come in as props (no content imports here).
 */

export interface OrgChartToggleProps {
  figure: string
  label: string
  options: readonly [{ value: string; label: string }, { value: string; label: string }]
  initial: string
  /** The state the reveal starts from. */
  from: string
  /** REV chip text per state. */
  chips: Readonly<Record<string, string>>
  /** Wait before the reveal, ms. */
  delay: number
  /** How much of the figure must be visible before the reveal starts. */
  threshold: number
}

export function OrgChartToggle({
  figure,
  label,
  options,
  initial,
  from,
  chips,
  delay,
  threshold,
}: OrgChartToggleProps) {
  const [value, setValue] = useState(initial)
  const touched = useRef(false)

  // mirror the state onto the figure: data-toggle and data-rev, the chip. Leaving the reveal's
  // quiet start happens in the same frame as the switch, so the chain never replays its fade
  useEffect(() => {
    const fig = document.getElementById(figure)
    if (!fig) return
    if (value !== from) delete fig.dataset.quiet
    fig.dataset.toggle = value
    fig.dataset.rev = value
    const chip = fig.querySelector<HTMLElement>('[data-rev-chip]')
    if (chip && chips[value]) chip.textContent = chips[value]
  }, [figure, value, from, chips])

  // the one-time reveal: chain while off screen (already whole, with no fade-in: data-quiet),
  // then ours once half visible
  useEffect(() => {
    const fig = document.getElementById(figure)
    const html = document.documentElement
    if (!fig || html.dataset.motion !== 'run' || html.dataset.tier === 'still') return
    const r = fig.getBoundingClientRect()
    if (r.top < innerHeight && r.bottom > 0) return
    fig.dataset.quiet = ''
    setValue(from)
    let timer: ReturnType<typeof setTimeout> | null = null
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.intersectionRatio >= threshold)) return
        io.disconnect()
        timer = setTimeout(() => {
          if (!touched.current) setValue(initial)
        }, delay)
      },
      { threshold },
    )
    io.observe(fig)
    return () => {
      io.disconnect()
      if (timer) clearTimeout(timer)
      delete fig.dataset.quiet
    }
  }, [figure, from, initial, delay, threshold])

  return (
    <SegmentedToggle
      label={label}
      options={options}
      value={value}
      onChange={(v) => {
        touched.current = true
        setValue(v)
      }}
    />
  )
}
