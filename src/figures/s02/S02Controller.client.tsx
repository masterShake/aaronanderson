'use client'
import { useEffect, useRef, useState } from 'react'
import type { StageEvent } from '@/stage/types'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'
import { leadIn } from '@/figures/s01/lead-in.client'
import { pinnedP, scrubMode, whenNear } from './env.client'
import type { S02Geo, S02Props } from './run.client'

export type { S02Geo }

/**
 * The S-02 controller (owner: scenes-a). It registers the figure at once (useFigure, so
 * the Stage can follow its load policy) and loads the rest (run.client.ts: drivers, the
 * loop mechanism, controls) when the figure comes within a viewport, which keeps the
 * services page's first-load JavaScript small.
 */
export function S02Controller({ geo, live }: S02Props) {
  const [config] = useState<FigureConfig>(() => ({
    driver: 'scroll',
    stage: { scene: 's02', load: 'near', mode: scrubMode('fig-s02') ? 'scrub' : 'timeline' },
  }))
  const events = useRef<(e: StageEvent) => void>(() => {})
  const api = useFigure('s02', config, (e) => events.current(e))

  useEffect(() => {
    const root = document.getElementById('fig-s02')
    if (!root) return
    // the starting sketch draws on as the figure scrolls in (--pre), complete by p = 0;
    // at mount, not with run.client, so a late load never takes a drawn sketch back
    const offLead = pinnedP() === null ? leadIn(root) : () => {}
    let off: (() => void) | null = null
    let gone = false
    const stop = whenNear(root, () => {
      void import('./run.client').then((m) => {
        if (!gone) off = m.runS02(root, api, config, { geo, live }, events)
      })
    })
    return () => {
      gone = true
      offLead()
      stop()
      off?.()
    }
  }, [api, config, geo, live])

  return null
}
