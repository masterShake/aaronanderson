'use client'
import { useEffect, useRef, useState } from 'react'
import type { StageEvent } from '@/stage/types'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'
import { scrubMode, whenNear } from '../s02/env.client'
import type { S04Geo, S04Props } from './run.client'

export type { S04Geo }

/**
 * The S-04 controller (owner: scenes-a). It registers the figure at once (useFigure) and
 * loads the rest (run.client.ts: drivers, loops, the question chips) when the figure comes
 * within a viewport, which keeps the services page's first-load JavaScript small.
 */
export function S04Controller({ geo, done }: S04Props) {
  const [config] = useState<FigureConfig>(() => ({
    driver: 'scroll',
    stage: { scene: 's04', load: 'near', mode: scrubMode('fig-s04') ? 'scrub' : 'timeline' },
  }))
  const events = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('s04', config, (e) => events.current(e))

  useEffect(() => {
    const root = document.getElementById('fig-s04')
    if (!root) return
    let off: (() => void) | null = null
    let gone = false
    const stop = whenNear(root, () => {
      void import('./run.client').then((m) => {
        if (!gone) off = m.runS04(root, api, config, { geo, done }, events)
      })
    })
    return () => {
      gone = true
      stop()
      off?.()
    }
  }, [api, config, geo, done])

  return null
}
