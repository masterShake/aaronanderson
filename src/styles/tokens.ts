/**
 * The color and pen tokens of tokens.css, mirrored for SVG user units and for
 * three. Frozen after W0. Material tuning (roughness, anisotropy, clearcoat)
 * lives in src/stage/runtime/kit/materials.ts; only the colors are frozen here.
 */

export const COLOR = {
  paper: '#F4F2EC',
  paper2: '#ECE9E1',
  paperSunk: '#E9E5DB',
  asphalt: '#2A2C2E',
  asphaltDeep: '#1F2123',
  graphite: '#55595F',
  pencil: '#6B7076',
  pencilFaint: '#A9AEB4',
  blueprint: '#1C4E8F',
  blueprintDeep: '#143A6B',
  cyan: '#BFE6F5',
  cyanDim: '#8CC8E6',
  labelOnDeep: '#DDF1FA',
  orange: '#FF6B1A',
  orangeHover: '#FF8A4C',
  redline: '#B5400A',
  alu100: '#E3E6E9',
  alu300: '#C8CCD1',
  alu500: '#A9AEB4',
  alu700: '#8D939A',
  inputLine: '#6E7378',
} as const

export type ColorName = keyof typeof COLOR

/** The same colors as numbers, for three. */
export const HEX = Object.fromEntries(
  Object.entries(COLOR).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as { readonly [K in ColorName]: number }

/** Pen widths in CSS px at --k = 1. SVG stroke-width = pen × --k; WebGL width = pen × k × unitPx. */
export const PEN = { '018': 0.5, '025': 0.75, '035': 1.25, '050': 1.5, '070': 2, '100': 3 } as const

/** Section padding, as written in tokens.css. */
export const SECTION_PAD = 'clamp(48px, 6vw, 96px)'

/** Breakpoints in CSS px: 8 columns from sm, 12 (and sticky figures) from lg, sheet rail from xl. */
export const BREAKPOINT = { sm: 640, lg: 1024, xl: 1280, max: 1440 } as const

/** viewBox widths every figure family uses (heights vary per figure). */
export const VIEWBOX_WIDTH = { wide: 960, tall: 400 } as const

export const SCENE = {
  /** RoomEnvironment PMREM size, dropping to envSizeFallback if 3d:env takes over 80 ms at 4× CPU. */
  envSize: 128,
  envSizeFallback: 64,
  dprMaxTouch: 2,
  dprMaxTouchLarge: 1.5,
  /** Touch backing stores at or under this many pixels may use dprMaxTouch. */
  touchLargeStorePx: 750_000,
  dprMax: 2,
  isoAzimuthDeg: 45,
  isoElevationDeg: 35.264,
  padding: 0.08,
} as const

export type SceneTokens = {
  readonly color: typeof HEX
  readonly pen: typeof PEN
  readonly scene: typeof SCENE
}

export const SCENE_TOKENS: SceneTokens = { color: HEX, pen: PEN, scene: SCENE }
