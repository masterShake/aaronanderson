import type { Graph, RouteMode } from '../types'
import { isConnection } from '../lib/counts'
import { inRev } from '../lib/route'

/**
 * The table alternative, as data (no strings): one row per as-found hand-off
 * plus one per new rewired route that replaces nothing. The Schematic turns
 * the keys into copy. Pure; usable on the server only by convention.
 */

export type RewiredTreatment = 'auto' | 'ai' | 'hv' | 'aiHv' | 'keep'
export type FoundTreatment = RouteMode | 'none'

export interface TableRow {
  id: string
  from: string
  to: string
  /** Label key of what moves (route.carries). */
  carries: string | null
  found: FoundTreatment
  rewired: RewiredTreatment | null
  /** (E) existing link that stays, (N) new plumbing. */
  era: 'E' | 'N' | null
}

type AnyGraph = Graph<string, string>
const endNode = (end: string) => end.slice(0, end.indexOf('.'))

export function treatment(
  r: { ai?: boolean; valve?: boolean; mode?: RouteMode; kind: string },
  keep: boolean,
): RewiredTreatment {
  if (keep) return 'keep'
  if (r.ai && r.valve) return 'aiHv'
  if (r.ai) return 'ai'
  if (r.valve) return 'hv'
  return 'auto'
}

/**
 * Rows from a two-state graph: `found` is the as-found rev, `rewired` the
 * rewired rev. A rewired route with the same ends as the hand-off it replaces
 * and no new instruments is 'keep' when the hand-off was a sync.
 */
export function tableRows(g: AnyGraph, found: string, rewired: string): TableRow[] {
  const handoffs = g.routes.filter((r) => inRev(r, found) && r.mode && isConnection(r))
  const routes = g.routes.filter((r) => inRev(r, rewired) && !r.mode && isConnection(r))
  const rows: TableRow[] = handoffs.map((h) => {
    const by = routes.find((r) => r.replaces?.includes(h.id))
    const keep = Boolean(by && h.mode === 'sync' && !by.ai && !by.valve)
    return {
      id: h.id,
      from: endNode(h.from),
      to: endNode(h.to),
      carries: h.carries ?? null,
      found: h.mode!,
      rewired: by ? treatment(by, keep) : null,
      era: by ? (keep ? 'E' : 'N') : null,
    }
  })
  for (const r of routes)
    if (!r.replaces?.length)
      rows.push({
        id: r.id,
        from: endNode(r.from),
        to: endNode(r.to),
        carries: r.carries ?? null,
        found: 'none',
        rewired: treatment(r, false),
        era: 'N',
      })
  return rows
}
