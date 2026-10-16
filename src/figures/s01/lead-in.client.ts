'use client'

/**
 * The lead-in (W4b: a figure never opens on an empty panel). Writes --pre (0 to 1) on the
 * figure from where it sits in the viewport: 0 while its top is still 15% below the
 * viewport, 1 once its top has risen to 55% of the viewport height (and above, so a stuck
 * figure always reads 1). The figure's CSS draws its starting sketch on max(--p, --pre), so
 * the sketch draws on while the figure scrolls in and is complete by the first frame of the
 * scrub or the play (p = 0). Unset, --pre falls back to 1 in the CSS (no JS, harness pins).
 */
export function leadIn(root: HTMLElement): () => void {
  let raf = 0
  let last = -1
  const tick = () => {
    raf = 0
    const vh = window.innerHeight || 1
    const top = root.getBoundingClientRect().top
    const v = Math.min(1, Math.max(0, (vh * 1.15 - top) / (vh * 0.6)))
    if (Math.abs(v - last) < 0.002) return
    last = v
    root.style.setProperty('--pre', v.toFixed(3))
  }
  const on = () => {
    if (!raf) raf = requestAnimationFrame(tick)
  }
  let live = false
  const io = new IntersectionObserver(
    ([e]) => {
      const v = !!e?.isIntersecting
      if (v === live) return
      live = v
      if (v) {
        addEventListener('scroll', on, { passive: true })
        addEventListener('resize', on)
      } else {
        removeEventListener('scroll', on)
        removeEventListener('resize', on)
      }
      on()
    },
    { rootMargin: '50% 0px' },
  )
  io.observe(root)
  tick()
  return () => {
    io.disconnect()
    removeEventListener('scroll', on)
    removeEventListener('resize', on)
    cancelAnimationFrame(raf)
  }
}
