import type { Part, Pt, SymbolDef, SymbolId } from '../types'
import { placePrim } from '../lib/geometry'
import { SYMBOLS } from './library'
import { PEOPLE, PERSON_HEIGHT } from './people'

export * from './library'
export * from './clouds'
export { figure, POSES, PEOPLE, PERSON_HEIGHT, PERSON_MIN_PX } from './people'
export type { Pose, PropId } from './people'

/** Every symbol and scale figure the library defines. */
export const LIBRARY: Readonly<Partial<Record<SymbolId, SymbolDef>>> = { ...SYMBOLS, ...PEOPLE }

export function symbolDef(id: SymbolId): SymbolDef {
  const d = LIBRARY[id]
  if (!d) throw new Error(`No symbol ${id}`)
  return d
}

/**
 * A symbol's parts placed in a drawing: its anchor (default 'c'; people use
 * 'feet') lands on `at`, scaled by k. Part ids are prefixed with `prefix`.
 */
export function placeSymbol(
  id: SymbolId,
  at: Pt,
  o: { k?: number; anchor?: string; prefix?: string } = {},
): Part[] {
  const d = symbolDef(id)
  const k = o.k ?? (id.startsWith('fig.') ? PERSON_HEIGHT / 64 : 1)
  const a = d.anchors?.[o.anchor ?? (id.startsWith('fig.') ? 'feet' : 'c')] ?? [0, 0]
  const origin: Pt = [at[0] - a[0] * k, at[1] - a[1] * k]
  return d.parts.map((p) => ({
    ...p,
    id: o.prefix ? `${o.prefix}.${p.id}` : p.id,
    prims: p.prims.map((q) => placePrim(q, origin, k)),
  }))
}
