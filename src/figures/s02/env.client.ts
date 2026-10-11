'use client'
import { SERVICE_3D_QUERY } from '@/stage/host'

/**
 * What the S-02 and S-04 controllers (owner: scenes-a) decide at mount, kept tiny because
 * it ships with the page; the rest of each controller (run.client.ts) loads when the
 * figure comes within a viewport.
 */

export const NOT_PROD = process.env.SITE_ENV !== 'production'

/** The harness's preview-only ?p= (0 to 1), or null. */
export function pinnedP(): number | null {
  if (!NOT_PROD) return null
  const v = new URLSearchParams(location.search).get('p')
  const n = v === null ? NaN : Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null
}

/** D3: scrub (and WebGL) only at 1024 px and up with a fine pointer. */
export const desktop = () =>
  typeof matchMedia === 'function' && matchMedia(SERVICE_3D_QUERY).matches

/** The services sheet's text column that sets the scrub length (the scrub contract). */
export const trackOf = (root: HTMLElement | null) =>
  root?.closest('section')?.querySelector<HTMLElement>('[data-scrub-track]') ?? null

/** Scrub mode for this figure: desktop, with a track or a pinned ?p=. */
export const scrubMode = (id: string) =>
  typeof window !== 'undefined' &&
  desktop() &&
  (Boolean(trackOf(document.getElementById(id))) || pinnedP() !== null)

/** Calls `cb` once, when the element comes within one viewport. */
export function whenNear(el: Element, cb: () => void): () => void {
  const io = new IntersectionObserver(
    (es) => {
      if (!es.some((e) => e.isIntersecting)) return
      io.disconnect()
      cb()
    },
    { rootMargin: '100% 0px' },
  )
  io.observe(el)
  return () => io.disconnect()
}
