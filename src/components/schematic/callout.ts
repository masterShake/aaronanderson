import type { Graph } from '@/drawings/types'
import { isByHand, routesTouching } from '@/drawings/lib/counts'
import { treatment } from '@/drawings/render/table'
import { fill, type Bucket, type SchematicCopy } from './copy'

/**
 * Callout text for one tool in one state (pages-drawings §3.4), computed from
 * the graph, never typed:
 *   as found: Touches {n} {tools}. {k} by hand: {items}.
 *   rewired:  {c} {connections}: {clauses}.  (title gets the (E) chip)
 */

type AnyGraph = Graph<string, string>

/** Label keys of the (E) and (N) chips. */
export const ERA_TAG = { E: 'tag.e', N: 'tag.n' } as const
const endNode = (end: string) => end.slice(0, end.indexOf('.'))

export interface CalloutText {
  title: string
  body: string
}

export function calloutText(
  g: AnyGraph,
  tool: string,
  state: 'asFound' | 'rewired',
  c: SchematicCopy,
  titleKey?: string,
): CalloutText {
  const node = g.nodes.find((n) => n.id === tool)!
  const title = c.label(titleKey ?? node.label)
  const rs = routesTouching(g, state, tool)
  if (state === 'asFound') {
    const others = new Set(
      rs.map((r) => (endNode(r.from) === tool ? endNode(r.to) : endNode(r.from))),
    )
    const n = others.size
    const byHand = rs.filter(isByHand)
    const items = byHand
      .map((r) => `${r.carries ? c.label(r.carries) : r.id} (${c.modeVerb(r.mode!)})`)
      .join('; ')
    const vars = {
      n,
      tools: c.ui(n === 1 ? 'toolOne' : 'toolMany'),
      k: byHand.length,
      items,
    }
    return {
      title,
      body: fill(c.ui(byHand.length ? 'asFound' : 'asFoundNone'), vars),
    }
  }
  const buckets: Record<Bucket, number> = { auto: 0, ai: 0, hv: 0, aiHv: 0, keep: 0 }
  for (const r of rs) {
    const replaced = g.routes.filter((h) => r.replaces?.includes(h.id))
    const keep =
      replaced.length > 0 && replaced.every((h) => h.mode === 'sync') && !r.ai && !r.valve
    buckets[treatment(r, keep)]++
  }
  const clauses = (Object.keys(buckets) as Bucket[])
    .filter((b) => buckets[b] > 0)
    .map((b) => fill(c.ui(`bucket.${b}`), { n: buckets[b] }))
    .join('; ')
  const total = rs.length
  return {
    title: node.era ? `${title} ${c.label(ERA_TAG[node.era])}` : title,
    body: fill(c.ui('rewired'), {
      c: total,
      connections: c.ui(total === 1 ? 'connectionOne' : 'connectionMany'),
      clauses,
    }),
  }
}
