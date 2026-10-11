import { idleStart } from '@/lib/idle'
import { GATE, LOAD } from './timing/global'

/**
 * Small visibility helpers the figure controllers share. Each returns a
 * function that undoes it, so effects can clean up (StrictMode-safe).
 */

/** Toggles data-offscreen while the element is under `threshold` visible or the tab is hidden. */
export function watchOffscreen(el: HTMLElement, threshold: number = GATE.offscreen): () => void {
  let ratio = 1
  const set = () => {
    const off = document.hidden || ratio < threshold
    if (off) el.dataset.offscreen = ''
    else delete el.dataset.offscreen
  }
  const io = new IntersectionObserver(
    ([e]) => {
      ratio = e ? e.intersectionRatio : 0
      set()
    },
    { threshold: [0, threshold, 1] },
  )
  io.observe(el)
  document.addEventListener('visibilitychange', set)
  return () => {
    io.disconnect()
    document.removeEventListener('visibilitychange', set)
  }
}

/** Calls `cb` once, the first time the element is at least `ratio` visible. */
export function gate(el: HTMLElement, ratio: number, cb: () => void): () => void {
  let done = false
  const io = new IntersectionObserver(
    (entries) => {
      if (done) return
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= ratio)) {
        done = true
        io.disconnect()
        cb()
      }
    },
    { threshold: [ratio] },
  )
  io.observe(el)
  return () => {
    done = true
    io.disconnect()
  }
}

/** Calls `cb` after the window's load event (at once if it already fired). */
export function afterLoad(cb: () => void): () => void {
  if (document.readyState === 'complete') {
    const id = setTimeout(cb, 0)
    return () => clearTimeout(id)
  }
  const on = () => cb()
  addEventListener('load', on, { once: true })
  return () => removeEventListener('load', on)
}

/** Calls `cb` in the next idle moment (frame-aware on Safari), or after `timeout` at the latest. */
export function whenIdle(cb: () => void, timeout: number = LOAD.idleTimeout): () => void {
  return idleStart(() => cb(), timeout)
}

/** Gives the main thread back: scheduler.yield, else a posted message, else a timer. */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (s?.yield) return s.yield()
  if (typeof MessageChannel === 'function') {
    return new Promise((resolve) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => resolve()
      ch.port2.postMessage(0)
    })
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}
