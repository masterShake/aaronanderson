import type { FigureCopy, Rich } from '@/content/types'
import type { RouteMode } from '@/drawings/types'

/**
 * The strings the Schematic needs, read from a figure's content
 * (src/content/figures/firm.ts): labels by graph label key, and UI strings by
 * the keys below. A missing key renders as the key itself, so a gap in the
 * copy is visible in preview, never invented.
 */

export type Bucket = 'auto' | 'ai' | 'hv' | 'aiHv' | 'keep'

export const UI_KEYS = [
  'state.group',
  'state.asFound',
  'state.rewired',
  'tools.group',
  'tools.keyboard',
  'callout.close',
  'callout.asFound',
  'callout.asFoundNone',
  'callout.rewired',
  'callout.tool',
  'callout.tools',
  'callout.connection',
  'callout.connections',
  'bucket.auto',
  'bucket.ai',
  'bucket.hv',
  'bucket.aiHv',
  'bucket.keep',
  'mode.retype',
  'mode.forward',
  'mode.export',
  'mode.sync',
  'found.retype',
  'found.forward',
  'found.export',
  'found.sync',
  'found.none',
  'rewired.auto',
  'rewired.ai',
  'rewired.hv',
  'rewired.aiHv',
  'rewired.keep',
  'table.total',
  'era.E',
  'era.N',
] as const
export type UiKey = (typeof UI_KEYS)[number]

const text = (r: Rich | undefined): string | undefined =>
  r === undefined ? undefined : typeof r === 'string' ? r : r.text

export interface SchematicCopy {
  figure: FigureCopy
  label(key: string): string
  ui(key: UiKey): string
  modeVerb(m: RouteMode): string
  missing: readonly string[]
}

export function schematicCopy(figure: FigureCopy, labelKeys: readonly string[]): SchematicCopy {
  const labels = figure.labels as Readonly<Record<string, string>>
  const ui = (figure.ui ?? {}) as Readonly<Record<string, Rich>>
  const missing = [
    ...labelKeys.filter((k) => labels[k] === undefined),
    ...UI_KEYS.filter((k) => ui[k] === undefined),
  ]
  return {
    figure,
    label: (k) => labels[k] ?? k,
    ui: (k) => text(ui[k]) ?? k,
    modeVerb: (m) => text(ui[`mode.${m}`]) ?? `mode.${m}`,
    missing,
  }
}

/** Fill {name} placeholders. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
