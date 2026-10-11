'use client'
import { useEffect, useRef } from 'react'
import type { DrawingBundle, Layer } from '@/drawings/types'
import { LAYERS } from '@/drawings/types'

/**
 * A non-hero drawing. When the figure comes within about one viewport it
 * fetches the layer bundle ({figure}.{family}.json) for the family that fits
 * the container, injects each layer into its own stacked HTML-level <svg>, and
 * marks the figure data-layers="ready" (data-family names the family loaded).
 *
 * Still tier: it fetches nothing and the figure's still image shows. If the
 * visitor turns motion back on (html[data-tier] goes from still to svg, with
 * an `ae:state` event on document), it loads the layers then, with no reload.
 * If the container later crosses the family minimum, it loads the other
 * family. Without JS, <noscript> carries the still.
 */

const STATE_EVENT = 'ae:state'
const tier = () => document.documentElement.dataset.tier

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
    let cancelled = false
    let near = false
    let loaded: string | null = null
    let loading: string | null = null
    const famMin = Number(fig.dataset.famMin ?? 560)
    const want = () => (tallSrc && fig.clientWidth < famMin ? tallSrc : src)

    const load = () => {
      if (cancelled || !near || tier() === 'still') return
      const url = want()
      if (url === loaded || url === loading) return
      loading = url
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<DrawingBundle>) : null))
        .then((b) => {
          if (loading === url) loading = null
          if (!b || cancelled || url !== want()) return
          for (const layer of LAYERS as readonly Layer[]) {
            const svg = host.querySelector<SVGSVGElement>(`svg.l-${layer}`)
            if (!svg) continue
            svg.setAttribute('viewBox', `0 0 ${b.vb[0]} ${b.vb[1]}`)
            svg.innerHTML = b.layers[layer] ?? ''
          }
          loaded = url
          fig.dataset.family = url === tallSrc ? 'tall' : 'wide'
          fig.dataset.layers = 'ready'
        })
        .catch(() => {
          if (loading === url) loading = null
        })
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        near = true
        io.disconnect()
        load()
      },
      { rootMargin: '100% 0px' },
    )
    io.observe(fig)
    // motion turned back on: the head script lifts the tier from still to svg
    const onState = () => load()
    document.addEventListener(STATE_EVENT, onState)
    // the container crossed the family minimum
    const ro = tallSrc ? new ResizeObserver(() => load()) : null
    ro?.observe(fig)
    return () => {
      cancelled = true
      io.disconnect()
      ro?.disconnect()
      document.removeEventListener(STATE_EVENT, onState)
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
