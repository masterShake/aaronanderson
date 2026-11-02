/** Browser-only helpers shared by the story store and StageMount. */

export const WIDE_QUERY = '(min-width: 768px) and (min-aspect-ratio: 1/1)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export const hasQueryFlag = (name: string): boolean => new URLSearchParams(location.search).has(name)

export const hasWebGL2 = (): boolean => typeof WebGL2RenderingContext !== 'undefined'

/** Run `fn` when the main thread is idle (or after `timeout` ms at the latest). Returns a cancel. */
export function whenIdle(fn: () => void, timeout: number): () => void {
  if (timeout <= 0) {
    const t = setTimeout(fn, 0)
    return () => clearTimeout(t)
  }
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const t = setTimeout(fn, Math.min(timeout, 300))
  return () => clearTimeout(t)
}
