/**
 * PlanDrawing: the floor plan as plain drawing primitives in plan inches. The scene turns these
 * into GPU meshes; the SVG poster serializes the same data. Every primitive carries:
 * - `beat`: the drafting beat it belongs to (see lib/draft/script.ts);
 * - `el`: a dense element index (wall, opening, room, …) shared by everything drawn for that
 *   element — chapter 2 uses it to fade one wall's ink as its studs go up.
 */
import type { Rect, Vec2 } from '@/lib/geom/rect'
import type { PaletteKey, PenId } from '@/lib/plan/pens'

export type BeatId =
  | 'sheet'
  | 'setout'
  | 'testfits'
  | 'chips'
  | 'select'
  | 'narrow'
  | 'exterior'
  | 'poche'
  | 'interior'
  | 'openings'
  | 'casework'
  | 'site'
  | 'dims'
  | 'labels'
  | 'egress'
  | 'hall'
  | 'door'
  | 'wc'
  | 'alarms'
  | 'signoff'

export type ElementKind =
  | 'setout'
  | 'testfit'
  | 'wall'
  | 'opening'
  | 'fixture'
  | 'room'
  | 'porch'
  | 'roof'
  | 'dim'
  | 'annotation'
  | 'check'
  | 'device'

export interface ElementRef {
  kind: ElementKind
  id: string
}

/** Test-fit groups draw as separate meshes so they can be offset beside the real house. */
export type FitGroup = 'A' | 'B' | 'C'

export interface Stroke {
  pen: PenId
  beat: BeatId
  el: number
  /** Polyline in plan inches. */
  pts: Vec2[]
  group?: FitGroup
  /** Preferred pen track within the beat (e.g. outer wall faces on 0, inner on 1). */
  track?: number
}

export type FillKind = 'poche' | 'wash' | 'solid'

export interface Fill {
  kind: FillKind
  beat: BeatId
  el: number
  /** Convex polygon, counter-clockwise. */
  poly: Vec2[]
  /** Reveal by wiping from `from` toward `to` instead of fading in. */
  wipe?: { from: Vec2; to: Vec2 }
}

export type LabelSize = 'name' | 'size' | 'dim' | 'tag' | 'note'

export interface Label {
  beat: BeatId
  el: number
  text: string
  at: Vec2
  rot: 0 | 90
  anchor: { x: 'left' | 'center' | 'right'; y: 'top' | 'middle' | 'bottom' }
  size: LabelSize
  color: PaletteKey
  /** 2 = hidden on narrow screens. */
  lod: 1 | 2
}

/** Paper-space callout (an HTML chip), anchored to a plan point. */
export interface Mark {
  id: string
  beat: BeatId
  at: Vec2
  text: string
  /** Text swapped in later in the chapter (see the script's `swaps`). */
  then?: string
  check?: boolean
  /** Shows the check icon after the swap. */
  thenCheck?: boolean
  group?: FitGroup
  /** Which side of the anchor the chip sits on. */
  dir: 'n' | 's' | 'e' | 'w'
}

export interface PlanDrawing {
  elements: ElementRef[]
  index: ReadonlyMap<string, number>
  strokes: Stroke[]
  fills: Fill[]
  labels: Label[]
  marks: Mark[]
  box: {
    building: Rect
    /** Everything on the finished sheet, for the main camera framing. */
    drawing: Rect
    /** All three test fits side by side, per layout. */
    testfits: { wide: Rect; narrow: Rect }
  }
  /** Where test fits A, B and C sit relative to the real house, per layout. */
  fitOffsets: { wide: Record<FitGroup, Vec2>; narrow: Record<FitGroup, Vec2> }
  /** Text alternative for screen readers. */
  summary: string
}
