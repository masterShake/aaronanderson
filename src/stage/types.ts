import type { OrthographicCamera, Scene, WebGLRenderer } from 'three'
import type { LayoutId, Pen, ViewBox } from '@/drawings/types'
import type { SceneTokens } from '@/styles/tokens'

export type { LayoutId }

/**
 * The Stage contract (Appendix B §B7): one WebGL canvas for the whole site,
 * moved into whichever figure is most visible. Figures talk to it only through
 * `stage.register()` in src/stage/host.ts; scenes implement SceneModule.
 * Type-only three imports; frozen after W0.
 */

/** still: reduced motion or paused. svg: no 3D for this visit. webgl: 3D allowed. */
export type Tier = 'still' | 'svg' | 'webgl'
export type SceneId = 'hero' | 's02' | 's03' | 's04' | 's06'
/** Preview-only scenes: the stage lane's demo and the W0 bundle probe. */
export type DevSceneId = '_demo' | '_probe'
/** timeline: time-driven (hero, services under 1024 px). scrub: driven by --p. */
export type Mode = 'timeline' | 'scrub'
/** physical: MeshPhysical with anisotropy (desktop). standard: MeshStandard (touch). */
export type Quality = 'physical' | 'standard'
export type Pose = 'plan' | 'front' | 'iso'
export type Beat =
  | 'built'
  | 'running'
  | 'idle'
  | 'held'
  | 'approved'
  | 'syncfail'
  | 'synced'
  | 'fixed'
  | 'month1'
  | 'month2'
  | 'month3'
export type FallbackReason =
  'ineligible' | 'load-error' | 'build-error' | 'context-lost' | 'frame-guard' | 'timeout'

export type StageEvent =
  /** Compiled, and two GPU-confirmed frames drawn at opacity 0: safe to hand off. */
  | { type: 'ready' }
  /** The 120 ms cross-fade finished; the canvas is the medium. */
  | { type: 'handoff' }
  /** Scrub went back below the hand-off window; the SVG is the medium again. */
  | { type: 'handback' }
  | { type: 'beat'; beat: Beat; loop?: number }
  /** The figure stays on, or returns to, SVG. atMs = mechanism time the SVG path resumes at. */
  | { type: 'fallback'; reason: FallbackReason; atMs?: number }

export interface FigureInit {
  /** DevSceneId only on preview routes (/kit/stage). */
  scene: SceneId | DevSceneId
  mode: Mode
  layout: LayoutId
  /** The <figure>. The Stage writes data-stage, data-labels and the label CSS vars on it. */
  root: HTMLElement
  /** Empty .slot[data-stage-slot]; React renders no children into it. */
  slot: HTMLElement
  /** canvas.still inside the slot (2D), for the drawImage still when the canvas moves away. */
  still: HTMLCanvasElement
  onEvent?: (e: StageEvent) => void
}

export type FigureCommand = 'approve' | 'runAgain' | 'runAnother' | 'replay' | 'ask'

export interface FigureHandle {
  /** Scrub: raw 0 to 1 from the scroll driver. */
  setProgress(p: number): void
  setMode(m: Mode): void
  setLayout(l: LayoutId): void
  /** Timeline mode start (services on mobile, Replay). */
  play(): void
  /** Hand off now if armed; false means the caller runs its SVG path. */
  requestHandoff(at: 'decision' | 'boundary', loop?: number): boolean
  command(c: FigureCommand, arg?: string): void
  /** Idempotent; GPU disposal waits one frame, so StrictMode's remount is a no-op. */
  release(): void
}

export interface Stage {
  tier(): Tier
  register(init: FigureInit): FigureHandle
}

/** What a scene's update() reports each frame. */
export interface SceneUpdate {
  beat?: Beat
  /** Label anchors projected to slot-relative CSS px, keyed by figure label key. */
  labels?: ReadonlyMap<string, { x: number; y: number; visible: boolean }>
  animating: boolean
}

export interface SceneContext {
  readonly renderer: WebGLRenderer
  readonly quality: Quality
  readonly layout: LayoutId
  /** The active layout's viewBox. Plan: SVG (x, y) is world (x, 0, y). */
  readonly viewBox: ViewBox
  readonly tokens: SceneTokens
  /** Line width in CSS px for a pen: pen × k × unitPx, matching the SVG stroke exactly. */
  strokePx(pen: Pen): number
  /** Aborted when the figure is released. */
  readonly signal: AbortSignal
}

export interface SceneRig {
  readonly camera: OrthographicCamera
  /** e = 0 is the exact SVG frame; 1 is the isometric end pose. */
  pose(e: number): void
}

export interface SceneInstance {
  /** The three.Scene; the runtime sets its environment to the shared PMREM. */
  readonly three: Scene
  readonly rig: SceneRig
  /** Time-sliced construction: yield after each unit of at most 4 ms; the runtime runs at most 8 ms per slice. */
  build(): Generator<void, void, void>
  /** Back to the hand-off pose (plan or front), extrusion at floor, labels plan. */
  reset(loop?: number): void
  start(at: 'decision' | 'boundary' | 'scrub', loop?: number): void
  /** dt in ms (clamped by the runtime); p is the smoothed scrub progress. */
  update(dt: number, p: number): SceneUpdate
  setPose(pose: Pose): void
  command?(c: FigureCommand, arg?: string): void
  resize(width: number, height: number): void
  dispose(): void
}

export interface SceneModule {
  readonly id: SceneId | DevSceneId
  create(ctx: SceneContext): SceneInstance
}

/** Performance marks, visible in Lighthouse user timings. */
export const MARK = {
  init: '3d:init',
  firstFrame: '3d:first-frame',
  env: '3d:env',
  build: (id: SceneId | DevSceneId) => `3d:build:${id}`,
  compile: (id: SceneId | DevSceneId) => `3d:compile:${id}`,
  ready: (id: SceneId | DevSceneId) => `3d:ready:${id}`,
  handoff: (id: SceneId | DevSceneId) => `3d:handoff:${id}`,
} as const

/** Non-production debug surface, window.__aeStage. ?frame=plan uses holdAtHandoff. */
export interface StageDebug {
  state(): unknown
  holdAtHandoff(scene: SceneId | DevSceneId): Promise<void>
  show(scene: SceneId | DevSceneId, medium: 'svg' | 'webgl'): void
  seek(scene: SceneId | DevSceneId, at: { ms: number } | { p: number }): void
  loseContext(): void
}

declare global {
  interface Window {
    __aeStage?: StageDebug
  }
}
