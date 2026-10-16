import 'server-only'
import type { ModelSpec, Part, Pt, SvgDoc, SymbolId, ToolKind, ViewBox } from '@/drawings/types'
import { LIBRARY, TOOL_KINDS, placeSymbol, toolParts } from '@/drawings/symbols'
import { placePrim } from '@/drawings/lib/geometry'
import { isoPrintDoc, partsNodes } from '@/drawings/render'
import { toStillSvg } from '@/drawings/lib/svg-string'

/**
 * The /kit/fig showcase (preview only): every scale figure and symbol in the
 * library, drawn in pencil on paper and in CAD on blueprint, plus a small iso
 * print. Baked stills (colors inline), so the sheet needs no figure CSS.
 */

export type Medium = 'pencil' | 'cad'

export interface Tile {
  id: string
  medium: Medium
  svg: string
}

const TILE = 120

function fitted(id: SymbolId): { parts: Part[]; vb: ViewBox } {
  const d = LIBRARY[id]!
  const person = id.startsWith('fig.')
  const [, , w, h] = d.viewBox
  const k = person ? 96 / 72 : Math.min(96 / w, 96 / h, 3)
  // place the anchor so the symbol's own viewBox lands centred in the tile
  const parts = placeSymbol(id, [0, 0], { k, anchor: person ? 'feet' : 'c' })
  const a = d.anchors?.[person ? 'feet' : 'c'] ?? [0, 0]
  const cx = (d.viewBox[0] + w / 2 - a[0]) * k
  const cy = (d.viewBox[1] + h / 2 - a[1]) * k
  return { parts, vb: [cx - TILE / 2, cy - TILE / 2, TILE, TILE] }
}

function bake(doc: SvgDoc, medium: Medium): string {
  return toStillSvg(doc, {
    k: 0.9,
    ground: medium === 'pencil' ? 'paper' : 'deep',
    remap:
      medium === 'pencil'
        ? {}
        : { paper: 'deep', panel: 'deep', pencil: 'cyan', tint: 'tint-deep' },
  })
}

export function symbolTile(id: SymbolId, medium: Medium): Tile {
  const { parts, vb } = fitted(id)
  const children = partsNodes(parts, {
    variant: medium === 'pencil' ? 'pencil' : 'clean',
    seed: `showcase:${id}`,
    i: 0,
    ...(medium === 'pencil' ? { ink: 'pencil' } : {}),
  })
  const doc: SvgDoc = {
    viewBox: vb,
    groups: [{ layer: medium === 'pencil' ? 'pencil' : 'cad', children }],
  }
  return { id, medium, svg: bake(doc, medium) }
}

/** A tool enclosure with its glyph, by kind, in either medium. */
export function toolTile(kind: ToolKind, medium: Medium): Tile {
  const k = 0.6
  const parts = toolParts(kind).map((p) => ({
    ...p,
    prims: p.prims.map((q) => placePrim(q, [0, 0], k)),
  }))
  const children = parts.flatMap((p) =>
    partsNodes([p], {
      variant: medium === 'pencil' ? 'pencil' : 'clean',
      seed: `showcase:tool:${kind}`,
      i: 0,
      preset: p.id === 'box' ? 'box' : 'detail',
      ...(medium === 'pencil' ? { ink: 'pencil' } : {}),
    }),
  )
  const doc: SvgDoc = {
    viewBox: [54 - TILE / 2, 19.2 - TILE / 2, TILE, TILE],
    groups: [{ layer: medium === 'pencil' ? 'pencil' : 'cad', children }],
  }
  return { id: `tool:${kind}`, medium, svg: bake(doc, medium) }
}

export const TOOL_TILE_KINDS: readonly ToolKind[] = TOOL_KINDS

export const PEOPLE_IDS = (Object.keys(LIBRARY) as SymbolId[]).filter((id) => id.startsWith('fig.'))
export const SYMBOL_IDS = (Object.keys(LIBRARY) as SymbolId[]).filter(
  (id) => !id.startsWith('fig.'),
)

const rect = (x: number, y: number, w: number, h: number) => ({
  t: 'rect' as const,
  at: [x, y] as Pt,
  size: [w, h] as const,
})

/** A small plant: two tools, a pipe, a valve and a tank, for the iso print. */
const MODEL: ModelSpec = {
  id: 'showcase',
  layout: 'wide',
  viewBox: [0, 0, 480, 300],
  start: 'plan',
  parts: [
    { id: 'a', kind: 'box', prims: [rect(40, 60, 120, 70)], depth: 40, material: 'aluminum' },
    { id: 'b', kind: 'box', prims: [rect(40, 180, 120, 70)], depth: 40, material: 'aluminum' },
    {
      id: 'p',
      kind: 'pipe',
      prims: [
        {
          t: 'poly',
          pts: [
            [160, 95],
            [300, 95],
            [300, 215],
            [160, 215],
          ],
        },
      ],
      depth: 12,
      z: 14,
      material: 'aluminum',
    },
    { id: 'v', kind: 'valve', prims: [rect(285, 140, 30, 20)], depth: 24, material: 'orange' },
    {
      id: 't',
      kind: 'tank',
      prims: [{ t: 'circle', c: [400, 150], r: 44 }],
      depth: 110,
      material: 'aluminum',
    },
  ],
}

export function isoTile(): Tile {
  return {
    id: 'iso',
    medium: 'cad',
    svg: toStillSvg(isoPrintDoc(MODEL), { k: 0.9, ground: 'paper' }),
  }
}
