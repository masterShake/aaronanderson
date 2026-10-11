'use client'
import { useEffect } from 'react'
import { bindStage } from '@/figures/use-figure.client'
import type { FigureHandle } from '@/stage/types'

/**
 * The demo's controller: registers the figure with the Stage and hands off
 * as soon as the scene is ready (the demo has no 2D phase). Events are
 * listed in data-events for the tests. Under ?frame=plan the debug hold
 * keeps it at the hand-off frame.
 */
export function DemoStage() {
  useEffect(() => {
    const root = document.getElementById('fig-stage-demo')
    if (!root) return
    let handle: FigureHandle | null = null
    const log: string[] = []
    const bound = bindStage(root, {
      scene: '_demo',
      mode: 'timeline',
      onEvent(e) {
        log.push(e.type === 'fallback' ? `fallback:${e.reason}` : e.type)
        root.dataset.events = log.join(' ')
        if (e.type === 'ready') handle?.requestHandoff('decision')
        // A demo, not a figure: run again a moment after idling, so the loop can be watched.
        if (e.type === 'beat' && e.beat === 'idle') setTimeout(() => handle?.play(), 1000)
      },
    })
    if (!bound) return
    handle = bound.handle
    return () => {
      handle = null
      bound.off()
    }
  }, [])
  return null
}
