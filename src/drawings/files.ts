import 'server-only'
import type { DrawingBuilder, DrawingKey } from './types'
import { drawing as fixture } from './graphs/_fixture'
import { drawing as firm } from '@/figures/firm/drawing.server'
import { drawing as s01 } from '@/figures/s01/drawing.server'
import { drawing as s02 } from '@/figures/s02/drawing.server'
import { drawing as s03 } from '@/figures/s03/drawing.server'
import { drawing as s04 } from '@/figures/s04/drawing.server'
import { drawing as s05 } from '@/figures/s05/drawing.server'
import { drawing as s06 } from '@/figures/s06/drawing.server'
import { drawing as ticket } from '@/figures/ticket/drawing.server'
import { drawing as valve } from '@/figures/valve/drawing.server'
import { drawing as orgChart } from '@/figures/org-chart/drawing.server'
import { drawing as strata } from '@/figures/strata/drawing.server'
import { drawing as afterContact } from '@/figures/after-contact/drawing.server'

/**
 * The registry behind /drawings/[file]: each key maps to the drawing.server.ts
 * its figure lane owns. Frozen after W0; figure lanes fill in their own
 * builder's `files`, so this file never changes. Server only.
 */
const BUILDERS: Readonly<Record<DrawingKey, DrawingBuilder>> = {
  _fixture: fixture,
  firm,
  s01,
  s02,
  s03,
  s04,
  s05,
  s06,
  ticket,
  valve,
  'org-chart': orgChart,
  strata,
  'after-contact': afterContact,
}

/** Every file the route prerenders, as `{key}.{file}`, e.g. 's02.wide.json'. */
export const DRAWING_FILES: readonly string[] = Object.entries(BUILDERS).flatMap(([key, b]) =>
  b.files.map((f) => `${key}.${f}`),
)

/** The served path of a drawing file. */
export const drawingSrc = (key: DrawingKey, file: string) => `/drawings/${key}.${file}`

/** The body of one file. Throws on an unknown name (the route only asks for listed ones). */
export function buildFile(name: string): string {
  const dot = name.indexOf('.')
  const key = name.slice(0, dot) as DrawingKey
  const file = name.slice(dot + 1)
  const b = BUILDERS[key]
  if (!b || !b.files.includes(file)) throw new Error(`Unknown drawing file ${name}`)
  return b.build(file)
}

/** The Content-Type for a drawing file name. */
export const contentType = (name: string) =>
  name.endsWith('.json') ? 'application/json; charset=utf-8' : 'image/svg+xml; charset=utf-8'
