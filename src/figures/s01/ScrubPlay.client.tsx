'use client'
import { useEffect, useMemo } from 'react'
import type { FigureId } from '@/content/types'
import { useFigure } from '@/figures/use-figure.client'
import { figureDomId, type FigureConfig } from '@/figures/types'
import { drivePlay } from '@/motion/scroll-driver'
import { gate } from '@/motion/visibility'
import { GATE } from '@/motion/timing/global'
import { SERVICE_3D_QUERY } from '@/stage/host'
import { leadIn } from './lead-in.client'

/**
 * The client half of an SVG-only service figure (S-01, S-05). On a service
 * sheet at 1024 px and up with a fine pointer, the sheet's text column
 * ([data-scrub-track]) scrubs --p while the figure sticks. Anywhere else (or
 * with no track, as on /kit/fig) --p plays 0 → 1 over playMs once the figure
 * is in view, with Replay. On /kit/fig, ?p=0.5 pins the progress.
 */

const trackOf = (id: FigureId): HTMLElement | null =>
  document
    .getElementById(figureDomId(id))
    ?.closest('section')
    ?.querySelector<HTMLElement>('[data-scrub-track]') ?? null

const pinned = (): number | null => {
  const v = new URLSearchParams(location.search).get('p')
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null
}

export function ScrubPlay({
  id,
  playMs,
  lead = false,
}: {
  id: FigureId
  playMs: number
  /** Opt in to the lead-in (--pre): the figure's CSS reads it for its starting sketch. */
  lead?: boolean
}) {
  const config = useMemo<FigureConfig>(
    () => ({
      driver: 'scroll',
      track: () => (pinned() === null && matchMedia(SERVICE_3D_QUERY).matches ? trackOf(id) : null),
    }),
    [id],
  )
  const api = useFigure(id, config)

  useEffect(() => {
    const el = api.root
    if (!el || el.dataset.phase === 'still') return
    const p = pinned()
    if (p !== null) {
      el.style.setProperty('--p', String(p))
      return
    }
    // the starting sketch draws on as the figure scrolls in (--pre), complete by p = 0
    const offLead = lead ? leadIn(el) : () => {}
    if (config.track?.()) return offLead
    let stop: (() => void) | null = null
    const play = () => {
      stop?.()
      stop = drivePlay({ target: el, durationMs: playMs, onDone: () => api.done() })
    }
    const offGate = gate(el, GATE.entry, play)
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-action="replay"]')) return
      api.play()
      play()
    }
    el.addEventListener('click', onClick)
    return () => {
      offLead()
      offGate()
      stop?.()
      el.removeEventListener('click', onClick)
    }
  }, [api, config, playMs, lead])

  return null
}
