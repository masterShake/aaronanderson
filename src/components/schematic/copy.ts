import type { FigureCopy, Rich } from '@/content/types'
import type { RouteMode } from '@/drawings/types'

/**
 * The strings the Schematic needs, read from a figure's content
 * (src/content/figures/firm.ts): labels by graph label key, and UI strings by
 * the keys below (the copy lane's names). A missing key renders as the key
 * itself in preview, so a gap in the copy is visible, never invented; `missing`
 * lists them.
 */

export type Bucket = 'auto' | 'ai' | 'hv' | 'aiHv' | 'keep'

export const UI_KEYS = [
  'toggleLabel',
  'asFoundButton',
  'rewiredButton',
  'toolsLabel',
  'keyboard',
  'close',
  'asFound',
  'asFoundNone',
  'rewired',
  'toolOne',
  'toolMany',
  'connectionOne',
  'connectionMany',
  'bucket.auto',
  'bucket.ai',
  'bucket.hv',
  'bucket.aiHv',
  'bucket.keep',
  'modeVerb.retype',
  'modeVerb.forward',
  'modeVerb.export',
  'modeVerb.sync',
  'table.retype',
  'table.forward',
  'table.export',
  'table.sync',
  'table.none',
  'table.auto',
  'table.ai',
  'table.hv',
  'table.aiHv',
  'table.keep',
  'table.counts',
  'bubblesLabel',
  'bubble',
] as const
export type UiKey = (typeof UI_KEYS)[number]

const text = (r: Rich | undefined): string | undefined =>
  r === undefined ? undefined : typeof r === 'string' ? r : r.text

export interface SchematicCopy {
  figure: FigureCopy
  /** A label by key, or the key itself. */
  label(key: string): string
  /** A label by key, or undefined (for optional labels such as sub-lines). */
  maybe(key: string): string | undefined
  ui(key: UiKey): string
  /** The Rich value of a UI key (for RichText, which spells {n:word}). */
  rich(key: UiKey): Rich
  /** A hand note by key, or undefined. */
  note(key: string): string | undefined
  modeVerb(m: RouteMode): string
  missing: readonly string[]
}

export function schematicCopy(figure: FigureCopy, labelKeys: readonly string[]): SchematicCopy {
  const labels = figure.labels as Readonly<Record<string, string>>
  const notes = (figure.notes ?? {}) as Readonly<Record<string, string>>
  const ui = (figure.ui ?? {}) as Readonly<Record<string, Rich>>
  const missing = [
    ...labelKeys.filter((k) => labels[k] === undefined),
    ...UI_KEYS.filter((k) => ui[k] === undefined),
  ]
  return {
    figure,
    label: (k) => labels[k] ?? k,
    maybe: (k) => labels[k],
    ui: (k) => text(ui[k]) ?? k,
    rich: (k) => ui[k] ?? k,
    note: (k) => notes[k],
    modeVerb: (m) => text(ui[`modeVerb.${m}`]) ?? `modeVerb.${m}`,
    missing,
  }
}

/** Fill {name} placeholders. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
