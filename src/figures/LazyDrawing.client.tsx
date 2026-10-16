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
 * Still tier: it fetches nothing and the figure's still image shows, until the
 * visitor asks for this figure (Play the drawing sets data-user-play). If the
 * visitor turns motion back on (html[data-tier] goes from still to svg, with
 * an `ae:state` event on document), it loads the layers then, with no reload.
 * If the container later crosses the family minimum, it loads the other
 * family. Without JS, <noscript> carries the still.
 */

const STATE_EVENT = 'ae:state'
const tier = () => document.documentElement.dataset.tier

/*
 * The label reveal rule, by default (W4b K3; _finish B5: a label never floats over an empty
 * panel). A label's object is every draw-on path (`path.draw`) that passes within PAD CSS px of
 * the label, or whose closed outline holds the label's centre. While any of them is not yet
 * fully drawn (stroke-dashoffset above 0.02 of its pathLength), the label carries
 * data-waiting, which figures.css hides. It reads the computed dash offset, so it follows CSS
 * animations, scroll scrubs (--p) and Web Animations alike, with no per-figure timing.
 *
 * Opt out per label with data-reveal (explicit --reveal-at / --reveal-ms timing, or
 * data-reveal="free" to show it with no wait). Nothing waits in the still tier, under reduced
 * motion, on a WebGL stage (the Stage places those labels), or once a time-driven play is done.
 */
const PAD = 6
const DRAWN = 0.02

interface Watched {
  label: HTMLElement
  paths: SVGPathElement[]
}

/** Points along a path in client px, about every 8 px, plus whether the path closes. */
function trace(p: SVGPathElement): { pts: DOMPoint[]; closed: boolean } | null {
  const m = p.getScreenCTM()
  if (!m) return null
  let len = 0
  try {
    len = p.getTotalLength()
  } catch {
    return null
  }
  if (!(len > 0)) return null
  const scale = Math.hypot(m.a, m.b) || 1
  const n = Math.min(400, Math.max(4, Math.ceil((len * scale) / 8)))
  const pts: DOMPoint[] = []
  for (let i = 0; i <= n; i++) pts.push(p.getPointAtLength((len * i) / n).matrixTransform(m))
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  return { pts, closed: Math.hypot(a.x - b.x, a.y - b.y) < 3 }
}

/**
 * Shown on its layer: not under a display:none group or layer (the other family, another
 * state), and, with `now`, not under a hidden or transparent one either (a faded layer never
 * holds a label back). The path's own opacity is not read: a draw-on starts transparent.
 */
function shown(p: SVGPathElement, now = false): boolean {
  const g = p.parentElement
  if (!g) return false
  const check = (g as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility
  return check
    ? check.call(g, now ? { opacityProperty: true, visibilityProperty: true } : {})
    : true
}

function objectsOf(fig: HTMLElement): Watched[] {
  const labels = [...fig.querySelectorAll<HTMLElement>('.box > .labels > *')].filter(
    (l) => !l.hasAttribute('data-reveal'),
  )
  if (!labels.length) return []
  const paths = [...fig.querySelectorAll<SVGPathElement>('.box > .drawing svg path.draw')].filter(
    (p) => shown(p),
  )
  const traced = paths.flatMap((p) => {
    const t = trace(p)
    if (!t) return []
    const xs = t.pts.map((q) => q.x)
    const ys = t.pts.map((q) => q.y)
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const
    return [{ p, t, box, area: (box[2] - box[0]) * (box[3] - box[1]) }]
  })
  const out: Watched[] = []
  for (const label of labels) {
    const r = label.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const x0 = r.left - PAD
    const x1 = r.right + PAD
    const y0 = r.top - PAD
    const y1 = r.bottom + PAD
    const cx = (r.left + r.right) / 2
    const cy = (r.top + r.bottom) / 2
    // a label inside a closed outline names that outline's object (the smallest one round it);
    // otherwise its object is what it touches: a leader, a symbol beside it
    const inside = traced
      .filter(({ t, box }) => t.closed && cx > box[0] && cx < box[2] && cy > box[1] && cy < box[3])
      .sort((a, b) => a.area - b.area)[0]
    const hit = inside
      ? [inside.p]
      : traced
          .filter(({ t }) => t.pts.some((q) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1))
          .map(({ p }) => p)
    // and the rest of each object it found (the same data-part: a box's glyph, a card's lines)
    const parts = new Set(hit.map((p) => p.dataset.part).filter(Boolean))
    const mine = parts.size
      ? [...new Set([...hit, ...paths.filter((p) => parts.has(p.dataset.part))])]
      : hit
    if (mine.length) out.push({ label, paths: mine })
  }
  return out
}

/** Watches one figure's labels; returns the cleanup. */
export function watchLabels(fig: HTMLElement): () => void {
  let watched: Watched[] = []
  let raf = 0
  let inView = false
  let stale = true
  const free = () =>
    tier() === 'still' ||
    fig.dataset.stage === 'webgl' ||
    fig.dataset.phase === 'still' ||
    (fig.dataset.phase === 'done' && fig.dataset.driver !== 'scroll') ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  const clear = () => {
    for (const l of fig.querySelectorAll('.labels > [data-waiting]'))
      l.removeAttribute('data-waiting')
  }
  const tick = () => {
    raf = 0
    if (!inView) return
    if (free()) {
      clear()
      return
    }
    if (stale) {
      // measure with every label in place (a waiting label keeps its box, only hidden)
      watched = objectsOf(fig)
      stale = false
    }
    for (const w of watched) {
      const wait = w.paths.some((p) => {
        if (!p.isConnected) return false
        const o = parseFloat(getComputedStyle(p).strokeDashoffset) || 0
        return o > DRAWN && shown(p, true)
      })
      if (wait !== w.label.hasAttribute('data-waiting'))
        w.label.toggleAttribute('data-waiting', wait)
    }
    raf = requestAnimationFrame(tick)
  }
  const kick = () => {
    if (!raf && inView) raf = requestAnimationFrame(tick)
  }
  const restale = () => {
    stale = true
    kick()
  }
  const io = new IntersectionObserver((es) => {
    inView = es.some((e) => e.isIntersecting)
    if (inView) restale()
  })
  io.observe(fig)
  // new layers, a new family or state, a new run, a new phase or stage
  const mo = new MutationObserver(restale)
  mo.observe(fig, {
    attributeFilter: [
      'data-layers',
      'data-family',
      'data-rev',
      'data-toggle',
      'data-run',
      'data-phase',
      'data-stage',
      'data-labels',
    ],
  })
  const ro = new ResizeObserver(restale)
  ro.observe(fig)
  document.addEventListener(STATE_EVENT, restale)
  return () => {
    io.disconnect()
    mo.disconnect()
    ro.disconnect()
    document.removeEventListener(STATE_EVENT, restale)
    if (raf) cancelAnimationFrame(raf)
    clear()
  }
}

/** Mounts watchLabels on the figure around it (FigureFrame renders one in every figure). */
export function LabelReveal() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const fig = ref.current?.closest<HTMLElement>('figure[data-figure]')
    return fig ? watchLabels(fig) : undefined
  }, [])
  return <span ref={ref} hidden data-label-reveal="" />
}

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
    // the content-box width the `fig` container query sees (fractional, no border)
    const width = () => {
      const cs = getComputedStyle(fig)
      const edges = ['borderLeftWidth', 'borderRightWidth', 'paddingLeft', 'paddingRight'] as const
      return fig.getBoundingClientRect().width - edges.reduce((n, k) => n + parseFloat(cs[k]), 0)
    }
    const want = () => (tallSrc && width() < famMin ? tallSrc : src)

    const load = () => {
      // Play the drawing in the still tier sets data-user-play: load then too
      if (cancelled || !near || (tier() === 'still' && !('userPlay' in fig.dataset))) return
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
    const mo = new MutationObserver(() => load())
    mo.observe(fig, { attributeFilter: ['data-user-play'] })
    return () => {
      cancelled = true
      io.disconnect()
      ro?.disconnect()
      mo.disconnect()
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
