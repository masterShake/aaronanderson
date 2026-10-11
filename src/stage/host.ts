import type { FigureHandle, FigureInit, Stage, Tier } from './types'

/**
 * The only main-bundle entry to the 3D Stage. SSR-safe: it touches `window`
 * only inside functions. W0 stub (owner: stage lane): every figure stays SVG.
 * The stage lane keeps these exports and loads ./runtime with import().
 */

const noop: FigureHandle = {
  setProgress() {},
  setMode() {},
  setLayout() {},
  play() {},
  requestHandoff: () => false,
  command() {},
  release() {},
}

export const stage: Stage = {
  tier: (): Tier =>
    typeof window === 'undefined'
      ? 'svg'
      : ((document.documentElement.dataset.tier as Tier | undefined) ?? 'svg'),
  register(init: FigureInit): FigureHandle {
    if (typeof window === 'undefined') return noop
    // Day 0: no runtime yet, so tell the figure to stay on its SVG path.
    queueMicrotask(() => init.onEvent?.({ type: 'fallback', reason: 'ineligible' }))
    return noop
  },
}
