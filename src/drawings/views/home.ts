import type { Graph, LayoutId, Pt, ScaleFigure } from '../types'
import { firmGraph, type FirmLabel, type FirmRev } from '../graphs/firm'
import { pointAlong, routeGraph } from '../lib/route'

/**
 * Home B's view of the example firm (owner: home-about). The tools and routes
 * are the graph's own (Home's layout is the graph's base layout); only where
 * people stand on their hand-off lines as found changes, so that no two people
 * overlap in either family (the graph puts p1 and p2 at the same mid-points
 * under the spreadsheet, and p1 and p3 in the tall family's inbox channel).
 * Rewired stations are unchanged. KeyPlan and the hero keep reading firmGraph.
 */

/** Where along its hand-off line each person stands as found (0 to 1), per family. */
export const HOME_PEOPLE_AT: Readonly<Record<string, Readonly<Record<LayoutId, number>>>> = {
  p1: { wide: 0.3, tall: 0.86 },
  p2: { wide: 0.5, tall: 0.5 },
  p3: { wide: 0.62, tall: 0.62 },
  p4: { wide: 0.5, tall: 0.5 },
}

/** The person, and the hand-off they stand on as found (src/drawings/graphs/firm.ts). */
const ON: Readonly<Record<string, string>> = { p1: 'h02', p2: 'h05', p3: 'h04', p4: 'h11' }

function people(g: Graph<FirmLabel, FirmRev>): ScaleFigure<FirmRev>[] {
  const found = {
    wide: routeGraph(g, 'asFound', 'wide', { bend: 0 }),
    tall: routeGraph(g, 'asFound', 'tall', { bend: 0 }),
  }
  const onLine = (id: string, family: LayoutId, fallback: Pt): Pt => {
    const r = found[family].get(ON[id] ?? '')
    const t = HOME_PEOPLE_AT[id]?.[family]
    if (!r || t === undefined) return fallback
    const q = pointAlong(r.pts, t)
    return [Math.round(q[0]), Math.round(q[1])]
  }
  return (g.people ?? []).map((p) => {
    const af = p.poses.asFound
    if (!af) return p
    return {
      ...p,
      poses: {
        ...p.poses,
        asFound: {
          ...af,
          at: onLine(p.id, 'wide', af.at),
          atTall: onLine(p.id, 'tall', af.atTall ?? af.at),
        },
      },
    }
  })
}

/** The example firm as Home B draws it. */
export const homeFirmGraph: Graph<FirmLabel, FirmRev> = {
  ...firmGraph,
  people: people(firmGraph),
}
