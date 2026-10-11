'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFigure } from '@/figures/use-figure.client'
import type { FigureConfig } from '@/figures/types'
import type { StageEvent } from '@/stage/types'
import { drivePlay } from '@/motion/scroll-driver'
import { gate } from '@/motion/visibility'
import { GATE } from '@/motion/timing/global'
import { S06 } from '@/motion/timing/s06'
import { SERVICE_3D_QUERY } from '@/stage/host'
import { IS_PRODUCTION } from '@/lib/env'

/**
 * S-06's client half. Scrub (1024 px and up, fine pointer, inside a services sheet): the sheet's
 * [data-scrub-track] drives --p through useFigure, and the Stage hands off at p .15. Otherwise
 * (phones, tablets, the /kit harness) p plays 0 → 1 on entry (drivePlay) with Replay. From
 * S06.motionFromP the inspection loops run (data-mech, CSS, three sweeps then idle).
 * Non-production ?p= pins p (frames and the seam check).
 */

const pinned = (): number | null => {
  if (IS_PRODUCTION || typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('p')
  const p = v === null ? NaN : Number(v)
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null
}

const trackOf = () => {
  if (!matchMedia(SERVICE_3D_QUERY).matches || pinned() !== null) return null
  return (
    document
      .getElementById('fig-s06')
      ?.closest('section')
      ?.querySelector<HTMLElement>('[data-scrub-track]') ?? null
  )
}

export function S06Controller() {
  const config = useMemo<FigureConfig>(
    () => ({
      driver: 'scroll',
      stage: { scene: 's06', load: 'near', mode: 'scrub' },
      track: trackOf,
    }),
    [],
  )
  // played p sweeps the hand-off window once: start only when the Stage is ready or out
  const settle = useRef<{ done: boolean; then: (() => void) | null }>({ done: false, then: null })
  const api = useFigure('s06', config, (e: StageEvent) => {
    if (e.type !== 'ready' && e.type !== 'fallback') return
    const s = settle.current
    s.done = true
    s.then?.()
    s.then = null
  })
  const stop = useRef<() => void>(() => {})

  useEffect(() => {
    const root = document.getElementById('fig-s06')
    if (!root) return
    const offs: (() => void)[] = []
    const onP = (p: number) => {
      if (p >= S06.motionFromP) root.dataset.mech = ''
    }
    const play = () => {
      stop.current()
      delete root.dataset.mech
      stop.current = drivePlay({
        target: root,
        durationMs: S06.playMs,
        onProgress: (p) => {
          api.handle?.setProgress(p)
          onP(p)
        },
      })
    }
    const pin = pinned()
    if (pin !== null) {
      api.setProgress(pin)
      onP(pin)
    } else if (!trackOf()) {
      const start = () => {
        const s = settle.current
        if (s.done) return play()
        const id = setTimeout(play, S06.settleMs)
        s.then = () => {
          clearTimeout(id)
          play()
        }
        offs.push(() => clearTimeout(id))
      }
      if (document.documentElement.dataset.tier !== 'still')
        offs.push(gate(root, GATE.entry, start))
    } else {
      // scrub: follow --p as the scroll driver writes it
      const mo = new MutationObserver(() => onP(parseFloat(root.style.getPropertyValue('--p'))))
      mo.observe(root, { attributes: true, attributeFilter: ['style'] })
      offs.push(() => mo.disconnect())
    }
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-action="replay"]')
      if (!b || !root.contains(b)) return
      api.play()
      if (!trackOf() && pinned() === null) return play()
      // scrub or pinned: replay the inspection loops where p stands
      delete root.dataset.mech
      void root.offsetWidth
      onP(parseFloat(root.style.getPropertyValue('--p')) || 0)
    }
    root.addEventListener('click', onClick)
    return () => {
      stop.current()
      offs.forEach((off) => off())
      root.removeEventListener('click', onClick)
    }
  }, [api])

  return null
}
