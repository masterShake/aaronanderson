import { NeutralToneMapping, SRGBColorSpace, WebGLRenderer, type WebGLRenderTarget } from 'three'
import type { AnySceneId, FigRec, RuntimeApi, RuntimeFactory } from '../host'
import { DEV_SCENES, SCENES } from '../registry'
import {
  MARK,
  type FallbackReason,
  type FigureCommand,
  type LayoutId,
  type Quality,
  type SceneContext,
  type SceneInstance,
  type SceneModule,
  type SceneUpdate,
  type StageEvent,
} from '../types'
import type { ViewBox } from '@/drawings/types'
import { DUR, ENV, GATE, SCRUB } from '@/motion/timing/global'
import { yieldToMain } from '@/motion/visibility'
import { PEN, SCENE, SCENE_TOKENS } from '@/styles/tokens'
import { coarsePointer } from '../probe'
import { getTier } from '../tier'
import { FrameGuard } from './guard'
import { buildEnv } from './kit/env'
import { disposeShared } from './kit/materials'

/**
 * The Stage runtime (D9, §1): one WebGLRenderer on the probe's context, one
 * canvas moved into the most visible stage slot, a still drawn into the slot
 * being left in the same task, the hand-off and hand-back, the frame guard,
 * context loss and disposal. Loaded with import() by src/stage/host.ts only.
 */

type Arm = 'cold' | 'building' | 'compiled' | 'priming' | 'armed' | 'live' | 'fallback'
type StageAttr = 'svg' | 'handoff' | 'webgl' | 'handback'

interface Fig {
  readonly rec: FigRec
  readonly id: AnySceneId
  readonly root: HTMLElement
  readonly slot: HTMLElement
  readonly still: HTMLCanvasElement
  readonly ctrl: AbortController
  arm: Arm
  stage: StageAttr
  scene: SceneInstance | null
  layout: LayoutId
  ratio: number
  near: boolean
  w: number
  h: number
  pSmooth: number
  fence: WebGLSync | null
  confirmed: number
  /** Mechanism time since the hand-off, ms. */
  t: number
  loop: number
  hold: boolean
  stillOn: boolean
  beat?: string
  labels: Map<string, HTMLElement> | null
  labelPos: Map<string, string>
  timers: Set<ReturnType<typeof setTimeout>>
}

const RATIO_MIN = 0.1
const RATIO_SWITCH = 0.15
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)
const SLICE_MS = 8
/** Session-scoped resources live this long after the last figure leaves. */
const IDLE_DESTROY_MS = 30_000

const CANVAS_CSS =
  'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;' +
  `opacity:0;transition:opacity ${DUR.handoff}ms linear`
const STILL_CSS = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:1'

const loader = (id: AnySceneId): (() => Promise<{ default: SceneModule }>) =>
  id === '_demo' || id === '_probe' ? DEV_SCENES[id] : SCENES[id]

/** The figure's viewBox for a layout: FigureFrame's --vbw/--vbh (wide) and --vbw-t/--vbh-t (tall). */
function viewBoxOf(root: HTMLElement, layout: LayoutId): ViewBox {
  const v = (n: string) => parseFloat(root.style.getPropertyValue(n))
  const w = layout === 'tall' ? v('--vbw-t') || v('--vbw') : v('--vbw')
  const h = layout === 'tall' ? v('--vbh-t') || v('--vbh') : v('--vbh')
  if (w > 0 && h > 0) return [0, 0, w, h]
  const svg = root.querySelector('.drawing svg[viewBox]')
  const vb = svg
    ?.getAttribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number)
  return vb && vb.length === 4 ? [vb[0]!, vb[1]!, vb[2]!, vb[3]!] : [0, 0, 960, 600]
}

/** The figure's handoff p: data-handoff-p, else the --<scene>-handoff-p timing var. */
function handoffPOf(f: { root: HTMLElement; id: AnySceneId }): number {
  const d = parseFloat(f.root.dataset.handoffP ?? '')
  if (Number.isFinite(d)) return d
  const v = parseFloat(getComputedStyle(f.root).getPropertyValue(`--${f.id}-handoff-p`))
  return Number.isFinite(v) ? v : 0
}

class Runtime implements RuntimeApi {
  readonly renderer: string
  private readonly r: WebGLRenderer
  private readonly gl: WebGL2RenderingContext
  private readonly cv: HTMLCanvasElement
  private readonly touch = coarsePointer()
  private readonly quality: Quality = this.touch ? 'standard' : 'physical'
  private readonly figs = new Map<FigRec, Fig>()
  private readonly byRoot = new Map<Element, Fig>()
  private active: Fig | null = null
  private looping = false
  private raf = 0
  private last = 0
  private wasAnimating = false
  private dead = false
  private suspended = false
  private firstFrame = false
  private frames = 0
  private guard = new FrameGuard()
  private guardDpr = Infinity
  private dpr = 1
  private env: Promise<WebGLRenderTarget> | null = null
  private envTarget: WebGLRenderTarget | null = null
  private envMs = 0
  private idleTimer: ReturnType<typeof setTimeout> | 0 = 0
  private contextLostAt = 0
  private readonly io: IntersectionObserver
  private readonly nearIo: IntersectionObserver
  private readonly farIo: IntersectionObserver
  private readonly ro: ResizeObserver
  private readonly offs: (() => void)[] = []

  constructor(
    probe: { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext; renderer: string },
    private readonly hooks: Parameters<RuntimeFactory>[1],
  ) {
    this.renderer = probe.renderer
    this.gl = probe.gl
    this.cv = probe.canvas
    this.r = new WebGLRenderer({
      canvas: probe.canvas,
      context: probe.gl,
      antialias: true,
      alpha: true,
      powerPreference: 'default',
    })
    const r = this.r
    r.setClearColor(0x000000, 0)
    r.toneMapping = NeutralToneMapping
    r.toneMappingExposure = 1
    r.outputColorSpace = SRGBColorSpace
    r.debug.checkShaderErrors = process.env.NODE_ENV !== 'production'
    const cv = this.cv
    cv.className = 'stage-canvas'
    cv.tabIndex = -1
    cv.setAttribute('aria-hidden', 'true')
    cv.setAttribute('role', 'presentation')
    cv.style.cssText = CANVAS_CSS
    this.park()

    this.io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const f = this.byRoot.get(e.target)
          if (f) f.ratio = e.isIntersecting ? e.intersectionRatio : 0
        }
        this.invalidate()
      },
      { threshold: THRESHOLDS },
    )
    this.nearIo = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const f = this.byRoot.get(e.target)
          if (!f) continue
          f.near = e.isIntersecting
          if (f.near && f.arm === 'cold') void this.prepare(f)
        }
      },
      { rootMargin: '100% 0px' },
    )
    this.farIo = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const f = this.byRoot.get(e.target)
          if (f && !e.isIntersecting && f !== this.active) this.dropStill(f)
        }
      },
      { rootMargin: '200% 0px' },
    )
    this.ro = new ResizeObserver((es) => {
      for (const e of es) {
        const f = [...this.figs.values()].find((x) => x.slot === e.target)
        if (!f) continue
        const box = e.contentBoxSize?.[0]
        f.w = box ? box.inlineSize : e.contentRect.width
        f.h = box ? box.blockSize : e.contentRect.height
        if (f === this.active && f.scene) {
          this.fit(f)
          this.draw(f)
          this.guard.reset()
        }
      }
    })

    const lost = (e: Event) => {
      e.preventDefault()
      this.onContextLost()
    }
    const restored = () => this.destroy()
    cv.addEventListener('webglcontextlost', lost)
    cv.addEventListener('webglcontextrestored', restored)
    const state = () => this.onState()
    document.addEventListener('ae:state', state)
    const vis = () => {
      this.last = 0
      this.invalidate()
    }
    document.addEventListener('visibilitychange', vis)
    this.offs.push(
      () => cv.removeEventListener('webglcontextlost', lost),
      () => cv.removeEventListener('webglcontextrestored', restored),
      () => document.removeEventListener('ae:state', state),
      () => document.removeEventListener('visibilitychange', vis),
    )
  }

  // Figures

  add(rec: FigRec) {
    if (this.dead || this.figs.has(rec)) return
    const { root, slot, still } = rec.init
    const rect = slot.getBoundingClientRect()
    const f: Fig = {
      rec,
      id: rec.init.scene,
      root,
      slot,
      still,
      ctrl: new AbortController(),
      arm: 'cold',
      stage: 'svg',
      scene: null,
      layout: rec.layout,
      ratio: 0,
      near: false,
      w: rect.width,
      h: rect.height,
      pSmooth: rec.p,
      fence: null,
      confirmed: 0,
      t: 0,
      loop: 0,
      hold: false,
      stillOn: false,
      labels: null,
      labelPos: new Map(),
      timers: new Set(),
    }
    this.figs.set(rec, f)
    this.byRoot.set(root, f)
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = 0
    this.setStage(f, 'svg')
    this.io.observe(root)
    this.nearIo.observe(root)
    this.farIo.observe(root)
    this.ro.observe(slot)
  }

  release(rec: FigRec) {
    const f = this.figs.get(rec)
    if (!f) return this.hooks.forget(rec)
    // StrictMode re-registers within the same task; GPU disposal waits a turn.
    queueMicrotask(() =>
      setTimeout(() => {
        if (rec.released) this.disposeFig(f)
      }, 0),
    )
  }

  progress(rec: FigRec) {
    const f = this.figs.get(rec)
    if (!f || f.hold) return
    if (rec.mode === 'scrub') this.scrubCheck(f)
    this.invalidate()
  }

  mode(rec: FigRec) {
    const f = this.figs.get(rec)
    if (f) this.invalidate()
  }

  layout(rec: FigRec) {
    const f = this.figs.get(rec)
    if (!f || f.layout === rec.layout) return
    // A layout switch rebuilds the scene for the new art box (§1.8).
    f.layout = rec.layout
    if (f === this.active) this.activate(null)
    this.teardownScene(f)
    this.setStage(f, 'svg')
    this.emit(f, { type: 'handback' })
    f.arm = 'cold'
    if (f.near) void this.prepare(f)
  }

  play(rec: FigRec) {
    const f = this.figs.get(rec)
    if (!f) return
    f.t = 0
    if (f.arm === 'live') {
      f.scene?.reset(f.loop)
      f.scene?.start('decision', f.loop)
    }
    this.invalidate()
  }

  command(rec: FigRec, c: FigureCommand, arg?: string) {
    const f = this.figs.get(rec)
    if (!f?.scene) return
    try {
      f.scene.command?.(c, arg)
    } catch (e) {
      this.sceneFailed(f, e)
      return
    }
    this.invalidate()
  }

  requestHandoff(rec: FigRec, at: 'decision' | 'boundary', loop = 0): boolean {
    const f = this.figs.get(rec)
    if (!f) return false
    return this.handoff(f, at, loop)
  }

  suspend(on: boolean) {
    this.suspended = on
    if (on) this.setLoop(false)
    else {
      this.last = 0
      this.invalidate()
    }
  }

  // Loading and building

  private loadEnv(): Promise<WebGLRenderTarget> {
    this.env ??= buildEnv(this.r, ENV.size).then(({ target, ms }) => {
      this.envTarget = target
      this.envMs = ms
      return target
    })
    return this.env
  }

  private sceneContext(f: Fig): SceneContext {
    return {
      renderer: this.r,
      quality: this.quality,
      layout: f.layout,
      viewBox: viewBoxOf(f.root, f.layout),
      tokens: SCENE_TOKENS,
      strokePx: (pen) => PEN[pen] * this.kOf(f) * this.unitPx(f),
      signal: f.ctrl.signal,
    }
  }

  private kOf(f: Fig): number {
    const k = parseFloat(getComputedStyle(f.root).getPropertyValue('--k'))
    return Number.isFinite(k) && k > 0 ? k : 1
  }

  /** CSS px per viewBox unit, as preserveAspectRatio="xMidYMid meet" places it. */
  private unitPx(f: Fig): number {
    const [, , w, h] = viewBoxOf(f.root, f.layout)
    return Math.min(f.w / w, f.h / h)
  }

  private async prepare(f: Fig) {
    if (f.arm !== 'cold' || this.dead) return
    f.arm = 'building'
    const gone = () => this.dead || f.rec.released || !this.figs.has(f.rec) || f.arm !== 'building'
    try {
      const mod = (await loader(f.id)()).default
      if (gone()) return
      const scene = mod.create(this.sceneContext(f))
      f.scene = scene
      const b0 = performance.now()
      let t0 = b0
      const it = scene.build()
      while (!it.next().done) {
        if (performance.now() - t0 > SLICE_MS) {
          await yieldToMain()
          if (gone()) return
          t0 = performance.now()
        }
      }
      performance.measure(MARK.build(f.id), { start: b0, end: performance.now() })
      const env = await this.loadEnv()
      if (gone()) return
      scene.three.environment = env.texture
      scene.reset()
      this.fit(f)
      const c0 = performance.now()
      await this.r.compileAsync(scene.three, scene.rig.camera)
      performance.measure(MARK.compile(f.id), { start: c0, end: performance.now() })
      if (gone()) return
      f.arm = 'compiled'
      this.invalidate()
    } catch (e) {
      if (!this.dead && f.arm === 'building') this.sceneFailed(f, e)
    }
  }

  /** One scene failed (build or update): that figure alone goes back to SVG (W0 addendum 2). */
  private sceneFailed(f: Fig, e: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('stage: scene failed', f.id, e)
    this.figFallback(f, 'build-error')
  }

  private figFallback(f: Fig, reason: FallbackReason) {
    if (f.arm === 'fallback') return
    const atMs = f.t
    if (f === this.active) this.activate(null, false)
    this.teardownScene(f)
    f.arm = 'fallback'
    this.setStage(f, 'svg')
    this.dropStill(f)
    f.rec.fellBack = true
    this.emit(f, { type: 'fallback', reason, atMs })
  }

  private teardownScene(f: Fig) {
    for (const t of f.timers) clearTimeout(t)
    f.timers.clear()
    if (f.fence) {
      this.gl.deleteSync(f.fence)
      f.fence = null
    }
    f.confirmed = 0
    try {
      f.scene?.dispose()
    } catch {}
    f.scene = null
    f.labels = null
    f.labelPos.clear()
  }

  private disposeFig(f: Fig) {
    if (!this.figs.has(f.rec)) return
    if (f === this.active) this.activate(null, false)
    f.ctrl.abort()
    this.teardownScene(f)
    this.dropStill(f)
    this.io.unobserve(f.root)
    this.nearIo.unobserve(f.root)
    this.farIo.unobserve(f.root)
    this.ro.unobserve(f.slot)
    this.figs.delete(f.rec)
    this.byRoot.delete(f.root)
    this.hooks.forget(f.rec)
    if (!this.figs.size && !this.dead) {
      this.idleTimer = setTimeout(() => {
        if (!this.figs.size) this.destroy()
      }, IDLE_DESTROY_MS)
    }
    this.invalidate()
  }

  // Canvas placement

  private park() {
    const park = document.getElementById('stage-park')
    if (park) park.appendChild(this.cv)
    else this.cv.remove()
  }

  /** Most visible candidate, with hysteresis (§1.6). */
  private pick(): Fig | null {
    const a = this.active
    if (a && (a.stage === 'handoff' || a.stage === 'handback')) return a
    if (a?.hold) return a
    let best: Fig | null = null
    for (const f of this.figs.values()) {
      if (!f.scene || f.arm === 'cold' || f.arm === 'building' || f.arm === 'fallback') continue
      if (f.ratio < RATIO_MIN) continue
      if (!best || f.ratio > best.ratio) best = f
    }
    if (!a || !this.figs.has(a.rec) || a.ratio < RATIO_MIN || a.arm === 'fallback') return best
    if (best && best !== a && best.ratio >= a.ratio + RATIO_SWITCH) return best
    return a
  }

  /** Moves the canvas. The figure being left keeps a still of its last frame, drawn in this task. */
  private activate(next: Fig | null, freeze = true) {
    const prev = this.active
    if (prev === next) return
    const cv = this.cv
    if (prev && freeze && prev.scene && prev.stage === 'webgl' && !this.dead) {
      this.draw(prev)
      const s = prev.still
      if (s.width !== cv.width || s.height !== cv.height) {
        s.width = cv.width
        s.height = cv.height
      }
      const g = s.getContext('2d', { alpha: true })
      if (g) {
        g.clearRect(0, 0, s.width, s.height)
        g.drawImage(cv, 0, 0)
        s.style.cssText = STILL_CSS
        prev.stillOn = true
      }
    }
    this.active = next
    this.guard.reset()
    if (!next) {
      this.park()
      return
    }
    next.slot.appendChild(cv)
    cv.style.opacity = next.stage === 'webgl' || next.stage === 'handoff' ? '1' : '0'
    this.fit(next)
    if (next.scene) this.draw(next)
    if (next.stillOn) this.hideStill(next)
  }

  private hideStill(f: Fig) {
    f.still.style.cssText = ''
    f.stillOn = false
  }

  /** Releases a still (more than two viewports away). A live figure goes back to its SVG. */
  private dropStill(f: Fig) {
    if (f.still.width || f.still.height) {
      f.still.width = 0
      f.still.height = 0
    }
    if (f.stillOn) this.hideStill(f)
    if (f.arm === 'live' && f !== this.active) {
      f.arm = 'armed'
      f.scene?.reset(f.loop)
      this.setStage(f, 'svg')
      this.emit(f, { type: 'handback' })
    }
  }

  /** DPR (D9): ≤2 on desktop; touch 2 if the backing store is ≤0.75 MP, else 1.5. Then the guard's cap. */
  private dprFor(w: number, h: number): number {
    const dev = window.devicePixelRatio || 1
    let cap: number = SCENE.dprMax
    if (this.touch) {
      const at2 = w * h * SCENE.dprMaxTouch * SCENE.dprMaxTouch
      cap = at2 <= SCENE.touchLargeStorePx ? SCENE.dprMaxTouch : SCENE.dprMaxTouchLarge
    }
    return Math.min(dev, cap, this.guardDpr)
  }

  private fit(f: Fig) {
    const w = Math.max(1, f.w)
    const h = Math.max(1, f.h)
    if (f !== this.active) {
      f.scene?.resize(w, h)
      return
    }
    const dpr = this.dprFor(w, h)
    this.dpr = dpr
    const r = this.r
    r.setPixelRatio(dpr)
    r.setSize(w, h, false)
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (this.cv.width !== bw) this.cv.width = bw
    if (this.cv.height !== bh) this.cv.height = bh
    r.setViewport(0, 0, w, h)
    f.scene?.resize(w, h)
    f.labelPos.clear()
  }

  private draw(f: Fig) {
    if (!f.scene || this.dead) return
    this.r.render(f.scene.three, f.scene.rig.camera)
  }

  // Loop

  private paused(f: Fig): boolean {
    return document.documentElement.dataset.motion === 'paused' && !('userPlay' in f.root.dataset)
  }

  invalidate() {
    if (this.looping || this.raf || this.dead || this.suspended) return
    this.raf = requestAnimationFrame((t) => {
      this.raf = 0
      this.tick(t)
    })
  }

  private setLoop(on: boolean) {
    if (on && (this.dead || this.suspended)) on = false
    if (on === this.looping) return
    this.looping = on
    this.r.setAnimationLoop(on ? this.tick : null)
    if (!on) this.last = 0
  }

  private readonly tick = (now: number) => {
    if (this.dead) return
    this.frames++
    const raw = this.last ? now - this.last : 1000 / 60
    this.last = now
    const dt = Math.min(raw, 50)
    const next = this.pick()
    if (next !== this.active) this.activate(next)
    const f = this.active
    let animating = false
    let priming = false
    if (f?.scene && !document.hidden) {
      if (f.arm === 'compiled' || f.arm === 'priming') {
        this.prime(f)
        priming = f.arm === 'priming'
      } else if (f.arm === 'armed' || f.arm === 'live') {
        animating = this.step(f, dt, raw)
      }
    }
    this.wasAnimating = animating
    this.setLoop(animating || priming)
  }

  /** One frame of an armed or live figure. Returns whether it keeps animating. */
  private step(f: Fig, dt: number, raw: number): boolean {
    const scene = f.scene!
    const scrub = f.rec.mode === 'scrub'
    const target = f.rec.p
    const before = f.pSmooth
    f.pSmooth += (target - f.pSmooth) * (1 - Math.exp(-dt / 90))
    if (Math.abs(target - f.pSmooth) < 5e-4) f.pSmooth = target
    const smoothing = scrub && f.pSmooth !== before
    if (scrub) this.scrubCheck(f)
    const live = f.arm === 'live' && f.stage === 'webgl' && !f.hold
    const run = live && !this.paused(f) && f.ratio >= RATIO_MIN
    let u: SceneUpdate | null = null
    if (live) {
      if (run) f.t += dt
      try {
        u = scene.update(run ? dt : 0, f.pSmooth)
      } catch (e) {
        this.sceneFailed(f, e)
        return false
      }
      if (u.beat && u.beat !== f.beat) {
        f.beat = u.beat
        this.emit(f, { type: 'beat', beat: u.beat, loop: f.loop })
      }
      if (u.labels) this.writeLabels(f, u.labels)
    }
    this.draw(f)
    const animating = (run && !!u?.animating) || (live && smoothing)
    if (animating && this.wasAnimating) this.onGuard(this.guard.sample(raw), f)
    return animating
  }

  // Hand-off (§1.10)

  private prime(f: Fig) {
    if (f.arm === 'compiled') {
      f.arm = 'priming'
      f.confirmed = 0
    }
    this.draw(f)
    if (!this.firstFrame) {
      this.firstFrame = true
      performance.mark(MARK.firstFrame)
    }
    const gl = this.gl
    if (f.fence && gl.getSyncParameter(f.fence, gl.SYNC_STATUS) === gl.SIGNALED) {
      gl.deleteSync(f.fence)
      f.fence = null
      f.confirmed++
    }
    if (!f.fence && f.confirmed < 2) {
      f.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
    }
    if (f.confirmed >= 2) {
      f.arm = 'armed'
      performance.mark(MARK.ready(f.id))
      this.emit(f, { type: 'ready' })
      if (f.rec.mode === 'scrub') this.scrubCheck(f)
    }
  }

  private handoff(f: Fig, at: 'decision' | 'boundary' | 'scrub', loop: number): boolean {
    if (f.arm !== 'armed' || this.active !== f || this.dead || f.hold || !f.scene) return false
    if (at !== 'scrub' && this.paused(f)) return false
    if (at === 'boundary' && f.ratio < GATE.handoffVisible) return false
    f.arm = 'live'
    f.loop = loop
    f.t = 0
    f.beat = undefined
    try {
      f.scene.reset(loop)
    } catch (e) {
      this.sceneFailed(f, e)
      return false
    }
    this.draw(f)
    this.setStage(f, 'handoff')
    performance.mark(MARK.handoff(f.id))
    this.later(f, DUR.handoff, () => {
      if (f.arm !== 'live' || !f.scene) return
      this.setStage(f, 'webgl')
      try {
        f.scene.start(at, loop)
      } catch (e) {
        this.sceneFailed(f, e)
        return
      }
      this.emit(f, { type: 'handoff' })
      this.guard.reset()
      this.invalidate()
    })
    return true
  }

  private handback(f: Fig) {
    if (f.arm !== 'live' || f.stage !== 'webgl') return
    this.setStage(f, 'handback')
    this.later(f, DUR.handoff, () => {
      if (f.stage !== 'handback') return
      f.arm = 'armed'
      f.scene?.reset(f.loop)
      this.setStage(f, 'svg')
      this.emit(f, { type: 'handback' })
      this.invalidate()
    })
  }

  /** Scrub windows (§B8): in at [pH, pH+0.04]; back when raw p < pH−0.01 and smoothed p ≤ pH+0.005. */
  private scrubCheck(f: Fig) {
    if (f.hold || f.rec.mode !== 'scrub') return
    const pH = handoffPOf(f)
    const p = f.rec.p
    if (f.arm === 'armed' && f.stage === 'svg' && p >= pH && p <= pH + SCRUB.handoffWindow) {
      f.pSmooth = p
      this.handoff(f, 'scrub', 0)
    } else if (
      f.arm === 'live' &&
      f.stage === 'webgl' &&
      p < pH - SCRUB.handbackBelow &&
      f.pSmooth <= pH + SCRUB.handbackSmoothed
    ) {
      this.handback(f)
    }
  }

  private setStage(f: Fig, s: StageAttr) {
    f.stage = s
    f.root.dataset.stage = s
    if (s === 'svg' || s === 'handoff') f.root.dataset.labels = 'plan'
    if (f === this.active) this.cv.style.opacity = s === 'handoff' || s === 'webgl' ? '1' : '0'
  }

  private later(f: Fig, ms: number, fn: () => void) {
    const id = setTimeout(() => {
      f.timers.delete(id)
      fn()
    }, ms)
    f.timers.add(id)
  }

  private emit(f: Fig, e: StageEvent) {
    try {
      f.rec.init.onEvent?.(e)
    } catch {}
  }

  /** Writes --ix/--iy (percent of the art box) on [data-anchor] labels; skips changes under 0.25 px. */
  private writeLabels(f: Fig, labels: NonNullable<SceneUpdate['labels']>) {
    if (!f.labels) {
      f.labels = new Map()
      for (const el of f.root.querySelectorAll<HTMLElement>('.labels [data-anchor]'))
        f.labels.set(el.dataset.anchor!, el)
    }
    let any = false
    for (const [key, l] of labels) {
      const el = f.labels.get(key)
      if (!el) continue
      any ||= l.visible
      const k = `${Math.round(l.x * 4)}|${Math.round(l.y * 4)}|${l.visible ? 1 : 0}`
      if (f.labelPos.get(key) === k) continue
      f.labelPos.set(key, k)
      el.style.setProperty('--ix', `${((l.x / Math.max(1, f.w)) * 100).toFixed(3)}%`)
      el.style.setProperty('--iy', `${((l.y / Math.max(1, f.h)) * 100).toFixed(3)}%`)
      if (l.visible) delete el.dataset.hidden
      else el.dataset.hidden = ''
    }
    const mode = any ? 'iso' : 'plan'
    if (f.root.dataset.labels !== mode) f.root.dataset.labels = mode
  }

  // Guard, state, loss

  private onGuard(v: ReturnType<FrameGuard['sample']>, f: Fig) {
    if (v === 'dpr1') {
      this.guardDpr = 1
      this.fit(f)
      this.draw(f)
    } else if (v === 'fallback') {
      this.die('frame-guard')
    }
  }

  /** Page state changed: still tier (reduced motion) takes every figure to its still. */
  private onState() {
    if (this.dead) return
    if (getTier() === 'still') {
      for (const f of [...this.figs.values()]) this.figFallback(f, 'ineligible')
      return
    }
    this.last = 0
    this.invalidate()
  }

  private onContextLost() {
    if (this.dead) return
    this.contextLostAt = performance.now()
    this.die('context-lost')
  }

  /** Context loss or the frame guard: every figure back to SVG, a session downgrade, then destroy. */
  private die(reason: FallbackReason) {
    for (const f of [...this.figs.values()]) {
      if (f.arm === 'fallback') continue
      const atMs = f.t
      for (const t of f.timers) clearTimeout(t)
      f.timers.clear()
      f.arm = 'fallback'
      this.setStage(f, 'svg')
      if (f.stillOn) this.hideStill(f)
      f.rec.fellBack = true
      this.emit(f, { type: 'fallback', reason, atMs })
    }
    this.cv.style.opacity = '0'
    this.hooks.dead(reason)
    this.dead = true
    this.setLoop(false)
    // Never re-enter WebGL after a loss: everything goes, the context included.
    this.destroy()
  }

  destroy() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = 0
    for (const f of [...this.figs.values()]) {
      this.teardownScene(f)
      this.dropStill(f)
      f.ctrl.abort()
    }
    this.figs.clear()
    this.byRoot.clear()
    this.io.disconnect()
    this.nearIo.disconnect()
    this.farIo.disconnect()
    this.ro.disconnect()
    for (const off of this.offs) off()
    this.offs.length = 0
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    const wasDead = this.dead
    this.dead = true
    this.setLoop(false)
    this.envTarget?.dispose()
    this.envTarget = null
    disposeShared()
    this.r.dispose()
    if (!this.gl.isContextLost()) this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.cv.remove()
    if (!wasDead) this.hooks.reset()
  }

  private find(scene: AnySceneId): Fig | undefined {
    for (const f of this.figs.values()) if (f.id === scene) return f
    return undefined
  }

  readonly debug: RuntimeApi['debug'] = {
    state: () => {
      const info = this.r.info
      return {
        loaded: true,
        renderer: this.renderer,
        tier: getTier(),
        dead: this.dead,
        contexts: this.dead ? 0 : 1,
        canvases: document.querySelectorAll('canvas.stage-canvas').length,
        active: this.active?.id ?? null,
        frames: this.frames,
        looping: this.looping,
        dpr: this.dpr,
        quality: this.quality,
        envMs: this.envMs,
        contextLostAt: this.contextLostAt,
        guard: { medians: this.guard.medians, tripped: this.guard.tripped, dpr: this.guardDpr },
        memory: { geometries: info.memory.geometries, textures: info.memory.textures },
        programs: info.programs?.length ?? 0,
        figs: [...this.figs.values()].map((f) => ({
          scene: f.id,
          arm: f.arm,
          stage: f.stage,
          p: f.rec.p,
          t: Math.round(f.t),
          ratio: f.ratio,
          hold: f.hold,
          w: f.w,
          h: f.h,
        })),
      }
    },
    holdAtHandoff: (scene) =>
      new Promise<void>((resolve, reject) => {
        const t0 = performance.now()
        const poll = () => {
          const f = this.find(scene)
          if (this.dead) return reject(new Error('stage: dead'))
          if (f?.arm === 'fallback') return reject(new Error(`stage: ${scene} fell back`))
          if (f) f.hold = true
          if (f?.scene && (f.arm === 'armed' || f.arm === 'live')) {
            for (const t of f.timers) clearTimeout(t)
            f.timers.clear()
            if (f.arm === 'live') f.arm = 'armed'
            f.scene.reset(0)
            this.setStage(f, 'svg')
            if (this.active !== f) this.activate(f)
            this.fit(f)
            this.draw(f)
            this.setLoop(false)
            return resolve()
          }
          if (performance.now() - t0 > 20_000) return reject(new Error('stage: hold timed out'))
          if (f && (f.arm === 'compiled' || f.arm === 'priming')) this.invalidate()
          setTimeout(poll, 30)
        }
        poll()
      }),
    show: (scene, medium) => {
      const f = this.find(scene)
      if (!f) return
      f.hold = true
      if (this.active !== f) this.activate(f)
      const webgl = medium === 'webgl'
      this.cv.style.transition = 'none'
      this.cv.style.opacity = webgl ? '1' : '0'
      for (const svg of f.root.querySelectorAll<SVGElement>('.drawing svg')) {
        const keep = svg.classList.contains('l-panel') || svg.classList.contains('l-ghost')
        svg.style.visibility = webgl && !keep ? 'hidden' : ''
      }
      const labels = f.root.querySelector<HTMLElement>('.labels')
      if (labels) labels.style.visibility = 'hidden'
      this.fit(f)
      this.draw(f)
    },
    seek: (scene, at) => {
      const f = this.find(scene)
      if (!f?.scene) return
      f.hold = true
      for (const t of f.timers) clearTimeout(t)
      f.timers.clear()
      if (this.active !== f) this.activate(f)
      const p = 'p' in at ? at.p : f.rec.p
      f.rec.p = p
      f.pSmooth = p
      f.scene.reset(f.loop)
      if ('ms' in at) {
        f.scene.start('decision', f.loop)
        for (let ms = 0; ms < at.ms; ms += 1000 / 60)
          f.scene.update(Math.min(1000 / 60, at.ms - ms), p)
        f.t = at.ms
      } else f.scene.update(0, p)
      f.arm = 'live'
      this.setStage(f, 'webgl')
      this.setLoop(false)
      this.draw(f)
    },
    loseContext: () => {
      this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

export const createRuntime: RuntimeFactory = (probe, hooks) => new Runtime(probe, hooks)
