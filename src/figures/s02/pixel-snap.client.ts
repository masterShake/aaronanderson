'use client'

/**
 * Nudges a figure (by less than one device pixel, through margin-inline-start) so its left
 * edge lands on a whole device pixel. The Stage's canvas is pixel-snapped and the SVG
 * layers are not, so a fractional left edge shows as a sub-pixel seam on vertical lines
 * and curves at the hand-off. Shared by the S-02 and S-04 controllers (owner: scenes-a).
 * The figure's width is rounded down with slack in CSS, so the nudge never overflows.
 */
export function snapToPixels(el: HTMLElement): () => void {
  let raf = 0
  const fix = () => {
    raf = 0
    el.style.marginInlineStart = ''
    const dpr = devicePixelRatio || 1
    const x = (el.getBoundingClientRect().left + scrollX) * dpr
    const frac = x - Math.floor(x)
    if (frac > 0.002 && frac < 0.998) el.style.marginInlineStart = `${(1 - frac) / dpr}px`
  }
  const later = () => {
    if (!raf) raf = requestAnimationFrame(fix)
  }
  fix()
  const ro = new ResizeObserver(later)
  ro.observe(el.parentElement ?? el)
  addEventListener('resize', later)
  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    removeEventListener('resize', later)
    el.style.marginInlineStart = ''
  }
}
