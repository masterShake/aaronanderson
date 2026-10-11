/**
 * The scroll driver (D8): writes `--p` (0 to 1) on a sticky figure as its text
 * column scrolls past. About 1 KB. Gated by IntersectionObserver, throttled to
 * one rAF per frame, and works in Firefox (no animation-timeline).
 *
 * If the figure is already on screen when first observed, p stays at 1 (the
 * finished drawing) until it has left the viewport once, so hydration never
 * flashes a finished drawing back to a partial one.
 */

export interface ScrollDriverOptions {
  /** Its height sets the scrub length (equal to the text column). */
  track: HTMLElement
  /** Receives --p (the sticky figure). */
  target: HTMLElement
  /** The sticky element whose computed `top` is the offset; default `target`. */
  sticky?: HTMLElement
  onProgress?: (p: number) => void
}

export function driveScroll(o: ScrollDriverOptions): () => void {
  const stickyEl = o.sticky ?? o.target
  let raf = 0
  let last = -1
  let live = false
  let held: boolean | null = null
  const write = (p: number) => {
    if (Math.abs(p - last) <= 0.001) return
    last = p
    o.target.style.setProperty('--p', p.toFixed(4))
    o.onProgress?.(p)
  }
  const tick = () => {
    raf = 0
    if (held) return write(1)
    const top = parseFloat(getComputedStyle(stickyEl).top) || 0
    const r = o.track.getBoundingClientRect()
    const span = Math.max(1, r.height - o.target.offsetHeight)
    write(Math.min(1, Math.max(0, (top - r.top) / span)))
  }
  const on = () => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver(
    ([e]) => {
      const v = !!e?.isIntersecting
      // First observation: already on screen means hold the finished drawing.
      if (held === null) held = v && (e?.intersectionRatio ?? 0) >= 0.1
      else if (!v) held = false
      if (v === live) return
      live = v
      if (v) {
        addEventListener('scroll', on, { passive: true })
        addEventListener('resize', on)
        on()
      } else {
        removeEventListener('scroll', on)
        removeEventListener('resize', on)
      }
    },
    { threshold: [0, 0.1], rootMargin: '25% 0px' },
  )
  io.observe(o.track)
  return () => {
    io.disconnect()
    removeEventListener('scroll', on)
    removeEventListener('resize', on)
    cancelAnimationFrame(raf)
  }
}

export interface PlayDriverOptions {
  target: HTMLElement
  durationMs: number
  onProgress?: (p: number) => void
  onDone?: () => void
}

/**
 * Play mode (figures below 1024 px): p runs 0 to 1 linearly in time, only
 * while motion runs and the figure is on screen. Returns stop.
 */
export function drivePlay(o: PlayDriverOptions): () => void {
  let raf = 0
  let elapsed = 0
  let prev = 0
  const running = () =>
    (document.documentElement.dataset.motion !== 'paused' || 'userPlay' in o.target.dataset) &&
    !('offscreen' in o.target.dataset)
  const frame = (t: number) => {
    if (prev && running()) elapsed += t - prev
    prev = t
    const p = Math.min(1, elapsed / o.durationMs)
    o.target.style.setProperty('--p', p.toFixed(4))
    o.onProgress?.(p)
    if (p < 1) raf = requestAnimationFrame(frame)
    else o.onDone?.()
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
