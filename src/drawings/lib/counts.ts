import type { Graph, GraphCounts, GraphRoute, NodeTouches, RouteMode } from '../types'
import { inRev, visible } from './route'

/**
 * Every count shown in copy comes from here, never from a literal.
 *
 * - A hand-off is a route with a `mode` (how it moves today).
 * - By hand (`manual`) is a hand-off whose mode is not 'sync', or one flagged manual.
 * - An automated route is a conduit with no AI reader and no sign-off valve.
 * - People on lines are scale figures with a pose in the rev.
 */

type AnyGraph = Graph<string, string>
type AnyRoute = GraphRoute<string, string>

const endNode = (end: string) => end.slice(0, end.indexOf('.'))

export const isHandoff = (r: AnyRoute): boolean => r.mode !== undefined
export const isByHand = (r: AnyRoute): boolean =>
  isHandoff(r) && (r.manual === true || r.mode !== 'sync')
/** A real connection between two nodes (not a signal line ending on another route). */
export const isConnection = (r: AnyRoute): boolean => r.kind !== 'branch'

export function counts(g: AnyGraph, rev: string): GraphCounts {
  const { nodes, routes } = visible(g, rev)
  const links = routes.filter(isConnection)
  return {
    tools: nodes.filter((n) => n.kind === 'tool').length,
    handoffs: links.filter(isHandoff).length,
    manual: links.filter(isByHand).length,
    automated: links.filter((r) => r.kind === 'conduit' && !r.ai && !r.valve && !isHandoff(r))
      .length,
    ai: links.filter((r) => r.ai).length,
    valves: links.filter((r) => r.valve).length,
    peopleOnLines: (g.people ?? []).filter((p) => (p.poses as Record<string, unknown>)[rev]).length,
  }
}

/** Hand-offs per mode, in one rev. */
export function modeCounts(g: AnyGraph, rev: string): Readonly<Record<RouteMode, number>> {
  const out: Record<RouteMode, number> = { retype: 0, forward: 0, export: 0, sync: 0 }
  for (const r of visible(g, rev).routes) if (r.mode && isConnection(r)) out[r.mode]++
  return out
}

/** Routes in one rev that touch a node. */
export function routesTouching(g: AnyGraph, rev: string, nodeId: string): AnyRoute[] {
  return g.routes.filter(
    (r) =>
      inRev(r, rev) && isConnection(r) && (endNode(r.from) === nodeId || endNode(r.to) === nodeId),
  )
}

/** What one node touches in one rev: the numbers behind its callout. */
export function touches(g: AnyGraph, rev: string, nodeId: string): NodeTouches {
  const rs = routesTouching(g, rev, nodeId)
  const others = new Set(
    rs.map((r) => (endNode(r.from) === nodeId ? endNode(r.to) : endNode(r.from))),
  )
  return {
    node: nodeId,
    touches: others.size,
    manual: rs.filter(isByHand).length,
    automated: rs.filter((r) => r.kind === 'conduit' && !r.ai && !r.valve && !isHandoff(r)).length,
    viaAi: rs.filter((r) => r.ai).length,
    atValve: rs.filter((r) => r.valve).length,
    carries: rs.flatMap((r) => (r.carries ? [r.carries] : [])),
  }
}
