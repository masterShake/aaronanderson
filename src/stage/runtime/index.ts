import type { RuntimeFactory } from '../host'

/** M1 placeholder: the runtime chunk arrives in M2. Every figure stays SVG. */
export const createRuntime: RuntimeFactory = (probe) => {
  probe.gl.getExtension('WEBGL_lose_context')?.loseContext()
  return {
    renderer: probe.renderer,
    add: (rec) => {
      rec.fellBack = true
      queueMicrotask(() => rec.init.onEvent?.({ type: 'fallback', reason: 'load-error' }))
    },
    release() {},
    progress() {},
    mode() {},
    layout() {},
    play() {},
    command() {},
    requestHandoff: () => false,
    suspend() {},
    destroy() {},
    debug: {
      state: () => ({ loaded: true, renderer: probe.renderer }),
      holdAtHandoff: () => Promise.reject(new Error('stage: no runtime yet')),
      show() {},
      seek() {},
      loseContext() {},
    },
  }
}
