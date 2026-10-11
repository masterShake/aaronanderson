'use client'
import { useEffect, useMemo, useRef } from 'react'
import type { FigureId } from '@/content/types'
import { GATE } from '@/motion/timing/global'
import { gate, watchOffscreen } from '@/motion/visibility'
import { driveScroll } from '@/motion/scroll-driver'
import { watchSteps } from '@/motion/steps'
import type { FigureApi, FigureConfig } from './types'
import { figureDomId } from './types'

/**
 * The figure's client half (W0 stub, SVG only; owner: stage lane, which adds
 * the Stage registration, hand-off and label projection). Sets data-phase,
 * runs the entry gate, the off-screen watch and the scroll or step driver.
 */
export function useFigure(id: FigureId, config: FigureConfig): FigureApi {
  const root = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.getElementById(figureDomId(id))
    root.current = el
    if (!el) return
    const offs: (() => void)[] = []
    if (document.documentElement.dataset.tier === 'still') el.dataset.phase = 'still'
    else {
      el.dataset.phase = 'waiting'
      el.dataset.armed = ''
      offs.push(
        gate(el, config.gateRatio ?? GATE.entry, () => {
          el.dataset.inview = ''
          el.dataset.phase = 'playing'
        }),
      )
    }
    offs.push(watchOffscreen(el))
    const track = config.track?.()
    if (config.driver === 'scroll' && track) offs.push(driveScroll({ track, target: el }))
    const steps = config.steps?.()
    if (config.driver === 'steps' && steps?.length) offs.push(watchSteps({ figure: el, steps }))
    return () => offs.forEach((off) => off())
  }, [id, config])

  return useMemo<FigureApi>(() => {
    const el = () => root.current
    return {
      get root() {
        return el()
      },
      get phase() {
        return (el()?.dataset.phase as FigureApi['phase']) ?? 'waiting'
      },
      medium: 'svg',
      handle: null,
      play() {
        const f = el()
        if (!f) return
        f.dataset.userPlay = ''
        f.dataset.run = String(Number(f.dataset.run ?? '0') + 1)
        f.dataset.phase = 'playing'
      },
      setRev(rev) {
        const f = el()
        if (f) f.dataset.rev = rev
      },
      setToggle(value) {
        const f = el()
        if (f) f.dataset.toggle = value
      },
      setProgress(p) {
        el()?.style.setProperty('--p', p.toFixed(4))
      },
      command() {},
      announce(text) {
        const live = el()?.querySelector<HTMLElement>('[data-live]')
        if (live) live.textContent = text
      },
      markRest: () => false,
      done() {
        const f = el()
        if (!f) return
        f.dataset.phase = 'done'
        delete f.dataset.userPlay
      },
    }
  }, [])
}
