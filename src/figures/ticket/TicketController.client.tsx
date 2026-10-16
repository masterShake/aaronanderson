'use client'
import { useEffect, useMemo } from 'react'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'

/**
 * The ticket's client half: the frozen step driver (through useFigure) sets
 * data-rev from the step sections that carry data-rev-value; this keeps the
 * REV chip in step with it (FigureFrame prints the chip once, at REV 0). The
 * /kit/fig harness has no steps, so ?state=rev2 sets the revision there.
 */
export function TicketController({
  revs,
  status,
  statusClass,
}: {
  revs?: Readonly<Record<string, string>>
  /** The revision's status after the number (ISSUED FOR REVIEW...); CSS drops it on phones. */
  status?: Readonly<Record<string, string>>
  statusClass?: string
}) {
  const config = useMemo<FigureConfig>(
    () => ({
      driver: 'steps',
      steps: () => [...document.querySelectorAll<HTMLElement>('section[data-rev-value]')],
    }),
    [],
  )
  const api = useFigure('ticket', config)
  useEffect(() => {
    const el = api.root ?? document.getElementById('fig-ticket')
    if (!el || !revs) return
    const chip = el.querySelector<HTMLElement>('[data-rev-chip]')
    const sync = () => {
      const r = el.dataset.rev
      if (!chip || !r || !revs[r]) return
      chip.textContent = revs[r]
      const more = status?.[r]
      if (more) {
        const span = document.createElement('span')
        if (statusClass) span.className = statusClass
        span.textContent = ` · ${more}`
        chip.append(span)
      }
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(el, { attributes: true, attributeFilter: ['data-rev'] })
    return () => mo.disconnect()
  }, [api, revs, status, statusClass])
  return null
}
