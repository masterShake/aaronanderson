'use client'
import { useEffect } from 'react'
import { useFigure } from '@/figures/use-figure.client'
import type { FigureConfig } from '@/figures/types'

/** The figure's client half: arms the time gate, then rests on the drawing once its layers load. */
const CONFIG: FigureConfig = { driver: 'time' }

export function AfterContactController() {
  const fig = useFigure('after-contact', CONFIG)
  useEffect(() => {
    const root = fig.root
    if (!root || root.dataset.phase === 'still') return
    const settle = () => {
      if (root.dataset.layers === 'ready' && root.dataset.inview !== undefined) fig.done()
    }
    const mo = new MutationObserver(settle)
    mo.observe(root, { attributes: true, attributeFilter: ['data-layers', 'data-inview'] })
    settle()
    return () => mo.disconnect()
  }, [fig])
  return null
}
