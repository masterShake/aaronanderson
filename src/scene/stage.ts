/**
 * createStage: the one WebGL stage shared by every chapter. Loaded lazily by StageMount, so three
 * never enters the initial bundle. Renders on demand only: scroll, resize, DPR and visibility
 * changes request a frame, damping keeps requesting until settled, then the loop goes idle.
 */
import 'client-only'
import { NoToneMapping, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { draftTimeline } from '@/lib/draft/timeline'
import { frameHouse } from '@/lib/framing/frame'
import { HOUSE_NO_1 } from '@/lib/house/house-no-1'
import { resolveHouse } from '@/lib/house/resolve'
import { validateHouse } from '@/lib/house/validate'
import { planDrawing } from '@/lib/plan/drawing'
import { chapterProgress, damp } from '@/lib/story/math'
import type { StoryStore } from '@/client/story'
import { REDUCED_MOTION_QUERY, WIDE_QUERY, hasQueryFlag } from '@/client/env'
import { applyPose, FOV, poseAt, type Layout, type Pose } from '@/scene/camera'
import { createChapters } from '@/scene/chapters'
import type { ChapterStage, StageContext } from '@/scene/chapters/types'
import { createHouseRoot } from '@/scene/coords'
import { createElementFade } from '@/scene/fade'
import { createOverlay } from '@/scene/overlay'

export interface StageOptions {
  story: StoryStore
  /** Called if WebGL can't be used; StageMount then shows the static poster. */
  onFail(): void
}

export interface StageHandle {
  dispose(): void
}

type State = 'loading' | 'moving' | 'settled' | 'lost'

/** Backing-store budget: about 1440 × 900 at 2×. Larger screens render at a lower ratio. */
const MAX_BACKING_PIXELS = 5.2e6
/** Scroll jumps larger than this (anchors, End key) snap instead of animating. */
const SNAP_JUMP = 0.35
const REVEAL_TIMEOUT = 4000

export function createStage(host: HTMLElement, opts: StageOptions): StageHandle {
  const canvasHost = host.querySelector<HTMLElement>('[data-canvas-host]')
  const overlayHost = host.querySelector<HTMLElement>('[data-overlay]')
  if (!canvasHost || !overlayHost) {
    opts.onFail()
    return { dispose() {} }
  }

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false, stencil: false, powerPreference: 'default' })
  } catch (err) {
    console.warn('WebGL2 unavailable; showing the static drawing.', err)
    opts.onFail()
    return { dispose() {} }
  }
  renderer.setClearColor(0xffffff, 1)
  renderer.toneMapping = NoToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  // The framed house casts onto the ground. Set before any program compiles: it is part of every
  // program key. The map re-renders only when the lumber's pose changes (LumberLayer.commit).
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  canvasHost.appendChild(canvas)

  if (process.env.NODE_ENV !== 'production') {
    const issues = validateHouse(HOUSE_NO_1)
    if (issues.length) console.error('House No. 1 has issues:', issues)
  }

  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 1, 1e5)
  const root = createHouseRoot()
  scene.add(root)
  const house = resolveHouse(HOUSE_NO_1)
  const plan = planDrawing(house)
  const timeline = draftTimeline(plan)
  const frameModel = frameHouse(house)
  const fade = createElementFade(plan.elements.length)
  const overlay = createOverlay(overlayHost)
  const reducedMQ = matchMedia(REDUCED_MOTION_QUERY)
  const wideMQ = matchMedia(WIDE_QUERY)

  let raf = 0
  let last = 0
  let state: State | '' = ''
  let lost = false
  let onScreen = true
  let revealed = false
  let layoutDirty = true
  let snap = true
  let frames = 0
  let disposed = false

  const invalidate = () => {
    if (!raf && !disposed && !lost && onScreen && !document.hidden) raf = requestAnimationFrame(frame)
  }

  const ctx: StageContext = {
    scene,
    root,
    renderer,
    camera,
    house,
    plan,
    timeline,
    frame: frameModel,
    fade,
    overlay,
    flags: { debug: hasQueryFlag('debug'), reducedMotion: reducedMQ.matches },
    invalidate,
  }
  const chapters: ChapterStage[] = createChapters(ctx)

  // Camera keys from every chapter, in story time.
  const keys = chapters
    .flatMap((c, i) => c.camera.map((k) => ({ ...k, s: i + k.p, owner: c })))
    .sort((a, b) => a.s - b.s)
  let layout: Layout = { W: 1, H: 1, dpr: 1, frame: { x: 0, y: 0, w: 1, h: 1 }, wide: true }
  let poses = new Map<string, Pose>()
  let canvasOffset: [number, number] = [0, 0]

  function measureLayout(): Layout {
    const c = canvasHost!.getBoundingClientRect()
    const W = Math.max(1, Math.round(c.width))
    const H = Math.max(1, Math.round(c.height))
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_BACKING_PIXELS / (W * H))))
    return { W, H, dpr, frame: { x: 0, y: 0, w: W, h: H }, wide: wideMQ.matches }
  }

  function applyLayout() {
    layout = measureLayout()
    renderer.setPixelRatio(layout.dpr)
    renderer.setSize(layout.W, layout.H, false)
    const o = overlayHost!.getBoundingClientRect()
    const c = canvasHost!.getBoundingClientRect()
    canvasOffset = [c.left - o.left, c.top - o.top]
    poses = new Map()
    for (const ch of chapters) for (const [name, shot] of Object.entries(ch.shots)) poses.set(name, shot(layout))
    for (const ch of chapters) ch.resize(layout)
  }

  const setState = (next: State) => {
    if (next === state) return
    state = next
    host.dataset.stageState = next
  }

  let cur = opts.story.s

  function frame(now: number) {
    raf = 0
    if (disposed || lost) return
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
    last = now
    if (layoutDirty) {
      applyLayout()
      layoutDirty = false
      snap = true
    }

    const target = opts.story.s
    const reduced = ctx.flags.reducedMotion
    if (snap || reduced || opts.story.seeking || Math.abs(target - cur) > SNAP_JUMP) {
      cur = target
      snap = false
    } else {
      cur = damp(cur, target, dt)
      if (Math.abs(target - cur) < 1e-4) cur = target
    }

    const ps = chapters.map((c, i) => {
      const p = chapterProgress(cur, i)
      return reduced && c.quantize ? c.quantize(p) : p
    })
    const i = Math.min(chapters.length - 1, Math.floor(cur))
    applyPose(camera, poseAt(keys, poses, Math.min(chapters.length, i + ps[i])), layout)
    chapters.forEach((c, k) => c.update(ps[k], layout))
    renderer.render(scene, camera)
    overlay.layout(camera, layout, canvasOffset)
    frames++

    const moving = cur !== target
    setState(!revealed ? 'loading' : moving ? 'moving' : 'settled')
    if (moving) invalidate()
  }

  // Reveal once shaders are compiled and labels are laid out (or after a timeout).
  const timeout = new Promise<void>((r) => setTimeout(r, REVEAL_TIMEOUT))
  void Promise.all([
    renderer.compileAsync(scene, camera).catch(() => undefined),
    Promise.race([Promise.all(chapters.map((c) => c.ready)), timeout]),
  ]).then(() => {
    if (disposed) return
    revealed = true
    invalidate()
  })

  // Wiring.
  const unsubscribe = opts.story.subscribe(invalidate)
  const ro = new ResizeObserver(() => {
    layoutDirty = true
    invalidate()
  })
  ro.observe(canvasHost)
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting
    if (onScreen) invalidate()
  })
  io.observe(host)
  const onVisibility = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    } else {
      last = 0
      invalidate()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  const onLayoutChange = () => {
    layoutDirty = true
    invalidate()
  }
  wideMQ.addEventListener('change', onLayoutChange)
  const onReduced = () => {
    ctx.flags.reducedMotion = reducedMQ.matches
    snap = true
    invalidate()
  }
  reducedMQ.addEventListener('change', onReduced)
  let dprMQ: MediaQueryList | null = null
  const watchDpr = () => {
    dprMQ?.removeEventListener('change', onDpr)
    dprMQ = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    dprMQ.addEventListener('change', onDpr)
  }
  function onDpr() {
    watchDpr()
    onLayoutChange()
  }
  watchDpr()
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    setState('lost')
  }
  const onRestored = () => {
    lost = false
    layoutDirty = true
    setState('loading')
    invalidate()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  if (ctx.flags.debug)
    void import('@/scene/debug').then(({ attachDebug }) => {
      if (disposed) return
      attachDebug({
        host,
        renderer,
        scene,
        camera,
        plan,
        timeline,
        house,
        frame: frameModel,
        chapters,
        layout: () => layout,
        story: opts.story,
        frames: () => frames,
      })
    })

  setState('loading')
  invalidate()

  return {
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      unsubscribe()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wideMQ.removeEventListener('change', onLayoutChange)
      reducedMQ.removeEventListener('change', onReduced)
      dprMQ?.removeEventListener('change', onDpr)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      for (const c of chapters) c.dispose()
      overlay.dispose()
      fade.texture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
