/**
 * The contract every chapter stage implements. The stage calls update(p) for EVERY chapter on
 * every frame, with p = clamp(storyTime − index, 0, 1), so the result never depends on scroll
 * history or order. Rules (see docs/handoff.md):
 * - each scene property is owned by exactly one chapter;
 * - update() sets everything it owns from p alone — no state carried across frames;
 * - never change troika layout props (text, fontSize, anchors) in update(); use clipRect,
 *   color, scale and visibility.
 */
import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { Timeline } from '@/lib/draft/timeline'
import type { Frame } from '@/lib/framing/types'
import type { ResolvedHouse } from '@/lib/house/resolve'
import type { PlanDrawing } from '@/lib/plan/types'
import type { ChapterId } from '@/lib/story/chapters'
import type { LabelItem } from '@/scene/build/text'
import type { Layout, Pose } from '@/scene/camera'
import type { ElementFade } from '@/scene/fade'
import type { GridMaterial } from '@/scene/materials/GridMaterial'
import type { Overlay } from '@/scene/overlay'

export interface StageFlags {
  debug: boolean
  reducedMotion: boolean
}

export interface StageContext {
  scene: Scene
  /** Plan space (inches, Z up). Add all house geometry here. */
  root: Group
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  house: ResolvedHouse
  plan: PlanDrawing
  timeline: Timeline
  /** Every framing member of the house, in plan inches (chapter 2 onward). */
  frame: Frame
  fade: ElementFade
  overlay: Overlay
  flags: StageFlags
  /** Request a frame (e.g. when async work such as text layout completes). */
  invalidate(): void
}

/**
 * Chapter 1's drawing, handed to chapter 2 so it can retire the sheet. Chapter 2 owns only properties
 * chapter 1 never writes: `group.visible`, `grid.fade`, each label's `text.fillOpacity`, and the
 * per-element fade texels (ctx.fade).
 */
export interface Sheet {
  group: Group
  grid: GridMaterial
  labels: readonly LabelItem[]
}

export interface CameraKey {
  /** Chapter progress. */
  p: number
  /** A shot name defined by some chapter's `shots`. */
  shot: string
  /** Distance multiplier. */
  dolly?: number
  /** Easing into this key from the previous one. */
  ease?: 'inOutCubic' | 'linear'
}

export interface ChapterStage {
  readonly id: ChapterId
  /** Camera keys in this chapter's progress. Chapters without keys hold the previous pose. */
  readonly camera: readonly CameraKey[]
  /** Named shots, resolved against the current layout. */
  readonly shots: Readonly<Record<string, (layout: Layout) => Pose>>
  /** Resolves when the chapter can be shown (fonts loaded, text laid out). */
  readonly ready: Promise<void>
  /** Under prefers-reduced-motion, the progress actually shown (e.g. snapped to keyframes). */
  quantize?(p: number): number
  resize(layout: Layout): void
  update(p: number, layout: Layout): void
  dispose(): void
  /** Handles for ?debug (window.__AE__.chapters) and the screenshot probes. */
  readonly debug?: Readonly<Record<string, unknown>>
}
