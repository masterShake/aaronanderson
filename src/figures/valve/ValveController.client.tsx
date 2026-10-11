'use client'
import { useEffect, useMemo } from 'react'
import type { DrawingBundle } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'
import type { FigureConfig } from '@/figures/types'
import { useFigure } from '@/figures/use-figure.client'

/**
 * The sign-off detail's client half. The sequence is CSS (valve.module.css),
 * gated until the figure is half in view; it plays once. Replay and Play the
 * drawing restart it for this figure only (data-user-play; nothing stored).
 * On the still tier the layers were never fetched, so Play loads them first.
 */
export function ValveController({ src, tallSrc }: { src?: string; tallSrc?: string }) {
  const config = useMemo<FigureConfig>(() => ({ driver: 'time', gateRatio: 0.5 }), [])
  const api = useFigure('valve', config)
  useEffect(() => {
    const el = api.root ?? document.getElementById('fig-valve')
    if (!el) return
    const restart = () => {
      const n = el.dataset.run ?? '0'
      delete el.dataset.run
      void el.offsetWidth
      el.dataset.run = n
    }
    const load = async () => {
      if (el.dataset.layers === 'ready' || !src) return
      const tall = tallSrc && el.clientWidth < Number(el.dataset.famMin ?? 560)
      const r = await fetch(tall ? tallSrc : src)
      if (!r.ok) return
      const b = (await r.json()) as DrawingBundle
      for (const layer of LAYERS) {
        const svg = el.querySelector<SVGSVGElement>(`.drawing svg.l-${layer}`)
        if (!svg) continue
        svg.setAttribute('viewBox', `0 0 ${b.vb[0]} ${b.vb[1]}`)
        svg.innerHTML = b.layers[layer] ?? ''
      }
      el.dataset.family = tall ? 'tall' : 'wide'
      el.dataset.layers = 'ready'
    }
    const onClick = async (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
      if (!btn || !el.contains(btn)) return
      const action = btn.dataset.action
      if (action !== 'replay' && action !== 'play') return
      await load()
      api.play()
      el.dataset.inview = ''
      restart()
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [api, src, tallSrc])
  return null
}
