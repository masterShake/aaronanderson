'use client'
import { useEffect, useRef } from 'react'
import type { DrawingBundle, Layer } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'

/**
 * A non-hero drawing: fetches its layer bundle when the figure comes within
 * one viewport, injects each layer into its own stacked <svg>, and marks the
 * figure data-layers="ready". On the still tier it fetches nothing (the
 * figure's still image shows). W0 minimal; owner: drawings lane.
 */
export function LazyDrawing({
  src,
  tallSrc,
  stillSrc,
  alt = '',
}: {
  src: string
  tallSrc?: string
  stillSrc: string
  alt?: ''
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    const fig = host?.closest<HTMLElement>('figure[data-figure]')
    if (!host || !fig) return
    if (document.documentElement.dataset.tier === 'still') return
    let cancelled = false
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        const tall = tallSrc && fig.clientWidth < 440
        if (tall) fig.dataset.family = 'tall'
        fetch(tall ? tallSrc : src)
          .then((r) => (r.ok ? (r.json() as Promise<DrawingBundle>) : null))
          .then((b) => {
            if (!b || cancelled) return
            for (const layer of LAYERS as readonly Layer[]) {
              const svg = host.querySelector<SVGSVGElement>(`svg.l-${layer}`)
              const markup = b.layers[layer]
              if (!svg || !markup) continue
              svg.setAttribute('viewBox', `0 0 ${b.vb[0]} ${b.vb[1]}`)
              svg.innerHTML = markup
            }
            fig.dataset.layers = 'ready'
          })
          .catch(() => {})
      },
      { rootMargin: '100% 0px' },
    )
    io.observe(fig)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [src, tallSrc])
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {LAYERS.map((layer) => (
        <svg
          key={layer}
          className={`l-${layer}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        />
      ))}
      <noscript>
        <img src={stillSrc} alt={alt} className="still-img" />
      </noscript>
    </div>
  )
}
