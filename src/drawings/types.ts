/**
 * The drawing contract: geometry primitives, typed graphs (one-line diagrams),
 * the 3D model spec shared by the scenes and the build-time iso print, and the
 * files the /drawings/[file] route serves. Isomorphic: no roughjs, no DOM, no
 * strings (labels are keys into src/content). Frozen after W0.
 *
 * Stroke model (Appendix B, critic 6): no vector-effect anywhere; draw-on, flow
 * and dashed paths use pathLength="1" with stroke-dasharray "1 2"; stroke-width
 * is calc(var(--pen-*) * var(--k)); wide viewBoxes are 960 wide and tall ones
 * 400 wide; WebGL line width is pen × k × unitPx (SceneContext.strokePx).
 */

export type Pt = readonly [x: number, y: number]
export type ViewBox = readonly [x: number, y: number, w: number, h: number]
/** Wide is used when the figure container is 440 px or more (services) or 520 px (hero). */
export type LayoutId = 'wide' | 'tall'
export type Pen = '018' | '025' | '035' | '050' | '070' | '100'
export type Ink =
  | 'pencil'
  | 'graphite'
  | 'cad'
  | 'cyan'
  | 'cyan-dim'
  | 'redline'
  | 'orange'
  | 'asphalt'
  | 'paper'
  | 'hold'
/** The HTML-level <svg> layers a figure stacks, bottom to top (class l-{layer}). */
export type Layer = 'panel' | 'pencil' | 'ghost' | 'cad' | 'pkt' | 'iso'
export const LAYERS: readonly Layer[] = ['panel', 'pencil', 'ghost', 'cad', 'pkt', 'iso']

/** Author geometry as primitives, never raw d strings, so lengths stay computable. */
export type Prim =
  | { t: 'line'; a: Pt; b: Pt }
  /** r = bend radius (12 for CAD routes). */
  | { t: 'poly'; pts: readonly Pt[]; closed?: boolean; r?: number }
  | { t: 'rect'; at: Pt; size: readonly [number, number] }
  | { t: 'circle'; c: Pt; r: number }
  /** Degrees. */
  | { t: 'arc'; c: Pt; r: number; from: number; to: number }
  | { t: 'cubic'; a: Pt; c1: Pt; c2: Pt; b: Pt }
  /** Escape hatch; the author supplies len. */
  | { t: 'path'; d: string; len: number }

export interface Part {
  id: string
  layer: Layer
  prims: readonly Prim[]
  pen: Pen
  ink: Ink
  fill?: Ink | 'none'
  /** Stagger index, written as --i. */
  order?: number
  dash?: 'hand-carry' | 'hidden' | 'center'
  /** Visible in these states (default: all). */
  revs?: readonly string[]
}

export interface Anchor {
  at: Pt
  atTall?: Pt
  side?: 'n' | 'e' | 's' | 'w' | 'c'
  z?: number
}

export interface DrawingModule<L extends string = string, R extends string = string> {
  id: string
  viewBox: { wide: ViewBox; tall?: ViewBox }
  /** CSS px at which pen widths render exactly. */
  designWidth: { wide: number; tall?: number }
  revs: readonly R[]
  parts: { wide: readonly Part[]; tall?: readonly Part[] }
  anchors: Readonly<Record<L, Anchor>>
  /** Non-zero roughjs base seed. */
  seed: number
}

// Typed graphs (one-line diagrams)

export type NodeKind =
  'tool' | 'ai' | 'valve' | 'store' | 'monitor' | 'report' | 'doc' | 'junction' | 'person'

export interface Port {
  side: 'n' | 'e' | 's' | 'w'
  /** 0 to 1 along the side. */
  at: number
}

export interface GraphNode<L extends string, R extends string> {
  id: string
  kind: NodeKind
  label: L
  at: Pt
  atTall?: Pt
  size: readonly [number, number]
  /** Box size in the tall family, when it differs from size. */
  sizeTall?: readonly [number, number]
  ports: Readonly<Record<string, Port>>
  /** (E) existing software that stays, (N) plumbing we add. */
  era?: 'E' | 'N'
  revs?: readonly R[]
  detail?: `S-0${1 | 2 | 3 | 4 | 5 | 6}`
  symbol?: SymbolId
  depth?: number
}

/** How a hand-off moves today: retyped, forwarded, exported, or synced. */
export type RouteMode = 'retype' | 'forward' | 'export' | 'sync'

export interface GraphRoute<L extends string, R extends string> {
  id: string
  /** nodeId.portId */
  from: `${string}.${string}`
  to: `${string}.${string}`
  kind: 'hand-carry' | 'conduit' | 'branch'
  mode?: RouteMode
  /** Hand-off route ids this route replaces once rewired. */
  replaces?: readonly string[]
  via?: readonly Pt[]
  sketchVia?: readonly Pt[]
  /** A person retypes it (counted). */
  manual?: boolean
  /** Scale-figure id standing on it (as found). */
  person?: string
  carries?: L
  ai?: boolean
  valve?: boolean
  revs?: readonly R[]
}

export interface ScaleFigure<R extends string> {
  id: string
  poses: Partial<Readonly<Record<R, { symbol: SymbolId; at: Pt; atTall?: Pt }>>>
}

export interface Cloud<L extends string, R extends string> {
  id: string
  around: readonly string[]
  tag: L
  revs: readonly R[]
}

export interface Graph<L extends string = string, R extends string = string> {
  id: string
  viewBox: { wide: ViewBox; tall: ViewBox }
  designWidth: { wide: number; tall: number }
  revs: readonly R[]
  nodes: readonly GraphNode<L, R>[]
  routes: readonly GraphRoute<L, R>[]
  people?: readonly ScaleFigure<R>[]
  notes?: readonly { key: L; at: Pt; atTall?: Pt; rotate: number }[]
  clouds?: readonly Cloud<L, R>[]
  seed: number
}

export interface GraphView<R extends string = string> {
  id: string
  graph: string
  nodes: readonly string[]
  routes: readonly string[]
  layout?: Readonly<Record<string, { at: Pt; atTall?: Pt }>>
  viewBox?: { wide: ViewBox; tall: ViewBox }
  revs?: readonly R[]
}

/** Every count shown in copy comes from here, never from a literal. */
export interface GraphCounts {
  tools: number
  handoffs: number
  manual: number
  automated: number
  ai: number
  valves: number
  peopleOnLines: number
}

export interface NodeTouches {
  node: string
  touches: number
  manual: number
  automated: number
  viaAi: number
  atValve: number
  carries: readonly string[]
}

// 3D model spec: one description feeds the three.js scenes and the build-time iso print

export type ModelPartKind = 'box' | 'cyl' | 'pipe' | 'flange' | 'valve' | 'tank' | 'card' | 'slot'
export type ModelMaterial = 'aluminum' | 'orange' | 'glass' | 'paper' | 'line' | 'panel'

export interface ModelPart {
  id: string
  kind: ModelPartKind
  /** Plan footprint in viewBox units (the same as the SVG plan frame). */
  prims: readonly Prim[]
  /** Extrusion height in viewBox units. */
  depth: number
  /** Base height above the ground plane. */
  z?: number
  material: ModelMaterial
  /** Label key this part carries, projected for the HTML label overlay. */
  anchor?: string
  revs?: readonly string[]
}

export interface ModelSpec {
  id: string
  layout: LayoutId
  viewBox: ViewBox
  /** 'front' only for S-03 (section A–A). */
  start: 'plan' | 'front'
  parts: readonly ModelPart[]
}

// Serializable SVG (inline hero, or the static files)

export type SvgNode =
  | { el: 'path'; d: string; len: number; part: string; i: number; cls: string }
  | {
      el: 'g'
      cls?: string
      part?: string
      transform?: string
      children: readonly SvgNode[]
    }

export interface SvgDoc {
  viewBox: ViewBox
  cls?: string
  groups: readonly { layer: Layer; rev?: string; children: readonly SvgNode[] }[]
}

/** Body of `{figure}.{family}.json`: one markup string per layer, injected into stacked <svg>s. */
export interface DrawingBundle {
  v: 1
  vb: readonly [w: number, h: number]
  layers: Partial<Readonly<Record<Layer, string>>>
}

/**
 * Static drawing files, GET /drawings/{key}.{file}:
 *   {key}.{family}.json              layer bundle (DrawingBundle)
 *   {key}.{family}[.{state}].still.svg  baked, self-contained still for <img loading=lazy> and <noscript>
 * The hero is inline and has no files; '_fixture' is the W0 render check.
 */
export type DrawingKey =
  | '_fixture'
  | 'firm'
  | 's01'
  | 's02'
  | 's03'
  | 's04'
  | 's05'
  | 's06'
  | 'ticket'
  | 'valve'
  | 'org-chart'
  | 'strata'
  | 'after-contact'

/** What each figure's drawing.server.ts exports as `drawing`. */
export interface DrawingBuilder {
  /** File names after the key, e.g. 'wide.json', 'tall.still.svg', 'wide.held.still.svg'. */
  readonly files: readonly string[]
  build(file: string): string
}

// Symbol library: ids are frozen; geometry is owned by the drawings lane

export type SymbolId =
  | 'sym.tool'
  | 'sym.conduit'
  | 'sym.hand-carry'
  | 'sym.packet'
  | 'sym.ai-bubble'
  | 'sym.hv-valve'
  | 'sym.tolerance'
  | 'sym.data-tank'
  | 'sym.monitor'
  | 'sym.flange'
  | 'sym.lamp'
  | 'sym.hanger'
  | 'sym.junction-box'
  | 'sym.logbook'
  | 'mark.revision-cloud'
  | 'mark.hold-cloud'
  | 'mark.detail-bubble'
  | 'mark.section-cut'
  | 'mark.north-arrow'
  | 'mark.scale-bar'
  | 'mark.grid-bubble'
  | 'mark.dimension'
  | 'mark.stamp'
  | 'mark.delta-tag'
  | 'mark.key-plan'
  | 'obj.doc-invoice'
  | 'obj.doc-ticket'
  | 'obj.doc-submittal'
  | 'obj.data-card'
  | 'obj.log-tape'
  | 'obj.report'
  | 'obj.phone'
  | 'obj.total-station'
  | 'obj.binder'
  | 'obj.prompt-card'
  | 'obj.guideline'
  | 'obj.screen'
  | 'obj.training-record'
  | 'obj.tape-measure'
  | 'obj.tracing-paper'
  | 'obj.eraser-crumbs'
  | 'obj.calendar-strip'
  | 'obj.dial'
  | 'obj.hard-hat'
  | 'fig.standing'
  | 'fig.carrying-paper'
  | 'fig.at-valve'
  | 'fig.desk-stamp'
  | 'fig.walking'
  | 'fig.survey'
  | 'fig.receive'
  | 'fig.tablet'
  | 'fig.phone'
  | 'fig.hardhat-estimator'
  | 'fig.hardhat-pm'
  | 'fig.hardhat-field'
  | 'fig.new-hire'
  | 'fig.owner'

export interface SymbolDef {
  id: SymbolId
  viewBox: ViewBox
  parts: readonly Part[]
  anchors?: Readonly<Record<string, Pt>>
  ports?: Readonly<Record<string, Port>>
}
