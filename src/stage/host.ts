import type {
  DevSceneId,
  FallbackReason,
  FigureCommand,
  FigureHandle,
  FigureInit,
  LayoutId,
  Mode,
  SceneId,
  Stage,
  StageEvent,
  Tier,
} from './types'
import type { LoadPolicy } from '@/figures/types'
import { HERO_TOUCH_3D, SHIP } from './gates'
import { downgrade, getTier, setTier } from './tier'
import { coarsePointer, ineligible, probe, type Probe } from './probe'
import { LOAD } from '@/motion/timing/global'
import { afterLoad, whenIdle } from '@/motion/visibility'
import { MARK } from './types'

/**
 * The only main-bundle entry to the 3D Stage. SSR-safe: `window` is touched
 * only inside functions. It keeps every figure's record, decides when the
 * runtime may load (each figure's LoadPolicy, D9), probes once, then hands the
 * records to the runtime chunk (./runtime, loaded with import()). No three.
 */

export type AnySceneId = SceneId | DevSceneId
/** FigureInit, widened to the preview-only scenes (/kit/stage). */
export interface StageInit extends Omit<FigureInit, 'scene'> {
  scene: AnySceneId
}

/** One registered figure, shared by the host and the runtime. */
export interface FigRec {
  readonly init: StageInit
  /** Raw scrub progress, 0 to 1. */
  p: number
  mode: Mode
  layout: LayoutId
  released: boolean
  /** Set once the figure got a fallback event; it never gets 3D again this page view. */
  fellBack: boolean
  readonly handle: FigureHandle
}

/** What the runtime chunk exposes to the host (src/stage/runtime/index.ts). */
export interface RuntimeApi {
  readonly renderer: string
  add(rec: FigRec): void
  release(rec: FigRec): void
  progress(rec: FigRec): void
  mode(rec: FigRec): void
  layout(rec: FigRec): void
  play(rec: FigRec): void
  command(rec: FigRec, c: FigureCommand, arg?: string): void
  requestHandoff(rec: FigRec, at: 'decision' | 'boundary', loop?: number): boolean
  /** Stop the loop for a hidden page (bfcache), or wake it. */
  suspend(on: boolean): void
  destroy(): void
  debug: {
    state(): unknown
    holdAtHandoff(scene: AnySceneId): Promise<void>
    show(scene: AnySceneId, medium: 'svg' | 'webgl'): void
    seek(scene: AnySceneId, at: { ms: number } | { p: number }): void
    loseContext(): void
  }
}

type Hooks = {
  /** The runtime gave up (context loss, frame guard): fall back everything. */
  dead(reason: FallbackReason): void
  /** The runtime destroyed itself after 30 s with no figure: probe again on the next register. */
  reset(): void
  /** A released figure was disposed: drop its record. */
  forget(rec: FigRec): void
}
export type RuntimeFactory = (probe: Probe, hooks: Hooks) => RuntimeApi

const noop: FigureHandle = {
  setProgress() {},
  setMode() {},
  setLayout() {},
  play() {},
  requestHandoff: () => false,
  command() {},
  release() {},
}

const isDev = (s: AnySceneId): s is DevSceneId => s === '_demo' || s === '_probe'
const NOT_PROD = process.env.SITE_ENV !== 'production'

/** Scenes ?ship=<id>,<id> or ?ship=all promotes to webgl outside production (W0 addendum 1). */
function shipOverride(): ReadonlySet<string> {
  if (!NOT_PROD || typeof location === 'undefined') return new Set()
  const v = new URLSearchParams(location.search).get('ship')
  return new Set(v ? v.split(',').map((s) => s.trim()) : [])
}

/** Whether a scene ships as WebGL: SHIP, or a preview override; preview scenes only outside production. */
export function shipped(scene: AnySceneId): boolean {
  if (isDev(scene)) return NOT_PROD
  if (SHIP[scene] === 'webgl') return true
  const o = shipOverride()
  return o.has('all') || o.has(scene)
}

/** Resolves once `el` is at least `ratio` visible (with an optional margin). */
function seen(el: Element, ratio: number, rootMargin = '0px'): Promise<void> {
  return new Promise((resolve) => {
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting && e.intersectionRatio >= ratio)) {
          io.disconnect()
          resolve()
        }
      },
      { threshold: [ratio], rootMargin },
    )
    io.observe(el)
  })
}

const loaded = () => new Promise<void>((r) => afterLoad(r))
const idle = () => new Promise<void>((r) => whenIdle(r, LOAD.idleTimeout))

/** The LoadPolicy gate for one figure (D9, critic 21). */
async function policyGate(root: Element, policy: LoadPolicy): Promise<void> {
  await loaded()
  // Touch: no probe and no prefetch until the figure is 30% visible.
  if (coarsePointer()) return seen(root, LOAD.mobileVisible)
  if (policy === 'hero') return idle()
  if (policy === 'near') return seen(root, 0, `${LOAD.nearViewports * 100}% 0px`)
  return seen(root, LOAD.mobileVisible)
}

class Host {
  readonly recs = new Set<FigRec>()
  rt: RuntimeApi | null = null
  private loading: Promise<RuntimeApi | null> | null = null
  private failed: FallbackReason | null = null
  private gated = new WeakSet<Element>()

  tier(): Tier {
    return typeof document === 'undefined' ? 'svg' : getTier()
  }

  /** Why a scene gets no 3D right now, or null. */
  private blocked(scene: AnySceneId): FallbackReason | null {
    if (this.failed) return this.failed
    if (!shipped(scene)) return 'ineligible'
    if (scene === 'hero' && HERO_TOUCH_3D === 'deferred' && coarsePointer()) return 'ineligible'
    if (ineligible()) return 'ineligible'
    return null
  }

  register(init: StageInit): FigureHandle {
    if (typeof window === 'undefined') return noop
    for (const r of this.recs) {
      // StrictMode mount, unmount, mount: the same root gets the same handle back.
      if (r.init.root === init.root && r.init.scene === init.scene && r.released) {
        r.released = false
        return r.handle
      }
    }
    const rec = this.makeRec(init)
    this.recs.add(rec)
    const why = this.blocked(init.scene)
    if (why) {
      this.fallback(rec, why)
      return rec.handle
    }
    if (this.rt) this.rt.add(rec)
    else this.schedule(init.root, policyOf(init))
    return rec.handle
  }

  private makeRec(init: StageInit): FigRec {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the handle's methods need the host
    const host = this
    const rec: FigRec = {
      init,
      p: 0,
      mode: init.mode,
      layout: init.layout,
      released: false,
      fellBack: false,
      handle: {
        setProgress(p) {
          rec.p = p
          host.rt?.progress(rec)
        },
        setMode(m) {
          rec.mode = m
          host.rt?.mode(rec)
        },
        setLayout(l) {
          rec.layout = l
          host.rt?.layout(rec)
        },
        play() {
          host.rt?.play(rec)
        },
        requestHandoff(at, loop) {
          if (rec.fellBack || rec.released || !host.rt) return false
          return host.rt.requestHandoff(rec, at, loop)
        },
        command(c, arg) {
          host.rt?.command(rec, c, arg)
        },
        release() {
          if (rec.released) return
          rec.released = true
          if (host.rt) return host.rt.release(rec)
          // No runtime: forget the record after a frame unless StrictMode re-registered it.
          queueMicrotask(() =>
            requestAnimationFrame(() => {
              if (rec.released) host.recs.delete(rec)
            }),
          )
        },
      },
    }
    return rec
  }

  fallback(rec: FigRec, reason: FallbackReason, atMs?: number) {
    if (rec.fellBack) return
    rec.fellBack = true
    const e: StageEvent = { type: 'fallback', reason, ...(atMs === undefined ? {} : { atMs }) }
    queueMicrotask(() => rec.init.onEvent?.(e))
  }

  /** Starts loading once `root` passes its policy gate (once per element). */
  schedule(root: Element, policy: LoadPolicy) {
    if (this.gated.has(root) || this.failed) return
    this.gated.add(root)
    void policyGate(root, policy).then(() => this.load())
  }

  /** Probe, then fetch the runtime chunk. Once per session unless the runtime reset itself. */
  load(): Promise<RuntimeApi | null> {
    this.loading ??= this.doLoad()
    return this.loading
  }

  private async doLoad(): Promise<RuntimeApi | null> {
    if (ineligible()) return this.fail('ineligible', false)
    performance.mark(MARK.init)
    const p = probe()
    if (!p) return this.fail('ineligible', true)
    let factory: RuntimeFactory
    try {
      factory = (await import('./runtime')).createRuntime
    } catch {
      p.gl.getExtension('WEBGL_lose_context')?.loseContext()
      return this.fail('load-error', false)
    }
    if (ineligible()) {
      p.gl.getExtension('WEBGL_lose_context')?.loseContext()
      return this.fail('ineligible', false)
    }
    const rt = factory(p, {
      dead: (reason) => {
        this.failed = reason
        downgrade(reason)
      },
      forget: (rec) => {
        this.recs.delete(rec)
      },
      reset: () => {
        this.rt = null
        this.loading = null
        this.gated = new WeakSet()
      },
    })
    this.rt = rt
    document.documentElement.dataset.stageRuntime = 'loaded'
    if (getTier() === 'svg') setTier('webgl')
    for (const rec of this.recs) {
      if (rec.released || rec.fellBack) continue
      const why = this.blocked(rec.init.scene)
      if (why) this.fallback(rec, why)
      else rt.add(rec)
    }
    return rt
  }

  /**
   * No runtime this time. A probe failure or a missing chunk is final for the
   * page view (a probe failure for the session); a tier that is not webgl right
   * now (paused, reduced motion) only falls back the figures already here.
   */
  private fail(reason: FallbackReason, sessionWide: boolean): null {
    if (sessionWide || reason === 'load-error') this.failed = reason
    else {
      this.loading = null
      this.gated = new WeakSet()
    }
    if (sessionWide) downgrade(reason)
    for (const rec of this.recs) this.fallback(rec, reason)
    return null
  }

  /** Figures in the DOM that will want 3D: probe and prefetch on their policy (StageHost). */
  scan() {
    if (typeof document === 'undefined' || this.failed || this.rt) return
    if (ineligible()) return
    const figs = document.querySelectorAll<HTMLElement>('figure[data-scene][data-load]')
    for (const f of figs) {
      const scene = f.dataset.scene as AnySceneId
      if (!f.querySelector('[data-stage-slot]') || this.blocked(scene)) continue
      this.schedule(f, f.dataset.load as LoadPolicy)
    }
  }
}

function policyOf(init: StageInit): LoadPolicy {
  const p = init.root.dataset.load
  if (p === 'hero' || p === 'near' || p === 'visible') return p
  return init.scene === 'hero' ? 'hero' : 'near'
}

const g = globalThis as { __aeHost?: Host }
/** One host per page, surviving HMR. */
export const host = (): Host => (g.__aeHost ??= new Host())

export const stage: Stage = {
  tier: (): Tier => (typeof window === 'undefined' ? 'svg' : host().tier()),
  register: (init: FigureInit): FigureHandle =>
    typeof window === 'undefined' ? noop : host().register(init),
}

/** stage.register, open to the preview-only scenes. */
export const registerScene = (init: StageInit): FigureHandle =>
  typeof window === 'undefined' ? noop : host().register(init)
