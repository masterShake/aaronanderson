import type { StageDebug } from './types'
import { host, type AnySceneId } from './host'

/**
 * window.__aeStage, outside production only (cut 9: state, holdAtHandoff,
 * show, seek, loseContext; nothing more). ?frame=plan holds the first stage
 * figure at its hand-off frame through holdAtHandoff. No three.
 */

const runtime = async () => {
  const h = host()
  return h.rt ?? (await h.load())
}

export function installDebug(): void {
  if (process.env.SITE_ENV === 'production' || typeof window === 'undefined') return
  if (window.__aeStage) return
  const api: StageDebug = {
    state: () => {
      const h = host()
      return h.rt
        ? h.rt.debug.state()
        : { loaded: false, figures: [...h.recs].map((r) => r.init.scene) }
    },
    holdAtHandoff: async (scene) => {
      const rt = await runtime()
      if (!rt) throw new Error('stage: no runtime on this visit')
      await rt.debug.holdAtHandoff(scene as AnySceneId)
    },
    show: (scene, medium) => host().rt?.debug.show(scene as AnySceneId, medium),
    seek: (scene, at) => host().rt?.debug.seek(scene as AnySceneId, at),
    loseContext: () => host().rt?.debug.loseContext(),
  }
  window.__aeStage = api
  if (new URLSearchParams(location.search).get('frame') === 'plan') {
    const first = document.querySelector<HTMLElement>('figure[data-scene]')
    const scene = first?.dataset.scene as AnySceneId | undefined
    if (scene) void api.holdAtHandoff(scene).catch(() => undefined)
  }
}
