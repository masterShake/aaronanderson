import type { ReactNode } from 'react'
import type { FigureCopy, FigureId } from '@/content/types'
import type { FigureHandle, Mode, SceneId } from '@/stage/types'
import type { Layer, ViewBox } from '@/drawings/types'

/**
 * The figure DOM contract (Appendix B §B5). FigureFrame (server) writes it;
 * useFigure (client) keeps it up to date; CSS and the tests read it. Frozen
 * after W0.
 *
 * <figure id="fig-{FigureId}" class="fig" data-figure
 *         data-phase="still|waiting|playing|done" data-medium="svg|webgl"
 *         data-stage="svg|handoff|webgl|handback" data-view="plan|iso"
 *         data-labels="plan|iso|hidden" data-family="wide|tall" data-toggle="<per figure>"
 *         data-rev data-loop data-run="<n>"
 *         [data-offscreen] [data-armed] [data-inview] [data-user-play] [data-layers="ready"]
 *         style="--vbw;--vbh;--vbw-t;--vbh-t;--p:0;…timing vars"
 *         aria-labelledby="fig-{id}-title" aria-describedby="fig-{id}-desc">
 *   .strip > #fig-{id}-title (detail · title · tag) · [data-rev-chip] · .controls
 *   .box (aspect-ratio from the layout)
 *     .drawing[aria-hidden] > svg.l-panel · svg.l-pencil · svg.l-ghost · svg.l-cad · svg.l-pkt · svg.l-iso
 *                            (one HTML-level <svg> per layer; noscript img.still-img for lazy drawings)
 *     .scan-bar
 *     .slot[data-stage-slot] > canvas.still
 *     .labels[aria-hidden]   (label vars --lx/--ly and --lxt/--lyt for plan; --ix/--iy for iso)
 *     .ui                    (focusable overlay)
 *     .still > img.still-img (still tier)
 *   figcaption · <details> table · #fig-{id}-desc.sr-only · p[data-live][aria-live=polite].sr-only
 *
 * The gate is data-armed plus data-inview, read by CSS through a registered --gate.
 * Play, Replay and Run again set data-user-play (figure-scoped; nothing is stored).
 * data-state is not used. Deep links use #fig-hero.
 */

export type FigurePhase = 'still' | 'waiting' | 'playing' | 'done'
export type FigureMedium = 'svg' | 'webgl'
export type FigureStage = 'svg' | 'handoff' | 'webgl' | 'handback'
export type FigureView = 'plan' | 'iso'
export type FigureLabels = 'plan' | 'iso' | 'hidden'
export type FigureFamily = 'wide' | 'tall'
export type FigureDriver = 'time' | 'scroll' | 'steps' | 'input'
/** hero: desktop after load + idle; touch after load + 30% visible. near: within one viewport. visible: 30% visible. */
export type LoadPolicy = 'hero' | 'near' | 'visible'

/** The DOM id of a figure. */
export const figureDomId = (id: FigureId) => `fig-${id}` as const
/** Class of each HTML-level layer <svg>, bottom to top. */
export const layerClass = (layer: Layer) => `l-${layer}` as const
/** The hero's deep link. */
export const HERO_ANCHOR = '#fig-hero'

export interface FigureFrameProps {
  id: FigureId
  copy: FigureCopy
  /** tall is used below the family threshold (container query). */
  layouts: { wide: ViewBox; tall?: ViewBox }
  /** <InlineDrawing/> (hero only) or <LazyDrawing/>. */
  drawing: ReactNode
  /** Still-tier content: the iso print plus inset; for lazy figures an <img loading="lazy">. */
  still: ReactNode
  /** HTML label overlay, aria-hidden (the long description carries the meaning). */
  labels?: ReactNode
  /** Focusable overlay (.ui), e.g. node buttons. */
  ui?: ReactNode
  /** "Show as table" alternative, inside <details>. */
  table?: ReactNode
  stage?: { scene: SceneId; load: LoadPolicy; mode: Mode }
  driver: FigureDriver
  /** Per-figure timing vars, from cssVars(). */
  vars?: Readonly<Record<`--${string}`, string | number>>
  initialRev?: string
  /** Initial data-toggle value, for figures with a two-state toggle. */
  initialToggle?: string
  controls?: { replay?: boolean; motion?: boolean; playDrawing?: boolean; extra?: ReactNode }
  className?: string
  /** The figure's *.client.tsx controller. */
  children?: ReactNode
}

export interface FigureApi {
  readonly root: HTMLElement | null
  readonly phase: FigurePhase
  readonly medium: FigureMedium
  readonly handle: FigureHandle | null
  /** Replay, Play the drawing, Run again: sets data-user-play and bumps data-run (restarts CSS). */
  play(): void
  setRev(rev: string): void
  setToggle(value: string): void
  /** Writes --p and forwards it to the Stage. */
  setProgress(p: number): void
  command(name: Parameters<FigureHandle['command']>[0], arg?: string): void
  /** Sets the [data-live] text. */
  announce(text: string): void
  /** The sequence is at a rest pose: hand off now if the scene is ready. */
  markRest(pose: 'decision' | 'boundary', loop?: number): boolean
  /** Idle on the still; stops loops; clears data-user-play. */
  done(): void
}

export interface FigureConfig {
  driver: FigureDriver
  /** Default deadline is GATE.handoffDeadline. */
  stage?: { scene: SceneId; load: LoadPolicy; mode: Mode; deadlineMs?: number }
  /** Mobile entry gate (default GATE.entry = 0.4). */
  gateRatio?: number
  /** driver 'scroll': the section whose height sets the scrub length. */
  track?: () => HTMLElement | null
  /** driver 'steps': headings carrying data-rev-value. */
  steps?: () => readonly HTMLElement[]
}
